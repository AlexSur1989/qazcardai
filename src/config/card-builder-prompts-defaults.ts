import {
  buildCardBuilderV2CardTypePromptsWithLegacy,
  buildCardBuilderV2TemplatePrompts,
  CARD_BUILDER_V2_CATEGORY_PROMPTS,
} from "@/lib/card-builder-prompt-v2-content";

export const CARD_BUILDER_PROMPTS_SETTING_VERSION = "card_builder_prompts_v2.2" as const;

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
  "benefits_infographic",
  "benefits_card",
  "comparison_card",
  "dimensions_card",
  "package_contents",
  "usage_instruction",
  "premium_poster",
  "lifestyle_card",
  "detail_closeup",
  "material_texture",
  "specs_card",
  "before_after",
  "social_proof",
  "offer_card",
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
  "main_photo",
  "benefits_infographic",
  "materials_texture",
  "dimensions_size",
  "packaging_set",
  "instruction_steps",
  "lifestyle_scene",
  "universal",
  "hero_clean",
  "product_packshot",
  "fashion_catalog",
  "beauty_packshot",
  "benefits_grid",
  "benefits_left_column",
  "comparison_card",
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
  "protection_features",
  "ingredients_effect",
  "dark_premium",
  "dark_premium_benefits",
  "realistic_listing",
  "instruction_steps",
  "specs_card",
  "social_proof_card",
  "before_after_card",
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

Твоя задача — ТОЛЬКО то, что видно на изображении (vision_ai):
- бренд (brandGuess), если читается на упаковке;
- название/тип товара (productNameGuess, productType);
- категорию (categoryKey);
- видимые цвета, форму, тип упаковки;
- видимый текст (visibleText) — дословно;
- видимые заявления на упаковке (visibleClaims) — дословно, без интерпретации;
- материал (materialGuess) — только если очевиден визуально;
- suggestedProductFacts — только detail/package/dimension/material/product_purpose с confidence, если это видно на фото.

НЕ выдумывай и НЕ добавляй в suggestedProductFacts:
- преимущества (benefit), эффекты (effect), состав (ingredient);
- размер/объём/вес, если не написаны на фото;
- функции, совместимость, сертификаты, медицинские свойства;
- характеристики «из общих знаний о товаре».

Web Research выполняется отдельно — здесь только vision.

Верни только валидный JSON без markdown и без лишних ключей.
JSON должен точно соответствовать схеме:
{{OUTPUT_SCHEMA}}

Правила:
- categoryKey — одна из перечисленных категорий.
- materialGuess — null, если материал не очевиден.
- productShape — null, если форма неясна.
- suggestedProductFacts — только то, что можно обосновать визуально; confidence 0.0–1.0.
- type=product_purpose для назначения или краткого описания товара (например «шампунь против перхоти», «крем для сухой кожи») — это НЕ benefit.
- type=benefit только для конкретных selling points / преимуществ, а не для общего назначения товара.
- warnings — короткие предупреждения на русском, если данных мало.
- Не добавляй поля вне схемы.`;

/** JSON-схема ответа vision-анализа (без server-only — нужна и в worker). */
export const PRODUCT_CARD_VISION_ANALYSIS_OUTPUT_SCHEMA = `{
  "categoryKey": "clothing_shoes | beauty_care | home_interior | kids_products | sport_fitness | auto_products | jewelry_accessories | food_drinks | gadgets_tech | other",
  "productType": "string",
  "productNameGuess": "string",
  "brandGuess": null,
  "mainColors": ["string"],
  "materialGuess": null,
  "styleGuess": null,
  "visibleText": ["string"],
  "visibleClaims": ["string"],
  "packaging": "none | bottle | box | bag | tube | jar | other",
  "productShape": null,
  "mainObjects": ["string"],
  "suggestedProductFacts": [
    {
      "label": "string",
      "value": "string",
      "type": "product_purpose | material | dimension | usage | detail | package | feature | other",
      "confidence": 0.0
    }
  ],
  "confidence": 0.0,
  "warnings": ["string"]
}`;

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
НЕ выдумывай размеры, состав, функции, сертификаты, отзывы, скидки и медицинские обещания.
НЕ меняй товар и логотип с исходного фото.
НЕ добавляй водяные знаки, чужие бренды, fake badges, rating stars, certificates.
НЕ добавляй нечитаемый мелкий текст.
Если фактов нет — лучше нейтральная карточка без claims, чем ложный текст.`;

const STYLE_REFERENCE_PROMPT = `=== STYLE_REFERENCE ===
Референс — только источник стиля оформления, не источник фактов о SKU.
Не копируй чужой товар, логотипы, бренды, читаемый текст и водяные знаки с референса.
Товар на выходе = товар с фото товара; locked-текст пользователя не изменять.`;

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
  categoryPrompts: { ...CARD_BUILDER_V2_CATEGORY_PROMPTS },
  cardTypePrompts: buildCardBuilderV2CardTypePromptsWithLegacy(),
  templatePrompts: buildCardBuilderV2TemplatePrompts(),
};

/** slideRole из плана → ключ cardTypePrompts (канонические v2.2). */
export const CARD_BUILDER_SLIDE_ROLE_TO_CARD_TYPE: Record<string, string> = {
  main_photo: "main_photo",
  benefits_infographic: "benefits_infographic",
  dimensions: "dimensions_card",
  materials: "material_texture",
  lifestyle: "lifestyle_card",
  detail_closeup: "detail_closeup",
  packaging: "package_contents",
  premium_poster: "premium_poster",
  ad_banner: "offer_card",
  usage_instruction: "usage_instruction",
  specs_card: "specs_card",
  social_proof: "social_proof",
  before_after: "before_after",
};
