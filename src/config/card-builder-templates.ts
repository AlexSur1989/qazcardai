import type { ProductCategoryId } from "@/config/product-card-categories";
import type {
  ProductCardTemplatePresetId,
  ProductCardTypographyPresetId,
} from "@/config/product-card-overlay-presets";

/** Совпадает с CardBuilderSlideRole в productCardBuilderPlan */
export type CardBuilderTemplateSlideRole =
  | "main_photo"
  | "benefits_infographic"
  | "dimensions"
  | "materials"
  | "lifestyle"
  | "detail_closeup"
  | "packaging"
  | "premium_poster"
  | "ad_banner";

export type CardBuilderTemplateDefinition = {
  templateId: string;
  label: string;
  slideRole: CardBuilderTemplateSlideRole;
  /** Маркетплейсы, для которых шаблон особенно уместен (подбор по умолчанию); не жёсткая валидация */
  recommendedFor: readonly string[];
  /** Абстрактное имя раскладки для UI и метаданных */
  layoutPreset: string;
  /** Пресет overlay V2 — общий с маркетплейс-карточкой */
  overlayTemplatePreset: ProductCardTemplatePresetId;
  typographyPreset?: ProductCardTypographyPresetId;
  overlayTemplate: "bottom_panel" | "left_panel" | "badges_callouts";
  textSlots: readonly string[];
  iconSlots: readonly string[];
  maxBenefits: number;
  allowText: boolean;
  defaultTextDensity: "none" | "minimal" | "medium" | "heavy" | "infographic";
  preserveProductRequired: boolean;
  /** Если true — после Kie накладываем серверный SVG с русским текстом */
  overlayRequired: boolean;
};

export const CARD_BUILDER_TEMPLATES: Record<string, CardBuilderTemplateDefinition> = {
  hero_clean: {
    templateId: "hero_clean",
    label: "Главное фото — чистый hero",
    slideRole: "main_photo",
    recommendedFor: ["ozon", "wildberries", "yandex_market", "kaspi"],
    layoutPreset: "product_center_clean",
    overlayTemplatePreset: "clean_catalog",
    typographyPreset: "marketplace",
    overlayTemplate: "bottom_panel",
    textSlots: ["title"],
    iconSlots: [],
    maxBenefits: 0,
    allowText: true,
    defaultTextDensity: "minimal",
    preserveProductRequired: true,
    overlayRequired: false,
  },
  benefits_grid: {
    templateId: "benefits_grid",
    label: "Преимущества — сетка",
    slideRole: "benefits_infographic",
    recommendedFor: ["ozon", "wildberries", "yandex_market"],
    layoutPreset: "product_right_text_left",
    overlayTemplatePreset: "feature_grid",
    typographyPreset: "marketplace",
    overlayTemplate: "bottom_panel",
    textSlots: ["title", "benefit_1", "benefit_2", "benefit_3", "benefit_4"],
    iconSlots: ["shield", "droplet", "star", "size"],
    maxBenefits: 4,
    allowText: true,
    defaultTextDensity: "medium",
    preserveProductRequired: true,
    overlayRequired: true,
  },
  benefits_left_column: {
    templateId: "benefits_left_column",
    label: "Преимущества — колонка слева",
    slideRole: "benefits_infographic",
    recommendedFor: ["wildberries", "instagram_vk"],
    layoutPreset: "text_column_left",
    overlayTemplatePreset: "minimal_top_bottom",
    typographyPreset: "minimalism",
    overlayTemplate: "left_panel",
    textSlots: ["title", "benefit_1", "benefit_2", "benefit_3", "benefit_4"],
    iconSlots: ["shield", "droplet", "star", "size"],
    maxBenefits: 4,
    allowText: true,
    defaultTextDensity: "medium",
    preserveProductRequired: true,
    overlayRequired: true,
  },
  dark_premium: {
    templateId: "dark_premium",
    label: "Премиум тёмная карточка",
    slideRole: "premium_poster",
    recommendedFor: ["premium", "luxury"],
    layoutPreset: "poster_dark_negative_space",
    overlayTemplatePreset: "dark_infographic",
    typographyPreset: "premium",
    overlayTemplate: "badges_callouts",
    textSlots: ["title", "subtitle"],
    iconSlots: ["star"],
    maxBenefits: 0,
    allowText: true,
    defaultTextDensity: "minimal",
    preserveProductRequired: true,
    overlayRequired: false,
  },
  dark_premium_benefits: {
    templateId: "dark_premium_benefits",
    label: "Преимущества — тёмная премиум",
    slideRole: "benefits_infographic",
    recommendedFor: ["wildberries", "ozon"],
    layoutPreset: "dark_grid_benefits",
    overlayTemplatePreset: "dark_infographic",
    typographyPreset: "premium",
    overlayTemplate: "badges_callouts",
    textSlots: ["title", "benefit_1", "benefit_2", "benefit_3"],
    iconSlots: ["star", "shield", "droplet"],
    maxBenefits: 3,
    allowText: true,
    defaultTextDensity: "medium",
    preserveProductRequired: true,
    overlayRequired: true,
  },
  protection_features: {
    templateId: "protection_features",
    label: "Защита и свойства",
    slideRole: "benefits_infographic",
    recommendedFor: ["gadgets_and_tech", "beauty_and_care"],
    layoutPreset: "feature_strip_bottom",
    overlayTemplatePreset: "feature_grid",
    typographyPreset: "marketplace",
    overlayTemplate: "bottom_panel",
    textSlots: ["title", "benefit_1", "benefit_2", "benefit_3"],
    iconSlots: ["shield", "droplet", "check"],
    maxBenefits: 3,
    allowText: true,
    defaultTextDensity: "medium",
    preserveProductRequired: true,
    overlayRequired: true,
  },
  material_focus: {
    templateId: "material_focus",
    label: "Материалы и фактура",
    slideRole: "materials",
    recommendedFor: ["apparel", "home_and_furniture"],
    layoutPreset: "macro_bottom_caption",
    overlayTemplatePreset: "lifestyle_model",
    typographyPreset: "fashion",
    overlayTemplate: "bottom_panel",
    textSlots: ["title", "benefit_1", "benefit_2"],
    iconSlots: ["fabric", "shield"],
    maxBenefits: 2,
    allowText: true,
    defaultTextDensity: "minimal",
    preserveProductRequired: true,
    overlayRequired: true,
  },
  size_range: {
    templateId: "size_range",
    label: "Размерный ряд / габариты",
    slideRole: "dimensions",
    recommendedFor: ["apparel", "accessories"],
    layoutPreset: "size_badges_footer",
    overlayTemplatePreset: "feature_grid",
    typographyPreset: "marketplace",
    overlayTemplate: "bottom_panel",
    textSlots: ["title", "size_line", "benefit_1"],
    iconSlots: ["size"],
    maxBenefits: 1,
    allowText: true,
    defaultTextDensity: "minimal",
    preserveProductRequired: true,
    overlayRequired: true,
  },
  dimensions_schema: {
    templateId: "dimensions_schema",
    label: "Схема размеров",
    slideRole: "dimensions",
    recommendedFor: ["home_and_furniture", "gadgets_and_tech"],
    layoutPreset: "diagram_safe_zones",
    overlayTemplatePreset: "dark_infographic",
    typographyPreset: "minimalism",
    overlayTemplate: "bottom_panel",
    textSlots: ["title", "size_line", "benefit_1"],
    iconSlots: ["size"],
    maxBenefits: 1,
    allowText: true,
    defaultTextDensity: "minimal",
    preserveProductRequired: true,
    overlayRequired: true,
  },
  lifestyle_card: {
    templateId: "lifestyle_card",
    label: "Lifestyle — в интерьере",
    slideRole: "lifestyle",
    recommendedFor: ["instagram_vk", "own_site"],
    layoutPreset: "scene_hero_bottom_title",
    overlayTemplatePreset: "lifestyle_model",
    typographyPreset: "fashion",
    overlayTemplate: "bottom_panel",
    textSlots: ["title"],
    iconSlots: [],
    maxBenefits: 0,
    allowText: true,
    defaultTextDensity: "minimal",
    preserveProductRequired: true,
    overlayRequired: false,
  },
  comparison_card: {
    templateId: "comparison_card",
    label: "Сравнение / коллауты",
    slideRole: "benefits_infographic",
    recommendedFor: ["gadgets_and_tech"],
    layoutPreset: "dual_column_facts",
    overlayTemplatePreset: "feature_grid",
    typographyPreset: "marketplace",
    overlayTemplate: "badges_callouts",
    textSlots: ["title", "benefit_1", "benefit_2", "benefit_3"],
    iconSlots: ["check", "shield", "lightning"],
    maxBenefits: 3,
    allowText: true,
    defaultTextDensity: "heavy",
    preserveProductRequired: true,
    overlayRequired: true,
  },
  package_card: {
    templateId: "package_card",
    label: "Упаковка и комплект",
    slideRole: "packaging",
    recommendedFor: ["ozon", "wildberries"],
    layoutPreset: "kit_footer_strip",
    overlayTemplatePreset: "clean_catalog",
    typographyPreset: "marketplace",
    overlayTemplate: "bottom_panel",
    textSlots: ["title", "benefit_1"],
    iconSlots: ["check"],
    maxBenefits: 1,
    allowText: true,
    defaultTextDensity: "minimal",
    preserveProductRequired: true,
    overlayRequired: false,
  },
  premium_poster: {
    templateId: "premium_poster",
    label: "Премиальный постер",
    slideRole: "premium_poster",
    recommendedFor: ["instagram_vk", "premium"],
    layoutPreset: "poster_negative_space",
    overlayTemplatePreset: "promo_poster",
    typographyPreset: "premium",
    overlayTemplate: "badges_callouts",
    textSlots: ["title", "subtitle"],
    iconSlots: ["star"],
    maxBenefits: 0,
    allowText: true,
    defaultTextDensity: "minimal",
    preserveProductRequired: true,
    overlayRequired: false,
  },
  ad_banner: {
    templateId: "ad_banner",
    label: "Рекламный баннер",
    slideRole: "ad_banner",
    recommendedFor: ["instagram_vk", "bold_ad"],
    layoutPreset: "banner_wide_footer",
    overlayTemplatePreset: "promo_poster",
    typographyPreset: "marketplace",
    overlayTemplate: "badges_callouts",
    textSlots: ["title", "benefit_1"],
    iconSlots: ["check"],
    maxBenefits: 1,
    allowText: true,
    defaultTextDensity: "minimal",
    preserveProductRequired: false,
    overlayRequired: false,
  },
  texture_closeup: {
    templateId: "texture_closeup",
    label: "Текстура крупным планом",
    slideRole: "detail_closeup",
    recommendedFor: ["beauty_and_care", "apparel"],
    layoutPreset: "macro_minimal",
    overlayTemplatePreset: "clean_catalog",
    typographyPreset: "minimalism",
    overlayTemplate: "bottom_panel",
    textSlots: ["title"],
    iconSlots: [],
    maxBenefits: 0,
    allowText: false,
    defaultTextDensity: "none",
    preserveProductRequired: true,
    overlayRequired: false,
  },
  ingredients_effect: {
    templateId: "ingredients_effect",
    label: "Состав и эффект",
    slideRole: "materials",
    recommendedFor: ["beauty_and_care"],
    layoutPreset: "science_footer_chips",
    overlayTemplatePreset: "light_marketplace",
    typographyPreset: "minimalism",
    overlayTemplate: "bottom_panel",
    textSlots: ["title", "benefit_1", "benefit_2", "benefit_3"],
    iconSlots: ["leaf", "droplet", "shield"],
    maxBenefits: 3,
    allowText: true,
    defaultTextDensity: "medium",
    preserveProductRequired: true,
    overlayRequired: true,
  },
  feature_callouts: {
    templateId: "feature_callouts",
    label: "Функции и коллауты",
    slideRole: "detail_closeup",
    recommendedFor: ["gadgets_and_tech"],
    layoutPreset: "callouts_over_detail",
    overlayTemplatePreset: "feature_grid",
    typographyPreset: "marketplace",
    overlayTemplate: "badges_callouts",
    textSlots: ["title", "benefit_1", "benefit_2"],
    iconSlots: ["lightning", "shield"],
    maxBenefits: 2,
    allowText: true,
    defaultTextDensity: "medium",
    preserveProductRequired: true,
    overlayRequired: true,
  },
  interface_detail: {
    templateId: "interface_detail",
    label: "Интерфейс или деталь",
    slideRole: "detail_closeup",
    recommendedFor: ["gadgets_and_tech"],
    layoutPreset: "detail_focus_corner",
    overlayTemplatePreset: "dark_infographic",
    typographyPreset: "minimalism",
    overlayTemplate: "bottom_panel",
    textSlots: ["title", "benefit_1"],
    iconSlots: ["eye"],
    maxBenefits: 1,
    allowText: true,
    defaultTextDensity: "minimal",
    preserveProductRequired: true,
    overlayRequired: true,
  },
  size_scale: {
    templateId: "size_scale",
    label: "Масштаб и размеры",
    slideRole: "dimensions",
    recommendedFor: ["gadgets_and_tech"],
    layoutPreset: "scale_comparison_footer",
    overlayTemplatePreset: "feature_grid",
    typographyPreset: "marketplace",
    overlayTemplate: "bottom_panel",
    textSlots: ["title", "size_line"],
    iconSlots: ["size"],
    maxBenefits: 0,
    allowText: true,
    defaultTextDensity: "minimal",
    preserveProductRequired: true,
    overlayRequired: true,
  },
};

export function getCardBuilderTemplate(templateId: string): CardBuilderTemplateDefinition | undefined {
  return CARD_BUILDER_TEMPLATES[templateId];
}

export function listTemplatesForSlideRole(role: CardBuilderTemplateSlideRole): CardBuilderTemplateDefinition[] {
  return Object.values(CARD_BUILDER_TEMPLATES).filter((t) => t.slideRole === role);
}

/** Последовательности шаблонов для полной галереи по категории товара */
const FULL_6_APPAREL: readonly string[] = [
  "hero_clean",
  "benefits_grid",
  "material_focus",
  "lifestyle_card",
  "size_range",
  "premium_poster",
];

const FULL_6_FURNITURE: readonly string[] = [
  "hero_clean",
  "lifestyle_card",
  "material_focus",
  "dimensions_schema",
  "benefits_grid",
  "premium_poster",
];

const FULL_6_BEAUTY: readonly string[] = [
  "hero_clean",
  "texture_closeup",
  "benefits_grid",
  "ingredients_effect",
  "lifestyle_card",
  "premium_poster",
];

const FULL_6_TECH: readonly string[] = [
  "hero_clean",
  "feature_callouts",
  "interface_detail",
  "size_scale",
  "benefits_grid",
  "premium_poster",
];

const FULL_6_DEFAULT: readonly string[] = [
  "hero_clean",
  "benefits_grid",
  "material_focus",
  "dimensions_schema",
  "lifestyle_card",
  "premium_poster",
];

const FULL_8_TECH: readonly string[] = [
  "hero_clean",
  "feature_callouts",
  "interface_detail",
  "size_scale",
  "benefits_grid",
  "lifestyle_card",
  "comparison_card",
  "ad_banner",
];

function seqForCategory(categoryId: string): readonly string[] {
  const id = categoryId as ProductCategoryId;
  if (id === "apparel" || id === "accessories") return FULL_6_APPAREL;
  if (id === "home_and_furniture") return FULL_6_FURNITURE;
  if (id === "beauty_and_care") return FULL_6_BEAUTY;
  if (id === "gadgets_and_tech") return FULL_6_TECH;
  return FULL_6_DEFAULT;
}

export function pickGalleryTemplateSequence(categoryId: string, slideCount: 6 | 8): string[] {
  const six = [...seqForCategory(categoryId)];
  if (slideCount === 6) return six;
  if ((categoryId as ProductCategoryId) === "gadgets_and_tech") {
    return [...FULL_8_TECH];
  }
  return [...six, "texture_closeup", "package_card"];
}

const ROLE_DEFAULT_TEMPLATE: Partial<Record<string, string>> = {
  main_photo: "hero_clean",
  benefits_infographic: "benefits_grid",
  dimensions: "dimensions_schema",
  materials: "material_focus",
  lifestyle: "lifestyle_card",
  detail_closeup: "texture_closeup",
  packaging: "package_card",
  premium_poster: "premium_poster",
  ad_banner: "ad_banner",
};

export function defaultTemplateForSlideRole(role: CardBuilderTemplateSlideRole): string {
  return ROLE_DEFAULT_TEMPLATE[role] ?? "hero_clean";
}

export function cardBuilderRoleUserPreviewCaption(role: CardBuilderTemplateSlideRole): string {
  const map: Record<CardBuilderTemplateSlideRole, string> = {
    main_photo: "Главное фото — товар на чистом фоне",
    benefits_infographic: "Преимущества — ваши фразы будут встроены в дизайн",
    materials: "Материалы — акцент на фактуру и качество",
    dimensions: "Размеры — слайд с характеристиками",
    lifestyle: "Lifestyle — товар в использовании",
    premium_poster: "Постер — рекламный слайд",
    ad_banner: "Рекламный баннер",
    detail_closeup: "Детали — крупный план",
    packaging: "Упаковка и комплект",
  };
  return map[role] ?? map.main_photo;
}

/** Короткая подпись для превью галереи (без промптов и технички). */
export function templatePreviewCaption(templateId: string): string {
  const captions: Partial<Record<string, string>> = {
    hero_clean: "Товар на чистом фоне",
    benefits_grid: "До четырёх преимуществ на плашках",
    benefits_left_column: "Преимущества в колонке",
    dark_premium_benefits: "Преимущества на тёмном фоне",
    protection_features: "Защита и свойства на плашках",
    material_focus: "Фактура, качество и детали",
    size_range: "Размерный ряд или габариты",
    dimensions_schema: "Схема размеров",
    lifestyle_card: "Товар в использовании",
    comparison_card: "Сравнение и коллауты",
    package_card: "Упаковка и комплект",
    premium_poster: "Премиальный рекламный слайд",
    dark_premium: "Тёмная премиум-подача",
    ad_banner: "Рекламный баннер",
    texture_closeup: "Текстура и детали крупным планом",
    ingredients_effect: "Состав и эффект",
    feature_callouts: "Функции и акценты",
    interface_detail: "Интерфейс или ключевая деталь",
    size_scale: "Масштаб и размеры",
  };
  return captions[templateId] ?? getCardBuilderTemplate(templateId)?.label ?? "";
}
