import { CARD_BUILDER_CATEGORY_VISUAL_STYLE_HINTS } from "@/config/card-builder-universal";

export const CARD_BUILDER_PROMPTS_SETTING_VERSION = "card_builder_prompts_v1" as const;

export const CARD_BUILDER_PROMPTS_KNOWN_CATEGORY_KEYS = [
  "clothing_shoes",
  "beauty_care",
  "home_interior",
  "kids_products",
  "sport_fitness",
  "auto_products",
  "jewelry_accessories",
  "food_drinks",
  "gadgets_tech",
  "other",
] as const;

export const CARD_BUILDER_PROMPTS_KNOWN_CARD_TYPE_KEYS = [
  "main_photo",
  "infographic",
  "benefits",
  "comparison",
  "dimensions",
  "package",
  "instruction",
  "premium_banner",
  "lifestyle",
  "details",
  "materials",
] as const;

export const CARD_BUILDER_PROMPTS_KNOWN_TEMPLATE_KEYS = [
  "hero_clean",
  "product_packshot",
  "fashion_catalog",
  "beauty_packshot",
  "benefits_grid",
  "benefits_left_column",
  "feature_callouts",
  "texture_closeup",
  "material_focus",
  "fabric_closeup",
  "detail_closeup",
  "interface_detail",
  "dimensions_schema",
  "size_range",
  "scale_comparison",
  "lifestyle_card",
  "usage_scenario",
  "interior_lifestyle",
  "fashion_lifestyle",
  "beauty_lifestyle",
  "food_lifestyle",
  "package_card",
  "gift_packaging",
  "set_contents",
  "premium_poster",
  "editorial_poster",
  "ad_banner",
  "brand_hero",
] as const;

export type CardBuilderPromptsSetting = {
  version: typeof CARD_BUILDER_PROMPTS_SETTING_VERSION | string;
  enabled: boolean;
  visionPrompt: string;
  galleryPlannerPrompt: string;
  slidePromptBase: string;
  textLockPrompt: string;
  preserveProductPrompt: string;
  negativeRulesPrompt: string;
  styleReferencePrompt: string;
  categoryPrompts: Record<string, string>;
  cardTypePrompts: Record<string, string>;
  templatePrompts: Record<string, string>;
};

const VISION_PROMPT_BASE = `Ты анализируешь фото товара для генератора карточек товара.

Твоя задача:
- определить тип товара;
- определить категорию;
- описать видимые цвета;
- определить материал только если он очевиден визуально;
- извлечь видимый текст, если он есть;
- предложить факты товара, которые помогут создать карточку.

Не выдумывай:
- размер;
- вес;
- объём;
- состав;
- материал (если не очевиден);
- функции;
- гарантию;
- совместимость;
- лечебные или медицинские свойства;
- сертификаты;
- бренд, если он не виден.

Верни только валидный JSON без markdown и без лишних ключей.
JSON должен точно соответствовать схеме:
{{OUTPUT_SCHEMA}}

Правила:
- categoryKey — одна из перечисленных категорий.
- materialGuess — null, если материал не очевиден.
- productShape — null, если форма неясна.
- suggestedProductFacts — только то, что можно обосновать визуально; confidence 0.0–1.0.
- warnings — короткие предупреждения на русском, если данных мало.
- Не добавляй поля вне схемы.`;

const GALLERY_PLANNER_PROMPT = `Планировщик структуры галереи (детерминированный, без LLM):
- Базовая галерея 6: hero_clean → benefits_grid → texture_closeup → material_focus → (dimensions_schema или texture_closeup при отсутствии размеров) → lifestyle_card.
- Галерея 8: добавляет set_contents или feature_callouts и premium_poster.
- Выбор шаблонов зависит от cardBuilderCategoryKey и productFacts (размеры, комплектация).
- Не выдумывать слайды вне allowlist universal-профиля.`;

const SLIDE_PROMPT_BASE = `=== 1) ROLE ===
Ты профессиональный дизайнер карточек товара для e-commerce.
Создай коммерческий слайд: товар узнаваем, дизайн гибкий, текст клиента — locked copy.
You are a professional e-commerce product card designer.`;

const TEXT_LOCK_PROMPT = `=== TEXT_LOCK ===
You may change visual design (background, composition, badges, icons, colors, layout, lighting).
You must NOT change user text: no translate, paraphrase, correct, shorten, or replace characters.
Kazakh letters must stay exact: Ә ә, Ғ ғ, Қ қ, Ң ң, Ө ө, Ұ ұ, Ү ү, Һ һ, І і.

Дизайн можно менять; текст пользователя — locked copy. Не переводить и не перефразировать.`;

const PRESERVE_PRODUCT_PROMPT = `=== PRESERVE_PRODUCT ===
Сохрани товар неизменным по референсному фото: форма, цвет, логотип на товаре, пропорции.
Не подменяй SKU другим объектом. Не добавляй случайных деталей к продукту.`;

const NEGATIVE_RULES_PROMPT = `=== NEGATIVE RULES ===
НЕ выдумывай размеры, состав, функции, сертификаты и медицинские обещания.
НЕ меняй товар и логотип с исходного фото.
НЕ добавляй водяные знаки и чужие бренды.
НЕ добавляй нечитаемый мелкий текст.`;

const STYLE_REFERENCE_PROMPT = `=== STYLE_REFERENCE ===
Референс — только источник стиля оформления, не источник фактов о SKU.
Не копируй чужой товар, логотипы, бренды, читаемый текст и водяные знаки с референса.
Товар на выходе = товар с фото товара; locked-текст пользователя не изменять.`;

function categoryDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of CARD_BUILDER_PROMPTS_KNOWN_CATEGORY_KEYS) {
    const hint =
      key in CARD_BUILDER_CATEGORY_VISUAL_STYLE_HINTS
        ? CARD_BUILDER_CATEGORY_VISUAL_STYLE_HINTS[
            key as keyof typeof CARD_BUILDER_CATEGORY_VISUAL_STYLE_HINTS
          ]
        : CARD_BUILDER_CATEGORY_VISUAL_STYLE_HINTS.other;
    out[key] = `=== CATEGORY ===\nКатегория: ${key}.\n${hint}`;
  }
  return out;
}

const CARD_TYPE_DEFAULTS: Record<string, string> = {
  main_photo:
    "=== CARD TYPE: MAIN ===\nГлавное фото: чистый каталожный кадр, товар узнаваем, фон спокойный.",
  infographic:
    "=== CARD TYPE: INFOGRAPHIC ===\nИнфографика: плашки и иконки; текст только из locked phrases.",
  benefits:
    "=== CARD TYPE: BENEFITS ===\nСлайд преимуществ: плашки и иконки; не менять текст клиента.",
  comparison:
    "=== CARD TYPE: COMPARISON ===\nСравнение только по фактам пользователя; без ложных claims.",
  dimensions:
    "=== CARD TYPE: DIMENSIONS ===\nРазмеры только из locked phrases; не выдумывать цифры.",
  package:
    "=== CARD TYPE: PACKAGE ===\nУпаковка/комплект честно по референсу; не придумывать состав.",
  instruction:
    "=== CARD TYPE: INSTRUCTION ===\nИнструкция/детали: акцент на видимых деталях без выдуманных шагов.",
  premium_banner:
    "=== CARD TYPE: PREMIUM BANNER ===\nПремиальный рекламный кадр; текст только locked phrases.",
  lifestyle:
    "=== CARD TYPE: LIFESTYLE ===\nLifestyle-сцена; товар главный; без выдуманных свойств.",
  details:
    "=== CARD TYPE: DETAILS ===\nКрупный план детали; не подменять символы текста.",
  materials:
    "=== CARD TYPE: MATERIALS ===\nМатериал и фактура; не выдумывать состав.",
};

const TEMPLATE_DEFAULTS: Record<string, string> = {
  hero_clean: "Чистый каталожный кадр: товар узнаваем, фон спокойный.",
  product_packshot: "Packshot на нейтральном фоне, честная идентичность SKU.",
  fashion_catalog: "Fashion/catalog без тяжёлой инфографики.",
  beauty_packshot: "Косметика: чистый premium packshot, мягкий свет.",
  benefits_grid: "Инфографика преимуществ только по locked phrases клиента.",
  benefits_left_column: "Преимущества в колонке; текст только locked.",
  feature_callouts: "Выноски функций только из locked phrases.",
  texture_closeup: "Фактура и поверхность крупным планом.",
  material_focus: "Акцент на материале без выдуманного состава.",
  fabric_closeup: "Ткань, швы, фактура; не выдумывать состав.",
  detail_closeup: "Крупный план детали товара.",
  interface_detail: "Экран/кнопка/разъём; не выдумывать функции.",
  dimensions_schema: "Размеры только если указаны пользователем.",
  size_range: "Размерный ряд только из текста пользователя.",
  scale_comparison: "Масштаб визуально без выдуманных цифр.",
  lifestyle_card: "Естественный lifestyle без выдуманных свойств.",
  usage_scenario: "Сценарий использования; товар узнаваем.",
  interior_lifestyle: "Интерьерный контекст без перегруженной инфографики.",
  fashion_lifestyle: "Fashion lifestyle, акцент на товар.",
  beauty_lifestyle: "Beauty lifestyle, чистая подача.",
  food_lifestyle: "Food lifestyle, аппетитная подача.",
  package_card: "Упаковка честно по референсу.",
  gift_packaging: "Подарочная упаковка без выдуманных маркировок.",
  set_contents: "Состав комплекта только если указан пользователем.",
  premium_poster: "Премиальный постер без неподтверждённых claims.",
  editorial_poster: "Editorial-подача с негативным пространством.",
  ad_banner: "Рекламный баннер; текст только locked phrases.",
  brand_hero: "Hero-кадр бренда без чужих логотипов.",
};

export const CARD_BUILDER_PROMPTS_DEFAULTS: CardBuilderPromptsSetting = {
  version: CARD_BUILDER_PROMPTS_SETTING_VERSION,
  enabled: true,
  visionPrompt: VISION_PROMPT_BASE,
  galleryPlannerPrompt: GALLERY_PLANNER_PROMPT,
  slidePromptBase: SLIDE_PROMPT_BASE,
  textLockPrompt: TEXT_LOCK_PROMPT,
  preserveProductPrompt: PRESERVE_PRODUCT_PROMPT,
  negativeRulesPrompt: NEGATIVE_RULES_PROMPT,
  styleReferencePrompt: STYLE_REFERENCE_PROMPT,
  categoryPrompts: categoryDefaults(),
  cardTypePrompts: { ...CARD_TYPE_DEFAULTS },
  templatePrompts: { ...TEMPLATE_DEFAULTS },
};

/** slideRole из плана → ключ cardTypePrompts. */
export const CARD_BUILDER_SLIDE_ROLE_TO_CARD_TYPE: Record<string, string> = {
  main_photo: "main_photo",
  benefits_infographic: "benefits",
  dimensions: "dimensions",
  materials: "materials",
  lifestyle: "lifestyle",
  detail_closeup: "details",
  packaging: "package",
  premium_poster: "premium_banner",
  ad_banner: "premium_banner",
};
