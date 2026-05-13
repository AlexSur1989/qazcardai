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
import type { ProductCardMarketplaceProfile } from "@/config/product-card-marketplace-profiles";
import { PRODUCT_CATEGORY_GROUPS } from "@/config/product-card-categories";

const PROMPT_VERSION = "card_builder_super_prompt_v2" as const;

const MAX_PHRASES = 7;
/** Одна фраза на кадр (строка из названия, бенефита, размеров и т.д.): длинные строки характеристик. */
const MAX_PHRASE_LEN = 120;

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
  /** Профиль площадки: промпт и текстовые ограничения; если не задан — трактовать как универсальный режим. */
  marketplaceProfile?: ProductCardMarketplaceProfile | null;
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
  /** Если true — не включаем пользовательские фразы для bitmap-текста (главное фото без текста по правилам площадки). */
  omitUserLockedText?: boolean;
  /** Максимум тегов-акцентов (инфографика); лишнее обрезается с понятным уведомлением. */
  maxBenefitTags?: number;
}): {
  phrases: string[];
  validationErrors: string[];
  benefitTagsTrimNotice?: string;
} {
  let benefitTagsTrimNotice: string | undefined;
  let benefitIds = input.benefitTagIds.slice();
  if (
    input.maxBenefitTags != null &&
    input.maxBenefitTags >= 0 &&
    benefitIds.length > input.maxBenefitTags
  ) {
    benefitIds = benefitIds.slice(0, input.maxBenefitTags);
    benefitTagsTrimNotice =
      input.maxBenefitTags === 0
        ? "Для этой площадки блок преимуществ на инфографике не используется; пользовательские акценты не переносятся в locked-текст слайда."
        : `Для этой площадки в locked-текст слайда перенесены только первые ${input.maxBenefitTags} акцентов из выбранного списка.`;
  }

  const errors: string[] = [];
  const raw: string[] = [];

  if (!input.omitUserLockedText) {
    const t = stripHtmlFragments(input.productTitle?.trim() ?? "");
    if (t) raw.push(t);

    const st = stripHtmlFragments(input.subtitle?.trim() ?? "");
    if (st) raw.push(st);

    for (const line of benefitLabelsFromIds(benefitIds)) {
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
  }

  void input.slideRole;

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
    ...(benefitTagsTrimNotice ? { benefitTagsTrimNotice } : {}),
  };
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
    medium: `Плотность текста: средне — несколько блоков только из locked phrases (например заголовок и преимущества). ${lock}`,
    heavy: `Плотность текста: высокая — несколько блоков только из locked phrases, без новых формулировок. ${lock}`,
    infographic: `Плотность текста: инфографика — плашки, иконки, выноски; текст только из locked phrases. ${lock}`,
  };
  return body[id] ?? `Плотность текста: ${label}. ${lock}`;
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
  phrases: string[],
  mode: CardBuilderSuperPromptLanguageMode,
): string {
  const det = detectTextLanguageMode(phrases);
  const chunks: string[] = ["=== 9) LANGUAGE_PRESERVATION (RU / KK) ==="];
  if (det.hasKazakhLetters) {
    chunks.push(kazakhPreservationBlock());
  }
  if (det.hasCyrillic) {
    chunks.push(russianPreservationBlock());
  }
  const mixed =
    mode === "mixed" ||
    (det.hasLatin && det.hasCyrillic) ||
    (det.hasLatin && det.hasKazakhLetters);
  if (mixed) {
    chunks.push(
      "Mixed scripts / languages: keep each phrase exactly as the user wrote; do not translate or substitute letters.",
      "Смесь языков и алфавитов: каждую фразу сохраняй в том виде, как задал пользователь, без перевода и без подмены букв.",
    );
  }
  if (chunks.length === 1) {
    chunks.push(
      "If any Cyrillic or Latin appears in locked phrases, preserve characters exactly; do not substitute homoglyphs.",
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
    "НЕ выдумывай размеры, сертификаты, скидки и характеристики, если их нет во фразах пользователя.",
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
  const preserveBlock = input.preserveProduct
    ? [
        "PRODUCT_IDENTITY_LOCK:",
        "Сохрани товар без изменений: форму, цвет, материал, логотип, пропорции, упаковку и важные детали.",
        "Не меняй товар на похожий. Не добавляй новые детали товара.",
        "Не искажай бренд, логотип, форму и цвет.",
        input.preserveProductOptions?.length
          ? `Особый фокус пользователя: ${input.preserveProductOptions.join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "PRODUCT_IDENTITY: допускается мягкая стилизация фона и света при сохранении узнаваемости товара; сам товар не подменять.";

  const sourceNote =
    input.sourceImageMode === "variant"
      ? "Исходное фото можно интерпретировать как референс сцены; товар не заменять."
      : "Опирайся на загруженные фото товара как на референс идентичности SKU.";

  const cat = categoryLabel(input.selectedCategory);
  const mp = input.marketplaceProfile ?? undefined;
  const mpStrict =
    mp?.preserveProductRequired && input.preserveProduct
      ? "Требование площадки: строже сохранять идентичность товара (форму, цвет, упаковку, логотип), без замены SKU."
      : "";

  const goalNote = input.goal?.trim()
    ? `Задача галереи (контекст, не добавлять новый текст на кадр): ${input.goal}.`
    : "";

  return [
    "=== 2) PRODUCT_IDENTITY_LOCK ===",
    `Категория товара (идентичность, не выдумывать другой продукт): ${cat}.`,
    preserveBlock,
    mpStrict,
    sourceNote,
    goalNote,
  ]
    .filter((x) => x && String(x).trim() !== "")
    .join("\n\n");
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

  let maxBenefitTags: number | undefined;
  if (input.slideRole === "benefits_infographic" && profile) {
    maxBenefitTags = Math.min(profile.maxBenefitBadges, profile.infographicRules.maxBenefitBadges);
  }

  const { phrases, validationErrors, benefitTagsTrimNotice } = collectExactTextPhrases({
    productTitle: input.productTitle,
    subtitle: input.subtitle,
    benefitTagIds: input.benefits ?? [],
    additionalBenefits: input.additionalBenefits,
    mustShowTagIds: input.mustShow ?? [],
    dimensions: input.dimensions,
    slideRole: input.slideRole,
    omitUserLockedText: mainPhotoLocksText,
    maxBenefitTags,
  });

  if (validationErrors.length > 0) {
    return { ok: false, validationErrors };
  }

  const languageMode: CardBuilderSuperPromptLanguageMode = input.languageMode ?? "auto";

  const layoutNote =
    input.templateId || input.layoutPreset
      ? `Логическая схема слайда (только композиция; не выводить как отдельную этикетку): templateId=${input.templateId ?? "—"}, layoutPreset=${input.layoutPreset ?? "—"}.`
      : "";

  const marketplaceInner = marketplacePromptBody(input.marketplace, input.slideRole, profile);
  const marketplaceBlock = ["=== 3) MARKETPLACE_INSTRUCTION ===", marketplaceInner].join("\n\n");

  const slideRoleBlock = [
    "=== 4) SLIDE_ROLE_INSTRUCTION ===",
    getSlideRoleInstruction(input.slideRole, input.templateId),
  ].join("\n\n");

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
    "=== 6) TEXT_DENSITY_AND_CONTEXT ===",
    getTextDensityInstruction(input.textDensity ?? "medium"),
    mainPhotoDensityNote,
    verificationNote,
    audienceLine(input.audience),
    priceLine(input.priceSegment),
    layoutNote,
  ].filter((x) => x && String(x).trim() !== "");

  const prompt = [
    roleBlock(),
    productIdentityLockSection(input),
    marketplaceBlock,
    slideRoleBlock,
    salesStyleBlock,
    textDensityParts.join("\n\n"),
    designFlexibilityWithTextLockBlock(),
    criticalExactTextLockBlock(),
    languagePreservationSection(phrases, languageMode),
    lockedTextPhrasesSection(phrases),
    negativeInstructionsBlock(profile),
  ].join("\n\n");

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
      marketplaceBenefitTrimNotice: benefitTagsTrimNotice,
    },
  };
}
