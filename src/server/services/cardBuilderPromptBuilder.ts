import "server-only";

import {
  CARD_BUILDER_AUDIENCES,
  CARD_BUILDER_BENEFIT_TAGS,
  CARD_BUILDER_MARKETPLACES,
  CARD_BUILDER_MUST_SHOW,
  CARD_BUILDER_PRICE_SEGMENTS,
  CARD_BUILDER_SALES_STYLES,
  CARD_BUILDER_TEXT_DENSITY,
} from "@/config/card-builder-config";

const PROMPT_VERSION = "card_builder_super_prompt_v1" as const;

const MAX_PHRASES = 7;
const MAX_PHRASE_LEN = 60;

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
  benefits: string[];
  additionalBenefits?: string;
  mustShow: string[];
  audience?: string;
  priceSegment?: string;
  salesStyle?: string;
  textDensity?: string;
  preserveProduct: boolean;
  preserveProductOptions?: string[];
  sourceImageMode?: string;
  languageMode?: CardBuilderSuperPromptLanguageMode;
  dimensions?: string;
};

export type CardBuilderSuperPromptOk = {
  prompt: string;
  promptVersion: typeof PROMPT_VERSION;
  exactTextPhrases: string[];
  textRenderMode: "ai_text_in_design";
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

function benefitLabelsFromIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const row = CARD_BUILDER_BENEFIT_TAGS.find((b) => b.id === id);
    if (row?.label?.trim()) out.push(row.label.trim());
  }
  return out;
}

function mustShowLabelsFromIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const row = CARD_BUILDER_MUST_SHOW.find((m) => m.id === id);
    if (row?.label?.trim()) out.push(row.label.trim());
  }
  return out;
}

/** Строки для блока точного текста + проверки длины и числа фраз. */
export function collectExactTextPhrases(input: {
  productTitle?: string | null;
  subtitle?: string | null;
  benefitTagIds: string[];
  additionalBenefits?: string | null;
  mustShowTagIds: string[];
  dimensions?: string | null;
  slideRole: string;
}): { phrases: string[]; validationErrors: string[] } {
  void input.slideRole;
  const errors: string[] = [];
  const raw: string[] = [];

  const t = stripHtmlFragments(input.productTitle?.trim() ?? "");
  if (t) raw.push(t);

  const st = stripHtmlFragments(input.subtitle?.trim() ?? "");
  if (st) raw.push(st);

  for (const line of benefitLabelsFromIds(input.benefitTagIds)) {
    raw.push(stripHtmlFragments(line));
  }

  const extra = input.additionalBenefits?.trim() ?? "";
  if (extra) {
    for (const part of extra.split(/\r?\n/)) {
      const x = stripHtmlFragments(part);
      if (x) raw.push(x);
    }
  }

  for (const line of mustShowLabelsFromIds(input.mustShowTagIds)) {
    raw.push(stripHtmlFragments(line));
  }

  const dim = stripHtmlFragments(input.dimensions?.trim() ?? "");
  if (dim) raw.push(dim);

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
      `Слишком много текстовых фраз для одного слайда (максимум ${MAX_PHRASES}). Сократите подзаголовок, дополнительный текст или число акцентов.`,
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

export function getSlideRoleInstruction(slideRole: string, templateId?: string): string {
  const cmp =
    templateId === "comparison_card"
      ? "\nВизуально: сравнение преимуществ; не придумывай ложных сравнений с конкурентами; только безопасные формулировки пользователя."
      : "";

  switch (slideRole) {
    case "main_photo":
      return [
        "Слайд: главное фото товара.",
        "Товар крупно, читаемый силуэт, чистый фон.",
        "Если плотность текста «без текста» — не добавляй подписи и плашки.",
      ].join("\n");
    case "benefits_infographic":
      return [
        "Слайд: инфографика с преимуществами.",
        "Размести 3–5 преимуществ как читаемые плашки с аккуратными иконками.",
        "Товар должен оставаться хорошо видимым; текст — крупный и читаемый.",
        cmp,
      ]
        .filter(Boolean)
        .join("\n");
    case "materials":
      return [
        "Слайд: материалы и качество.",
        "Акцент на фактуру, тактильность, честный макро-кадр.",
        "Допустимо 1–3 короткие текстовые плашки из пользовательских фраз.",
      ].join("\n");
    case "dimensions":
      return [
        "Слайд: размеры, масштаб и характеристики.",
        "Не выдумывай точные размеры и цифры: используй только те, что дал пользователь в точных фразах.",
      ].join("\n");
    case "lifestyle":
      return [
        "Слайд: товар в использовании.",
        "Эмоциональная правдоподобная сцена; минимум текста на кадре; товар узнаваем.",
      ].join("\n");
    case "premium_poster":
      return [
        "Слайд: премиальный рекламный постер.",
        "Дорогой визуал и свет; короткий заголовок или слоган только из пользовательских фраз.",
        "Товар — главный объект композиции.",
      ].join("\n");
    case "ad_banner":
      return [
        "Слайд: рекламный баннер.",
        "Сильный визуальный акцент; короткий читаемый текст из пользовательских фраз.",
      ].join("\n");
    case "packaging":
      return [
        "Слайд: упаковка, комплект, содержимое.",
        "Не придумывай состав комплекта, если пользователь его не указал в фразах.",
      ].join("\n");
    case "detail_closeup":
      return [
        "Слайд: крупный план важной детали или интерфейса.",
        "Максимальная читаемость фактуры; текст только из пользовательских фраз и уместен по плотности.",
      ].join("\n");
    default:
      return `Слайд (роль ${slideRole}): коммерческий кадр карточки товара; сохраняй товар узнаваемым.`;
  }
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
      "Плашки, иконки, выноски, структурированный текст (только из пользовательских фраз).",
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
  const body: Record<string, string> = {
    none: "Плотность текста: без текста — не добавляй заголовков и плашек.",
    minimal: "Плотность текста: минимум — максимум один короткий заголовок из пользовательских фраз.",
    medium: "Плотность текста: средне — заголовок и около трёх преимуществ из пользовательских фраз.",
    heavy:
      "Плотность текста: высокая — заголовок, 3–5 преимуществ и короткие характеристики только из пользовательских фраз.",
    infographic:
      "Плотность текста: инфографика — плашки, иконки, выноски, несколько блоков текста из пользовательских фраз.",
  };
  return body[id] ?? `Плотность текста: ${label}.`;
}

function resolveLanguageHints(
  mode: CardBuilderSuperPromptLanguageMode,
  phrases: string[],
): string {
  const det = detectTextLanguageMode(phrases);
  const effective: "ru" | "kk" | "mixed" =
    mode === "ru" || mode === "kk" || mode === "mixed"
      ? mode
      : det.hasKazakhLetters && det.hasLatin
        ? "mixed"
        : det.hasKazakhLetters
          ? "kk"
          : det.hasCyrillic || det.hasLatin
            ? "ru"
            : "ru";

  const lines: string[] = [];
  if (effective === "kk" || det.hasKazakhLetters) {
    lines.push(
      "Текст может содержать казахские буквы кириллицы. Сохрани их дословно: ә, ғ, қ, ң, ө, ұ, ү, һ, і.",
      "Не транслитерируй казахский текст. Не переводи казахский. Не подменяй казахские буквы русскими или латинскими аналогами.",
    );
  }
  if (effective === "ru" || det.hasCyrillic) {
    lines.push(
      "Русский кириллический текст сохраняй дословно.",
      "Не переводи русские фразы на английский. Не переписывай и не «исправляй» русские формулировки.",
    );
  }
  if (effective === "mixed" || (det.hasLatin && det.hasCyrillic)) {
    lines.push(
      "Допустима смесь языков: каждую фразу сохраняй в том виде, как задал пользователь, без перевода.",
    );
  }
  return lines.join("\n");
}

function exactTextLockBlock(phrases: string[]): string {
  const core = [
    "ВАЖНО: Весь текст ниже нужно сохранить ТОЧНО как задал пользователь.",
    "Не переводи.",
    "Не перефразируй.",
    "Не исправляй орфографию.",
    "Не меняй порядок слов.",
    "Не меняй буквы.",
    "Не заменяй кириллицу похожими символами.",
    "Не добавляй новые слова внутрь этих фраз.",
    "Не удаляй слова.",
    "Не используй псевдотекст.",
    "Не превращай русский или казахский текст в бессмысленные символы.",
    "Текст должен быть читаемым, крупным и размещённым как реальные надписи на карточке.",
  ].join("\n");

  if (phrases.length === 0) {
    return `${core}\n\nПользователь не передал отдельные фразы для надписей — не выдумывай торговые названия, характеристики и выгоды.`;
  }

  const numbered = phrases.map((p, i) => `${i + 1}. "${p}"`).join("\n");
  return `${core}\n\nТочные фразы для размещения:\n${numbered}`;
}

function negativeTail(): string {
  return [
    "НЕ добавляй водяные знаки.",
    "НЕ добавляй случайные чужие бренды.",
    "НЕ добавляй нечитаемый мелкий текст и псевдо-буквы.",
    "НЕ искажай товар и НЕ меняй логотип.",
    "НЕ выдумывай размеры, сертификаты, скидки и характеристики, если их нет во фразах пользователя.",
    "НЕ добавляй медицинские или юридические заявления, если пользователь их не указывал.",
  ].join("\n");
}

function audienceLine(audience?: string): string {
  if (!audience?.trim()) return "";
  const label = CARD_BUILDER_AUDIENCES.find((a) => a.id === audience)?.label ?? audience;
  return `Целевая аудитория (для настроения кадра, не как обязательный текст на карточке): ${label}.`;
}

function priceLine(segment?: string): string {
  if (!segment?.trim()) return "";
  const label = CARD_BUILDER_PRICE_SEGMENTS.find((p) => p.id === segment)?.label ?? segment;
  return `Ценовое позиционирование визуала: ${label}.`;
}

/** Собирает супер-промпт для Kie: card_builder, текст встроен в дизайн моделью. */
export function buildCardBuilderSuperPrompt(input: CardBuilderSuperPromptInput): CardBuilderSuperPromptResult {
  const { phrases, validationErrors } = collectExactTextPhrases({
    productTitle: input.productTitle,
    subtitle: input.subtitle,
    benefitTagIds: input.benefits ?? [],
    additionalBenefits: input.additionalBenefits,
    mustShowTagIds: input.mustShow ?? [],
    dimensions: input.dimensions,
    slideRole: input.slideRole,
  });

  if (validationErrors.length > 0) {
    return { ok: false, validationErrors };
  }

  const languageMode: CardBuilderSuperPromptLanguageMode = input.languageMode ?? "auto";

  const layoutNote =
    input.templateId || input.layoutPreset
      ? `Логическая схема слайда (для композиции, не выводить как отдельную этикетку): templateId=${input.templateId ?? "—"}, layoutPreset=${input.layoutPreset ?? "—"}.`
      : "";

  const preserveBlock = input.preserveProduct
    ? [
        "СОХРАНЕНИЕ ТОВАРА (1:1):",
        "Сохрани товар без изменений: форму, цвет, материал, логотип, пропорции, упаковку и важные детали.",
        "Не меняй товар на похожий. Не добавляй новые детали товара.",
        "Не искажай бренд, логотип, форму и цвет.",
        input.preserveProductOptions?.length
          ? `Особый фокус пользователя: ${input.preserveProductOptions.join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Допускается мягкая стилизация фона и света при сохранении узнаваемости товара.";

  const sourceNote =
    input.sourceImageMode === "variant"
      ? "Исходное фото можно интерпретировать как референс сцены; товар не заменять."
      : "Опирайся на загруженные фото товара как на референс идентичности SKU.";

  const parts = [
    "Ты профессиональный дизайнер маркетплейсных карточек товара.",
    "Создай коммерчески полезный слайд карточки товара, подходящий для выбранной площадки.",
    "Изображение должно выглядеть как готовый дизайн карточки товара, а не как случайная AI-картинка.",
    "",
    preserveBlock,
    "",
    getMarketplaceInstruction(input.marketplace),
    "",
    getSlideRoleInstruction(input.slideRole, input.templateId),
    "",
    getSalesStyleInstruction(input.salesStyle ?? "light_marketplace"),
    "",
    getTextDensityInstruction(input.textDensity ?? "medium"),
    "",
    audienceLine(input.audience),
    priceLine(input.priceSegment),
    layoutNote,
    sourceNote,
    "",
    exactTextLockBlock(phrases),
    "",
    resolveLanguageHints(languageMode, phrases),
    "",
    negativeTail(),
  ];

  const prompt = parts.filter((x) => x != null && String(x).trim() !== "").join("\n\n");

  return {
    ok: true,
    data: {
      prompt,
      promptVersion: PROMPT_VERSION,
      exactTextPhrases: phrases,
      textRenderMode: "ai_text_in_design",
    },
  };
}
