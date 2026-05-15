import "server-only";

import {
  CARD_BUILDER_AUDIENCES,
  CARD_BUILDER_MARKETPLACES,
  CARD_BUILDER_PRESERVE_ASPECTS,
  CARD_BUILDER_PRICE_SEGMENTS,
  CARD_BUILDER_SALES_STYLES,
  CARD_BUILDER_TEXT_DENSITY,
} from "@/config/card-builder-config";
import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
import type { ProductCardMarketplaceProfile } from "@/config/product-card-marketplace-profiles";
import { PRODUCT_CATEGORY_GROUPS } from "@/config/product-card-categories";
import { getCategoryFieldsSafetyBullets } from "@/config/product-card-category-fields";
import {
  categoryFieldsPlainForPlanner,
  effectiveDimensionsForOverlay,
  hasMeasuresFromCategoryPlan,
  lockedCategoryLabelsForSlideRole,
  type CardBuilderPlanWithCategoryFields,
} from "@/lib/card-builder-category-fields-runtime";
import type { CardBuilderStyleReferencePlan } from "@/lib/card-builder-style-reference";

const PROMPT_VERSION = "card_builder_super_prompt_v3" as const;

const MAX_PHRASES = 16;
/** Одна фраза на кадр; поля категории и характеристики до ~400 символов. */
const MAX_PHRASE_LEN = 400;

const KK_LETTERS_RE = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/;
const CYRILLIC_RE = /[а-яА-ЯёЁ]/;
const LATIN_RE = /[a-zA-Z]/;

export type CardBuilderSuperPromptLanguageMode = "ru" | "kk" | "mixed" | "auto";

export type CardBuilderSuperPromptInput = {
  productTitle?: string;
  subtitle?: string;
  selectedCategory: string;
  marketplace: string;
  slideRole: string;
  templateId?: string;
  layoutPreset?: string;
  goal?: string;
  /** id чекбоксов «Преимущества» — только семантические акценты промпта, не exact text. */
  benefits: string[];
  additionalBenefits?: string;
  mustShow: string[];
  audience?: string;
  priceSegment?: string;
  salesStyle?: string;
  textDensity?: string;
  preserveProduct: boolean;
  /** Аспекты идентичности товара (id из CARD_BUILDER_PRESERVE_ASPECTS); только при preserveProduct=true. */
  preserveAspects?: string[];
  allowCreativeStylization?: boolean;
  sourceImageMode?: string;
  languageMode?: CardBuilderSuperPromptLanguageMode;
  dimensions?: string;
  /** Профиль площадки: промпт и текстовые ограничения; если не задан — трактовать как универсальный режим. */
  marketplaceProfile?: ProductCardMarketplaceProfile | null;
  categoryFields?: CardBuilderPlanWithCategoryFields["categoryFields"];
  categoryFieldsByCategory?: CardBuilderPlanWithCategoryFields["categoryFieldsByCategory"];

  /** Референс стиля: не участвует в exactTextPhrases и locked product facts. */
  styleReferencePlan?: CardBuilderStyleReferencePlan | null;
  /** Сколько входных фото товара передано в генерацию (углы и т.д.). */
  productSourceImageCount?: number;
  /** Сколько изображений референса стиля реально подставлено после проверки доступа. */
  styleReferenceImageCount?: number;
};

export type CardBuilderSuperPromptOk = {
  prompt: string;
  promptVersion: typeof PROMPT_VERSION;
  exactTextPhrases: string[];
  textRenderMode: "ai_text_in_design";
  textLockLevel: "strict";
  designFlexible: true;
  overlayApplied: false;
  exactTextRequested: true;
  /** Подсказка для UI/metadata: акценты обрезаны под max площадки */
  marketplaceBenefitTrimNotice?: string;
};

export type CardBuilderSuperPromptResult =
  | { ok: true; data: CardBuilderSuperPromptOk }
  | { ok: false; validationErrors: string[] };

export function stripHtmlFragments(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function detectTextLanguageMode(phrases: string[]): {
  hasKazakhLetters: boolean;
  hasCyrillic: boolean;
  hasLatin: boolean;
} {
  const joined = phrases.join("\n");
  return {
    hasKazakhLetters: KK_LETTERS_RE.test(joined),
    hasCyrillic: CYRILLIC_RE.test(joined),
    hasLatin: LATIN_RE.test(joined),
  };
}

/** Смысловой акцент для промпта (НЕ клиентский exact text и не текст плашек). */
export function semanticBenefitAccentRu(benefitId: string): string | null {
  const accents: Record<string, string> = {
    design: "Сделай акцент на дизайне и внешнем виде товара.",
    material: "Сделай акцент на материале товара.",
    size: "Сделай акцент на размере и габарите товара.",
    comfort: "Сделай акцент на комфорте использования.",
    reliability: "Сделай акцент на надёжности товара.",
    premium_feel: "Подчеркни премиальность товара.",
    gift: "Подчеркни пригодность в подарок.",
    home: "Покажи уместность товара в домашней сцене.",
    office: "Покажи уместность товара в офисном контексте.",
    sport: "Покажи уместность товара в спортивном сценарии.",
    kitchen: "Покажи уместность товара для кухни.",
  };
  return accents[benefitId] ?? null;
}

/** Инструкция «что должно быть видимо» (визуал, необязательно отдельные подписи). */
export function mustShowVisualAccentRu(id: string): string | null {
  const map: Record<string, string> = {
    texture: "Обязательно визуально покажи фактуру и текстуру поверхности.",
    scale: "Обязательно визуально покажи масштаб товара (реалистичный размер относительно сцены/руки/реквизита).",
    usage: "Обязательно визуально покажи типичное использование товара в сцене.",
    packaging: "Обязательно визуально покажи упаковку / комплект, если это видно по референсу; не выдумывай состав.",
    details: "Обязательно визуально подчеркни важные детали товара.",
    color: "Визуально подчеркни цвет материала; не искажай относительно референса.",
    brand_style:
      "Придерживайся брендовой визуальной подачи, опирайся на исходник; не придумывай новые логотипы и марки.",
  };
  return map[id] ?? null;
}

/** Строки для блока точного текста + проверки длины и числа фраз. Без семантических чекбоксов и must-show. */
export function collectExactTextPhrases(input: {
  productTitle?: string | null;
  subtitle?: string | null;
  additionalBenefits?: string | null;
  dimensions?: string | null;
  slideRole: string;
  /** Глобальная плотность текста (после оверрайда площадки для main_photo уже учтён во входе). */
  textDensity: string;
  /** Если true — не включаем пользовательские фразы для bitmap-текста (главное фото без текста по правилам площадки). */
  omitUserLockedText?: boolean;
  lockedCategoryPhrases?: readonly string[];
}): {
  phrases: string[];
  validationErrors: string[];
} {
  const errors: string[] = [];
  const raw: string[] = [];
  const density = input.textDensity.trim();
  const showCardTextLayer = density !== "none";

  /** Размеры — locked только когда пользователь дал текст; на слайде «размеры» переносим даже при иной плотности. */
  const includeDimensions =
    !input.omitUserLockedText &&
    Boolean(stripHtmlFragments(input.dimensions?.trim() ?? "")) &&
    (showCardTextLayer || input.slideRole === "dimensions");

  if (!input.omitUserLockedText) {
    if (showCardTextLayer) {
      const t = stripHtmlFragments(input.productTitle?.trim() ?? "");
      if (t) raw.push(t);

      const st = stripHtmlFragments(input.subtitle?.trim() ?? "");
      if (st) raw.push(st);
    }

    const extra = input.additionalBenefits?.trim() ?? "";
    if (showCardTextLayer && extra) {
      for (const part of extra.split(/\r?\n/)) {
        const x = stripHtmlFragments(part);
        if (x) raw.push(x);
      }
    }

    if (includeDimensions) {
      const dim = stripHtmlFragments(input.dimensions?.trim() ?? "");
      if (dim) raw.push(dim);
    }

    const allowCatLocked = showCardTextLayer || input.slideRole === "dimensions";
    if (allowCatLocked) {
      for (const line of input.lockedCategoryPhrases ?? []) {
        const x = stripHtmlFragments(line.trim());
        if (x) raw.push(x);
      }
    }
  }

  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const x of raw) {
    const p = x.trim();
    if (!p) continue;
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    phrases.push(p);
  }

  if (phrases.length > MAX_PHRASES) {
    errors.push(
      `Слишком много текстовых фраз для одного слайда (максимум ${MAX_PHRASES}). Сократите название, подзаголовок, «Дополнительные преимущества», размеры, поля категории или другие текстовые вводы.`,
    );
  }

  phrases.forEach((p, i) => {
    if (p.length > MAX_PHRASE_LEN) {
      errors.push(
        `Фраза ${i + 1} длиннее ${MAX_PHRASE_LEN} символов (${p.length}). Сократите текст: «${p.slice(0, 40)}…»`,
      );
    }
  });

  return {
    phrases,
    validationErrors: errors,
  };
}

/** Конкатенация только пользовательского текста для модерации (длина/запреты без системного super prompt). */
export function joinUserDerivedTextForCardBuilderModeration(input: {
  productTitle?: string | null;
  subtitle?: string | null;
  semanticBenefitIds: string[];
  additionalBenefits?: string | null;
  mustShowIds: string[];
  dimensions?: string | null;
  categoryFactsPlain?: string | null;
}): string {
  const parts: string[] = [];
  const t = stripHtmlFragments(input.productTitle?.trim() ?? "");
  if (t) parts.push(t);
  const st = stripHtmlFragments(input.subtitle?.trim() ?? "");
  if (st) parts.push(st);
  const extra = input.additionalBenefits?.trim() ?? "";
  if (extra) {
    for (const part of extra.split(/\r?\n/)) {
      const x = stripHtmlFragments(part);
      if (x) parts.push(x);
    }
  }
  const dim = stripHtmlFragments(input.dimensions?.trim() ?? "");
  if (dim) parts.push(dim);
  const catp = stripHtmlFragments(input.categoryFactsPlain?.trim() ?? "");
  if (catp) parts.push(`Данные из полей категории пользователя:\n${catp}`);

  const accentLines = input.semanticBenefitIds
    .map((id) => semanticBenefitAccentRu(id))
    .filter((x): x is string => Boolean(x));
  if (accentLines.length) {
    parts.push(`Смысловые акценты мастера (не дословный текст карточки):\n${accentLines.join("\n")}`);
  }

  const showLines = input.mustShowIds
    .map((id) => mustShowVisualAccentRu(id))
    .filter((x): x is string => Boolean(x));
  if (showLines.length) {
    parts.push(`Визуальные требования мастера:\n${showLines.join("\n")}`);
  }

  return parts.join("\n\n").trim();
}

/** Тексты для режима языка при `auto`: заголовок, подзаголовок, строки клиента из textarea, размеры. */
export function collectLanguageProbePhrases(input: {
  productTitle?: string | null;
  subtitle?: string | null;
  additionalBenefits?: string | null;
  dimensions?: string | null;
  categoryPlain?: string | null;
}): string[] {
  const raw: string[] = [];
  const t = stripHtmlFragments(input.productTitle?.trim() ?? "");
  if (t) raw.push(t);
  const st = stripHtmlFragments(input.subtitle?.trim() ?? "");
  if (st) raw.push(st);
  const extra = input.additionalBenefits?.trim() ?? "";
  if (extra) {
    for (const part of extra.split(/\r?\n/)) {
      const x = stripHtmlFragments(part);
      if (x) raw.push(x);
    }
  }
  const dim = stripHtmlFragments(input.dimensions?.trim() ?? "");
  if (dim) raw.push(dim);
  const catp = stripHtmlFragments(input.categoryPlain?.trim() ?? "");
  if (catp) raw.push(catp);
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const x of raw) {
    const p = x.trim();
    if (!p) continue;
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    phrases.push(p);
  }
  return phrases;
}

export function getSlideRoleInstruction(slideRole: string, templateId?: string): string {
  const cmp =
    templateId === "comparison_card"
      ? "\nСравнение преимуществ: не делай ложных сравнений с конкурентами; только безопасные формулировки из фраз пользователя."
      : "";

  const flexRu =
    "Главное: визуал (плашки, иконки, фон, композиция, цвет) можно менять; текст клиента — locked copy, не менять содержимое.";
  const flexEn =
    "You may change visual design (badges, icons, background, layout, colors); user text is locked copy — do not change text content.";

  switch (slideRole) {
    case "main_photo":
      return [
        flexEn,
        flexRu,
        "Слайд: главное фото товара.",
        "Товар крупно, читаемый силуэт, чистый фон.",
        "По умолчанию без текста на карточке; если в списке locked phrases есть заголовок/название — воспроизведи его буква в букву.",
        "Если плотность текста «без текста» и нет пользовательских фраз — не добавляй подписи.",
      ].join("\n");
    case "benefits_infographic":
      return [
        flexEn,
        flexRu,
        "Слайд: инфографика с преимуществами.",
        "Можно менять дизайн плашек, иконки, их расположение и стиль.",
        "Нельзя менять текст преимуществ — только точные фразы пользователя из locked list.",
        "Товар должен оставаться хорошо видимым; сами буквы в фразах — как у клиента.",
        cmp,
      ]
        .filter(Boolean)
        .join("\n");
    case "materials":
      return [
        flexEn,
        flexRu,
        "Слайд: материалы и качество.",
        "Можно усиливать визуальный акцент на фактуру, свет, кадрирование; можно менять форму и стиль плашек.",
        "Нельзя менять текст про материал — только locked phrases клиента.",
      ].join("\n");
    case "dimensions":
      return [
        flexEn,
        flexRu,
        "Слайд: размеры, масштаб и характеристики.",
        "Можно менять схему, композицию, визуальное оформление шкал и подписей-контейнеров.",
        "Нельзя выдумывать размеры и цифры; нельзя менять числа и единицы, если пользователь указал их во фразах.",
      ].join("\n");
    case "lifestyle":
      return [
        flexEn,
        flexRu,
        "Слайд: товар в использовании.",
        "Можно менять сцену, фон, освещение, настроение кадра.",
        "Если есть пользовательский текст во фразах — сохрани его точно; не добавляй другой текст.",
      ].join("\n");
    case "premium_poster":
      return [
        flexEn,
        flexRu,
        "Слайд: премиальный рекламный постер.",
        "Можно менять премиальный стиль, свет, декор, композицию.",
        "Нельзя менять заголовок/слоган — только точные locked phrases; товар — главный объект.",
      ].join("\n");
    case "ad_banner":
      return [
        flexEn,
        flexRu,
        "Слайд: рекламный баннер.",
        "Можно менять динамику, цветовую схему, акценты, композицию.",
        "Текст на баннере — только locked phrases пользователя.",
      ].join("\n");
    case "packaging":
      return [
        flexEn,
        flexRu,
        "Слайд: упаковка, комплект, содержимое.",
        "Можно менять подачу, фон, композицию кадра.",
        "Не придумывай состав комплекта; текст — только locked phrases.",
      ].join("\n");
    case "detail_closeup":
      return [
        flexEn,
        flexRu,
        "Слайд: крупный план детали или интерфейса.",
        "Можно менять свет, угол, визуальное оформление выносок и плашек.",
        "Текст — только locked phrases; не подменяй символы.",
      ].join("\n");
    default:
      return [
        flexEn,
        flexRu,
        `Слайд (роль ${slideRole}): коммерческий кадр; товар узнаваем; дизайн гибкий, текст клиента неизменяем.`,
      ].join("\n");
  }
}

/** Уточнение промпта по конкретному templateId внутри роли слайда. */
export function getTemplateInstruction(templateId: string): string {
  const m: Record<string, string> = {
    texture_closeup:
      "Покажи фактуру, материал, поверхность и важные детали крупным планом. Не выдумывай свойства материала.",
    fabric_closeup:
      "Покажи ткань, швы, фактуру, посадку или фурнитуру. Не выдумывай состав ткани.",
    interface_detail:
      "Покажи экран, кнопку, разъём, панель управления или техническую деталь. Не выдумывай функции и характеристики.",
    feature_callouts:
      "Покажи функции товара через аккуратные выноски. Используй только функции, указанные пользователем в locked phrases или явных формулировках.",
    ingredients_effect:
      "Покажи состав или эффект только если пользователь указал эти данные в тексте. Не делать медицинские или лечебные обещания; не добавлять БЖУ и health claims без исходного текста.",
    fashion_catalog:
      "Сделай fashion/catalog карточку без тяжёлой инфографики, с акцентом на внешний вид, посадку и материал.",
    interior_lifestyle:
      "Товар в реалистичном интерьерном контексте; без перегруженных маркетплейсных табло и лишней инфографики.",
    hero_clean:
      "Чистый каталожный кадр: товар узнаваем, фон спокойный; не добавляй рекламные утверждения без locked phrases.",
    realistic_listing:
      "Реалистичное фото объявления без глянцевой рекламы и перегруженной инфографики.",
    premium_poster:
      "Премиальный рекламный слайд без замены SKU; не добавляй неподтверждённые claims вне точного текста пользователя.",
    ad_banner:
      "Рекламный баннер с сильной композицией; используй только текст и свойства, указанные пользователем в locked phrases.",
    dimensions_schema:
      "Размеры и габариты только если пользователь указал их в форме или locked phrases; не выдумывай миллиметры, дюймы и схемы с цифрами.",
    size_scale:
      "Покажи масштаб товара визуально; без точных цифр, если пользователь не указал размеры в тексте формы.",
    size_range:
      "Размерный ряд — только если пользователь дал текстовые размеры или locked phrases с ними; не придумывай SKU/размерную сетку.",
    lifestyle_card:
      "Естественный lifestyle: сцена поддерживает товар без выдуманных свойств продукта.",
    material_focus:
      "Акцент на материале и качестве; не добавляй химический состав или характеристики без пользовательского текста.",
    package_card:
      "Упаковка и комплект честно по референсу; не придумывай состав, объём и маркировку без исходного текста.",
    benefits_grid:
      "Инфографика преимуществ только по locked phrases клиента.",
    comparison_card:
      "Сравнение и коллауты только по известным фактам пользователя.",
    protection_features:
      "Акцент на защитных свойствах кратко; без технических параметров без текста клиента.",
  };
  return (m[templateId.trim()] ?? "").trim();
}

export function getMarketplaceInstruction(marketplace: string): string {
  const id = marketplace.trim();
  if (id === "ozon" || id === "wildberries" || id === "yandex_market") {
    return [
      "Площадка: классический маркетплейс РФ.",
      "Чистый коммерческий дизайн; хорошо читаемый товар; минимум визуального шума;",
      "понятные плашки преимуществ; результат должен быть пригоден для карточки маркетплейса.",
    ].join("\n");
  }
  if (id === "instagram_vk") {
    return [
      "Площадка: соцсети (Instagram / VK).",
      "Допустим более lifestyle/editorial или рекламный визуал при сохранении читаемости товара.",
    ].join("\n");
  }
  if (id === "avito") {
    return [
      "Площадка: объявления (Avito).",
      "Больше реализма и доверия; избытка «глянца» избегать; честная подача товара.",
    ].join("\n");
  }
  if (id === "amazon" || id === "shopify") {
    return [
      "Площадка: международный e-commerce.",
      "Чистый ecommerce-стиль; аккуратная типографика; без перегруза декором.",
    ].join("\n");
  }
  const label = CARD_BUILDER_MARKETPLACES.find((m) => m.id === id)?.label ?? id;
  return `Площадка: ${label}. Сохраняй универсально пригодный коммерческий вид карточки.`;
}

export function getSalesStyleInstruction(salesStyle: string): string {
  const id = salesStyle.trim();
  const label = CARD_BUILDER_SALES_STYLES.find((s) => s.id === id)?.label ?? id;
  const blocks: Record<string, string> = {
    clean_catalog: [
      "Стиль: чистый каталог.",
      "Белый/светлый фон, ровная композиция, минимум декора.",
    ].join("\n"),
    light_marketplace: [
      "Стиль: светлый маркетплейс.",
      "Светлый фон, понятные плашки, уверенный коммерческий вид.",
    ].join("\n"),
    premium: [
      "Стиль: премиум.",
      "Дорогой визуал, качественный свет, аккуратная типографика.",
    ].join("\n"),
    cozy_lifestyle: [
      "Стиль: уютный lifestyle.",
      "Тёплая сцена, естественное использование, мягкий свет.",
    ].join("\n"),
    minimalism: [
      "Стиль: минимализм.",
      "Много воздуха, простая композиция, мало отвлекающих деталей.",
    ].join("\n"),
    bold_ad: [
      "Стиль: яркая реклама.",
      "Насыщенный визуал и сильный акцент без визуального перегруза.",
    ].join("\n"),
    infographic: [
      "Стиль: инфографика.",
      "Визуально: плашки, иконки, выноски, сетка — адаптируй под стиль; символы текста только из locked phrases пользователя.",
    ].join("\n"),
    editorial: [
      "Стиль: editorial.",
      "Журнальная композиция, премиальный кадрирование.",
    ].join("\n"),
  };
  return (blocks[id] ?? `Стиль продаж: ${label}.`).trim();
}

export function getTextDensityInstruction(textDensity: string): string {
  const id = textDensity.trim();
  const label = CARD_BUILDER_TEXT_DENSITY.find((t) => t.id === id)?.label ?? id;
  const lock = "Все читаемые слова на кадре — только из locked phrases; не добавляй другой маркетинговый текст.";
  const body: Record<string, string> = {
    none: `Плотность текста: без текста — не добавляй заголовков и плашек. ${lock}`,
    minimal: `Плотность текста: минимум — не больше одной короткой строки из locked phrases. ${lock}`,
    medium: `Плотность текста: средне — заголовок и несколько ключевых тезисов только из locked phrases (ориентир: несколько плашек). ${lock}`,
    heavy: `Плотность текста: высокая — заголовок, 3–5 преимуществ и характеристики только из locked phrases («много текста», без собственных формулировок). ${lock}`,
    infographic: `Плотность текста: инфографика — плашки, иконки, выноски; текст только из locked phrases. ${lock}`,
  };
  return body[id] ?? `Плотность текста: ${label}. ${lock}`;
}

function inputImagesRolesBlock(productImageCount: number, styleReferenceCount: number): string {
  const p = Math.max(0, Math.floor(productImageCount));
  const s = Math.max(0, Math.floor(styleReferenceCount));
  const lines: string[] = [
    "=== 2a) INPUT_IMAGES_ROLES ===",
    "Роли входных изображений (смысл сохраняй даже если провайдер передаёт их одним списком URL).",
  ];
  if (p > 0) {
    lines.push(
      `Первые входные кадры (${p}) — фото товара: основной источник идентичности SKU.`,
      "Используй как источник формы, цвета товара, логотипа на товаре, пропорций и важных деталей продукта.",
    );
  }
  if (s > 0) {
    lines.push(
      `Отдельные кадры (${s}) — референс визуального стиля карточки.`,
      "Используй только как style guide (композиция макета, фон, цветовая логика, характер плашек, характер типографики без переписывания текста, иконки/выноски, mood).",
      "НЕ переносить с референса: чужой товар, логотипы и бренды, читаемый текст, маркировку, водяные знаки.",
      "Референс не задаёт факты о товаре, размеры, комплектацию или характеристики.",
    );
  }
  if (p === 0 && s === 0) {
    lines.push("Явное разделение кадров недоступно в промпте — следуй политике провайдера и блокам ниже.");
  }
  return lines.join("\n");
}

function styleReferenceInstructionBlock(
  plan: CardBuilderStyleReferencePlan | null | undefined,
  styleReferenceCount: number,
): string {
  if (!plan?.enabled || styleReferenceCount <= 0) return "";

  const strength = plan.strength ?? "medium";
  const strengthRu =
    strength === "low"
      ? "Сила влияния: низкая — в целом настроение, цвета и характер фона; layout не копируй слишком близко."
      : strength === "high"
        ? "Сила влияния: высокая — сильно ориентируйся на композицию и стиль референса, но без копирования содержимого и без подмены товара."
        : "Сила влияния: средняя — композиция, логика блоков, плашки, цветовая схема и характер типографики без пиксельного копирования.";

  const take: string[] = [];
  if (plan.useComposition) take.push("композицию и сетку");
  if (plan.useBackground) take.push("фон");
  if (plan.useColors) take.push("цветовую гамму");
  if (plan.useTypography) take.push("характер типографики (не формулировки текста)");
  if (plan.useBadges) take.push("стиль плашек");
  if (plan.useIcons) take.push("иконки и выноски");
  if (plan.useMood) take.push("атмосферу / mood");
  if (plan.useOverallPresentation) take.push("общую подачу");

  const takeLine =
    take.length > 0
      ? `Разрешено использовать из референса (только стиль, без чужого текста и товара): ${take.join("; ")}.`
      : "Конкретные аспекты не отмечены — используй референс как мягкий общий ориентир.";

  return [
    "=== 4r) STYLE_REFERENCE ===",
    "STYLE_REFERENCE:",
    "Референс — только источник стиля оформления, не источник фактов о SKU.",
    strengthRu,
    takeLine,
    "Товар на выходе = товар с фото товара; русский и казахский locked-текст пользователя не изменять.",
    "Не копируй чужие логотипы, бренды и водяные знаки с референса.",
  ].join("\n");
}

function roleBlock(): string {
  return [
    "=== 1) ROLE ===",
    "You are a professional marketplace product-card designer.",
    "Ты профессиональный дизайнер маркетплейсных карточек товара.",
    "Создай коммерчески полезный слайд под выбранную площадку.",
    "Изображение должно выглядеть как готовый дизайн карточки, а не случайная AI-картинка.",
  ].join("\n\n");
}

function designFlexibilityWithTextLockBlock(): string {
  return [
    "=== 7) DESIGN_FLEXIBILITY_WITH_TEXT_LOCK ===",
    `DESIGN_FLEXIBILITY_WITH_TEXT_LOCK:

You may freely improve the visual design of the card:
- change badge shapes;
- choose better icons;
- improve composition;
- improve background;
- improve colors;
- improve lighting;
- improve spacing;
- improve typography style;
- adapt the design to the selected marketplace and sales style.

However, the written text provided by the user is LOCKED COPY.
Do not modify the text content in any way.

The design is flexible.
The text content is immutable.`,
    `Ты можешь менять визуальный дизайн карточки:
- форму плашек;
- иконки;
- фон;
- цвета;
- композицию;
- расположение блоков;
- декоративные элементы;
- стиль карточки;
- освещение;
- визуальную подачу под выбранный маркетплейс и стиль.

Но текст клиента является неизменяемым.
Нельзя менять содержимое текста ни при каких условиях.

Дизайн можно адаптировать.
Текст менять нельзя.`,
  ].join("\n\n");
}

function criticalExactTextLockBlock(): string {
  return [
    "=== 8) CRITICAL_EXACT_TEXT_LOCK ===",
    `CRITICAL EXACT TEXT RULE:
The following phrases are immutable locked text.
Render them exactly as written.
Do not translate.
Do not paraphrase.
Do not summarize.
Do not correct spelling.
Do not improve grammar.
Do not change capitalization.
Do not change punctuation.
Do not change word order.
Do not remove words.
Do not add words inside the phrases.
Do not replace Cyrillic letters with similar-looking Latin letters.
Do not replace Kazakh letters with Russian alternatives.
Do not use pseudo-text, fake letters, gibberish, or decorative nonsense text.
Do not create approximate text.
Do not create visually similar text.
Use the exact same characters.

If you cannot render the exact phrase clearly, leave more space for it, but do not rewrite it.`,
    `КРИТИЧЕСКОЕ ПРАВИЛО ТОЧНОГО ТЕКСТА:
Следующие фразы — неизменяемый текст клиента.
Размести их точно как написано.

Нельзя переводить.
Нельзя перефразировать.
Нельзя сокращать.
Нельзя исправлять орфографию.
Нельзя улучшать грамматику.
Нельзя менять регистр букв.
Нельзя менять знаки препинания.
Нельзя менять порядок слов.
Нельзя удалять слова.
Нельзя добавлять слова внутрь фраз.
Нельзя заменять кириллицу похожими латинскими буквами.
Нельзя заменять казахские буквы русскими аналогами.
Нельзя использовать псевдотекст, бессмысленные буквы или декоративные надписи.
Нельзя делать приблизительно похожий текст.
Нужно использовать ровно те же символы.

Если фразу трудно разместить, увеличь место под неё, но не переписывай её.`,
  ].join("\n\n");
}

function kazakhPreservationBlock(): string {
  return [
    "Kazakh text preservation:",
    `Kazakh Cyrillic letters must be preserved exactly:
Ә ә, Ғ ғ, Қ қ, Ң ң, Ө ө, Ұ ұ, Ү ү, Һ һ, І і.

Do not replace:
Қ with К
Ғ with Г
Ң with Н
Ө with О
Ұ with У
Ү with У
І with И
Ә with А
Һ with Х

Do not transliterate Kazakh text into Latin.
Do not translate Kazakh text into Russian or English.
Do not normalize Kazakh letters into Russian Cyrillic.`,
    `Сохранение казахского текста:
Казахские буквы должны быть сохранены точно:
Ә ә, Ғ ғ, Қ қ, Ң ң, Ө ө, Ұ ұ, Ү ү, Һ һ, І і.

Нельзя заменять:
Қ на К
Ғ на Г
Ң на Н
Ө на О
Ұ на У
Ү на У
І на И
Ә на А
Һ на Х

Нельзя транслитерировать казахский текст латиницей.
Нельзя переводить казахский текст на русский или английский.
Нельзя нормализовать казахские буквы в русскую кириллицу.`,
  ].join("\n\n");
}

function russianPreservationBlock(): string {
  return [
    "Russian text preservation:",
    `Preserve Russian Cyrillic exactly.
Do not translate Russian text into English, Kazakh, or any other language.
Do not rewrite Russian text.
Do not replace Ё/ё unless the user wrote it that way.
Do not replace Russian letters with Latin lookalikes.`,
    `Сохранение русского текста:
Сохраняй русскую кириллицу точно.
Не переводи русский текст на английский, казахский или другие языки.
Не переписывай русский текст.
Не подменяй Ё/ё, если пользователь написал иначе.
Не заменяй русские буквы похожими латинскими символами.`,
  ].join("\n\n");
}

function lockedTextPhrasesSection(phrases: string[]): string {
  if (phrases.length === 0) {
    return [
      "=== 10) LOCKED_TEXT_PHRASES ===",
      "The user did not supply separate on-card text phrases for this slide.",
      "Do not invent marketing copy, specs, or benefits as readable text.",
      "Пользователь не передал отдельные фразы — не выдумывай читаемые подписи и характеристики.",
    ].join("\n\n");
  }
  const enLines = ["LOCKED TEXT PHRASES TO PLACE ON THE CARD:", ...phrases.map((p, i) => `${i + 1}. "${p}"`)];
  const ruLines = ["НЕИЗМЕНЯЕМЫЕ ФРАЗЫ ДЛЯ РАЗМЕЩЕНИЯ НА КАРТОЧКЕ:", ...phrases.map((p, i) => `${i + 1}. «${p}»`)];
  return ["=== 10) LOCKED_TEXT_PHRASES ===", enLines.join("\n"), "", ruLines.join("\n")].join("\n\n");
}

function languagePreservationSection(
  probePhrases: string[],
  mode: CardBuilderSuperPromptLanguageMode,
): string {
  const det = detectTextLanguageMode(probePhrases);
  const chunks: string[] = ["=== 9) LANGUAGE_PRESERVATION (RU / KK) ==="];

  const mixedScripts =
    (det.hasLatin && det.hasCyrillic) || (det.hasLatin && det.hasKazakhLetters);

  const pushMixed = () =>
    chunks.push(
      "Mixed scripts / languages: keep each phrase exactly as the user wrote; do not translate or substitute letters.",
      "Смесь языков и алфавитов: сохраняй каждую фразу как у пользователя, без перевода и без подмены букв.",
    );

  if (mode === "kk") {
    chunks.push(kazakhPreservationBlock());
    if (det.hasCyrillic) chunks.push(russianPreservationBlock());
  } else if (mode === "ru") {
    chunks.push(russianPreservationBlock());
    if (det.hasKazakhLetters) chunks.push(kazakhPreservationBlock());
  } else if (mode === "mixed") {
    pushMixed();
    if (det.hasKazakhLetters) chunks.push(kazakhPreservationBlock());
    if (det.hasCyrillic) chunks.push(russianPreservationBlock());
  } else {
    // auto — по тексту пользователя из названия, подзаголовка, строк из textarea и размеров
    if (det.hasKazakhLetters) chunks.push(kazakhPreservationBlock());
    if (det.hasCyrillic) chunks.push(russianPreservationBlock());
    if (mixedScripts) pushMixed();
  }

  if (chunks.length === 1) {
    chunks.push(
      "If Cyrillic, Kazakh-specific Cyrillic letters, or Latin appear in locked phrases, preserve characters exactly; do not substitute homoglyphs.",
      "При наличии букв в locked phrases сохраняй их ровно; не подменяй похожими символами.",
    );
  }
  return chunks.filter(Boolean).join("\n\n");
}

function negativeInstructionsBlock(
  marketplaceProfile?: ProductCardMarketplaceProfile | null,
): string {
  const core = [
    "=== 11) NEGATIVE_INSTRUCTIONS ===",
    "НЕ добавляй водяные знаки.",
    "НЕ добавляй случайные чужие бренды.",
    "НЕ добавляй нечитаемый мелкий текст и псевдо-буквы.",
    "НЕ искажай товар и НЕ меняй логотип.",
    "НЕ выдумывай размеры, цифры габаритов, сертификаты и характеристики: если пользователь их не указал в locked phrases / не передал текстом — не добавляй.",
    "НЕ добавляй медицинские или юридические заявления, если пользователь их не указывал.",
  ];
  const p = marketplaceProfile;
  if (p?.avoidWatermarks) {
    core.push("Строже для площадки: никаких водяных знаков.");
  }
  if (p?.avoidExtraObjects) {
    core.push("Избегай лишних предметов в кадре, которых нет в комплекте товара.");
  }
  if (p?.avoidLogos) {
    core.push("Не добавляй логотипы магазина, торговые марки кроме бренда товара, если это есть на исходнике от пользователя.");
  }
  if (p?.avoidPriceLabels) {
    core.push("Не добавляй ценники, скидочные проценты и промо-бейджи с ценой.");
  }
  if (p?.avoidContacts) {
    core.push("Не добавляй контакты, телефоны, мессенджеры, сайты или QR со ссылками.");
  }
  return core.join("\n");
}

function categoryLabel(categoryId: string): string {
  const row = PRODUCT_CATEGORY_GROUPS.find((c) => c.id === categoryId.trim());
  return row?.label?.trim() ? row.label.trim() : categoryId.trim();
}

function productIdentityLockSection(input: CardBuilderSuperPromptInput): string {
  const aspects = [...(input.preserveAspects ?? [])].filter(Boolean);
  const aspectLines = aspects
    .map((id) => {
      const row = CARD_BUILDER_PRESERVE_ASPECTS.find((a) => a.id === id);
      if (!row) return null;
      return `— ${row.label}: сохранить без искажений по референсу.`;
    })
    .filter((x): x is string => Boolean(x));

  let preserveBlock: string;
  if (!input.preserveProduct) {
    preserveBlock =
      "PRODUCT_IDENTITY_SOFT: держи SKU узнаваемым; можно мягко менять сцену и свет, но не подменяй товар на другой объект.";
  } else if (aspectLines.length > 0) {
    preserveBlock = [
      "PRODUCT_IDENTITY_LOCK (фиксированные аспекты товара из настроек клиента):",
      "Сохрани товар неизменным по перечисленным аспектам; не добавляй случайных новых деталей к самому продукту.",
      ...aspectLines,
      "Не искажай маркировку/бренд так, как он виден на исходном фото.",
    ].join("\n");
  } else {
    preserveBlock = [
      "PRODUCT_IDENTITY_LOCK:",
      "Без отдельных чекбоксов аспектов: сохраняй товар целиком — форму, цвет, материал, логотип (если есть на референсе), пропорции, упаковку и важные детали.",
      "Не заменяй на другой SKU.",
    ].join("\n");
  }

  const creativeNote =
    input.preserveProduct === true && input.allowCreativeStylization === true
      ? [
          "CREATIVE_SCENE_STYLIZATION:",
          "Допускается свободная смена фона, общей стилистики сцены, света и композиции вокруг товара для сильной карточки.",
          "Запрещено нарушать замки идентичности товара выше: закреплённые аспекты (и в целом сам продукт) не переиначивать.",
        ].join("\n\n")
      : "";

  const sourceNote =
    input.sourceImageMode === "variant"
      ? "Исходное фото можно интерпретировать как референс сцены; товар не заменять."
      : "Опирайся на загруженные фото товара как на референс идентичности SKU.";

  const cat = categoryLabel(input.selectedCategory);
  const mp = input.marketplaceProfile ?? undefined;
  const mpStrict =
    mp?.preserveProductRequired && input.preserveProduct
      ? "Требование площадки: усиленно сохранять идентичность товара (форму, цвет, упаковку, логотип), без замены SKU."
      : "";

  const goalNote = input.goal?.trim()
    ? `Задача галереи (контекст, не добавлять новый маркетинговый текст помимо locked phrases): ${input.goal}.`
    : "";

  return [
    "=== 2) PRODUCT_IDENTITY_LOCK ===",
    `Категория товара (не придумывать другой продукт): ${cat}.`,
    preserveBlock,
    creativeNote,
    mpStrict,
    sourceNote,
    goalNote,
  ]
    .filter((x) => x && String(x).trim() !== "")
    .join("\n\n");
}

function audienceSceneMoodBlock(audience?: string): string {
  if (!audience?.trim()) return "";
  const label = CARD_BUILDER_AUDIENCES.find((a) => a.id === audience)?.label ?? audience;
  return [
    "Аудитория задаёт сцену и настроение (lifestyle, возрастная подача, настроение света).",
    `Целевая аудитория для кадра: ${label}.`,
    "Audience drives scene/mood; avoid inventing slogan text not present in locked phrases.",
  ].join("\n");
}

function priceSegmentVisualBlock(segment?: string): string {
  if (!segment?.trim()) return "";
  const id = segment.trim();
  const label = CARD_BUILDER_PRICE_SEGMENTS.find((p) => p.id === id)?.label ?? segment;
  const body: Record<string, string> = {
    economy: "Ценовой сегмент: эконом — просто, честно и понятно, без перегруза «люксом».",
    middle: "Ценовой сегмент: средний — чистый маркетплейс, доверительный и структурированный кадр.",
    premium: "Ценовой сегмент: премиум — дорогой коммерческий визуал, выверенный свет и аккуратная графическая дисциплина.",
    luxury: "Ценовой сегмент: люкс — editorial/журнальный уровень подачи при сохранении честной идентичности товара.",
  };
  return body[id] ?? `Ценовое позиционирование визуала: ${label}.`;
}

function semanticSellingAccentsSection(benefitIds: string[]): string {
  const lines = benefitIds
    .map((id) => semanticBenefitAccentRu(id))
    .filter((x): x is string => Boolean(x));
  if (!lines.length) return "";
  return [
    "=== 4b) SEMANTIC_SELLING_ACCENTS ===",
    "Смысловые акценты мастера для визуальной иерархии. Это не текст плашек и не «locked copy».",
    "Use as creative direction only; wording must not replace exact user phrases.",
    ...lines.map((l) => `— ${l}`),
  ].join("\n\n");
}

function mustShowVisualRequirementsSection(mustShowIds: string[]): string {
  const lines = mustShowIds
    .map((id) => mustShowVisualAccentRu(id))
    .filter((x): x is string => Boolean(x));
  if (!lines.length) return "";
  return [
    "=== 4c) MUST_SHOW_VISUAL ===",
    "Визуальные must-show: что обязательно читабельно показать глазами (фактура, масштаб, сценарий и т.д.).",
    "Это не синоним текста на карточке — читаемые строки только из locked phrases.",
    ...lines.map((l) => `— ${l}`),
  ].join("\n\n");
}
function marketplacePromptBody(
  marketplaceId: string,
  slideRole: string,
  profile?: ProductCardMarketplaceProfile | null,
): string {
  const headline = profile?.promptInstruction?.trim()
    ? profile.promptInstruction.trim()
    : getMarketplaceInstruction(marketplaceId);

  let focus = "";
  if (profile) {
    if (slideRole === "main_photo") focus = profile.mainPhotoRules.promptInstruction.trim();
    else if (slideRole === "benefits_infographic") {
      focus = profile.infographicRules.promptInstruction.trim();
    } else if (slideRole === "lifestyle") {
      focus = profile.lifestyleRules.promptInstruction.trim();
    }
  }

  const hintLines =
    profile?.complianceHints?.length && profile.complianceHints.length > 0
      ? `\nОриентиры соответствия площадке:\n${profile.complianceHints
          .slice(0, 7)
          .map((x) => `— ${x}`)
          .join("\n")}`
      : "";

  return [headline, focus ? `\nФокус этого слайда:\n${focus}` : "", hintLines].join("");
}

/** Собирает супер-промпт для Kie: card_builder, текст встроен в дизайн моделью. */
export function buildCardBuilderSuperPrompt(input: CardBuilderSuperPromptInput): CardBuilderSuperPromptResult {
  const profile = input.marketplaceProfile ?? null;
  const mainPhotoLocksText =
    input.slideRole === "main_photo" && profile ? !profile.mainPhotoTextAllowed : false;

  const catPlan: CardBuilderPlanWithCategoryFields = {
    selectedCategory: input.selectedCategory,
    dimensions: input.dimensions,
    categoryFields: input.categoryFields,
    categoryFieldsByCategory: input.categoryFieldsByCategory,
  };

  const effDimLine = effectiveDimensionsForOverlay(catPlan);
  const dimsForLockedPhrases =
    input.slideRole === "dimensions" && !hasMeasuresFromCategoryPlan(catPlan)
      ? undefined
      : effDimLine || input.dimensions;

  const lockedCatLines = lockedCategoryLabelsForSlideRole(
    input.slideRole as CardBuilderTemplateSlideRole,
    catPlan,
  );

  const { phrases, validationErrors } = collectExactTextPhrases({
    productTitle: input.productTitle,
    subtitle: input.subtitle,
    additionalBenefits: input.additionalBenefits,
    dimensions: dimsForLockedPhrases,
    slideRole: input.slideRole,
    textDensity: input.textDensity ?? "medium",
    omitUserLockedText: mainPhotoLocksText,
    lockedCategoryPhrases: lockedCatLines,
  });

  if (validationErrors.length > 0) {
    return { ok: false, validationErrors };
  }

  const languageMode: CardBuilderSuperPromptLanguageMode = input.languageMode ?? "auto";
  const languageProbePhrases = collectLanguageProbePhrases({
    productTitle: input.productTitle,
    subtitle: input.subtitle,
    additionalBenefits: input.additionalBenefits,
    dimensions: dimsForLockedPhrases,
    categoryPlain: categoryFieldsPlainForPlanner(catPlan),
  });

  const layoutNote =
    input.templateId || input.layoutPreset
      ? `Логическая схема слайда (только композиция; не выводить как отдельную этикетку): templateId=${input.templateId ?? "—"}, layoutPreset=${input.layoutPreset ?? "—"}.`
      : "";

  const marketplaceInner = marketplacePromptBody(input.marketplace, input.slideRole, profile);
  const marketplaceBlock = ["=== 3) MARKETPLACE_INSTRUCTION ===", marketplaceInner].join("\n\n");

  const templateSpecific = input.templateId ? getTemplateInstruction(input.templateId) : "";

  const slideRoleBlock = [
    "=== 4) SLIDE_ROLE_INSTRUCTION ===",
    getSlideRoleInstruction(input.slideRole, input.templateId),
  ].join("\n\n");

  const templateInstructionBlock =
    templateSpecific.length > 0
      ? [`=== 4d) TEMPLATE_SPECIFIC (${input.templateId}) ===`, templateSpecific].join("\n\n")
      : "";

  const accentsBlock = semanticSellingAccentsSection(input.benefits ?? []);
  const mustShowBlock = mustShowVisualRequirementsSection(input.mustShow ?? []);

  const cfSafety = getCategoryFieldsSafetyBullets(input.selectedCategory);
  const cfPolicyBlock =
    cfSafety.length > 0 || lockedCatLines.length > 0
      ? [
          "=== 4e) CATEGORY_USER_FACTS ===",
          "Тексты из полей категории клиент заполнил сам; пустые поля не восстанавливать и не выдумывать.",
          ...(cfSafety.length
            ? ["Ограничения для этой категории:", ...cfSafety.map((s) => `— ${s}`)]
            : []),
          ...(lockedCatLines.length
            ? ["Факты на этом слайде (как в форме):", ...lockedCatLines.map((s) => `— ${s}`)]
            : []),
        ].join("\n\n")
      : "";

  const salesStyleBlock = [
    "=== 5) SALES_STYLE_INSTRUCTION ===",
    getSalesStyleInstruction(input.salesStyle ?? "light_marketplace"),
  ].join("\n\n");

  const mainPhotoDensityNote = mainPhotoLocksText
    ? "\nЭта площадка предпочитает главное фото без пользовательских надписей. Не добавляй читаемый маркетинговый текст на кадре."
    : "";

  const verificationNote = profile?.needsVerification
    ? "\nДля профиля площадки указано, что правила нужно дополнительно проверить по официальным источникам перед публикацией; не утверждай жёсткие требования, которых нет в задаче пользователя."
    : "";

  const textDensityParts = [
    "=== 6) TEXT_DENSITY_AUDIENCE_PRICE ===",
    getTextDensityInstruction(input.textDensity ?? "medium"),
    mainPhotoDensityNote,
    verificationNote,
    audienceSceneMoodBlock(input.audience),
    priceSegmentVisualBlock(input.priceSegment),
    layoutNote,
  ].filter((x) => x && String(x).trim() !== "");

  const inputRolesBlock = inputImagesRolesBlock(
    input.productSourceImageCount ?? 1,
    input.styleReferenceImageCount ?? 0,
  );
  const styleRefPrompt = styleReferenceInstructionBlock(
    input.styleReferencePlan,
    input.styleReferenceImageCount ?? 0,
  );

  const promptPieces = [
    roleBlock(),
    inputRolesBlock,
    productIdentityLockSection(input),
    marketplaceBlock,
    slideRoleBlock,
    templateInstructionBlock,
    styleRefPrompt,
    accentsBlock,
    mustShowBlock,
    cfPolicyBlock,
    salesStyleBlock,
    textDensityParts.join("\n\n"),
    designFlexibilityWithTextLockBlock(),
    criticalExactTextLockBlock(),
    languagePreservationSection(languageProbePhrases, languageMode),
    lockedTextPhrasesSection(phrases),
    negativeInstructionsBlock(profile),
  ].filter((x) => x && String(x).trim() !== "");

  const prompt = promptPieces.join("\n\n");

  return {
    ok: true,
    data: {
      prompt,
      promptVersion: PROMPT_VERSION,
      exactTextPhrases: phrases,
      textRenderMode: "ai_text_in_design",
      textLockLevel: "strict",
      designFlexible: true,
      overlayApplied: false,
      exactTextRequested: true,
    },
  };
}
