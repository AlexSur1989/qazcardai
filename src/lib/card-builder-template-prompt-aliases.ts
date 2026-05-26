/** Алиасы templateId → ключ в templatePrompts (AppSetting / defaults). */
export const CARD_BUILDER_TEMPLATE_PROMPT_ALIASES: Record<string, string> = {
  size_scale: "scale_comparison",
  set_contents: "packaging_set",
  premium_banner: "premium_poster",
  lifestyle: "lifestyle_scene",
  lifestyle_card: "lifestyle_scene",
  interior_lifestyle: "lifestyle_scene",
  fashion_lifestyle: "lifestyle_scene",
  beauty_lifestyle: "lifestyle_scene",
  food_lifestyle: "lifestyle_scene",
  usage_scenario: "lifestyle_scene",
  details: "detail_closeup",
  texture_closeup: "detail_closeup",
  fabric_closeup: "detail_closeup",
  interface_detail: "detail_closeup",
  materials: "materials_texture",
  material_focus: "materials_texture",
  ingredients_effect: "materials_texture",
  dimensions: "dimensions_size",
  dimensions_schema: "dimensions_size",
  size_range: "dimensions_size",
  benefits: "benefits_infographic",
  benefits_grid: "benefits_infographic",
  benefits_left_column: "benefits_infographic",
  dark_premium_benefits: "benefits_infographic",
  protection_features: "benefits_infographic",
  main: "main_photo",
  hero: "main_photo",
  hero_clean: "main_photo",
  product_packshot: "main_photo",
  realistic_listing: "main_photo",
  brand_hero: "main_photo",
  package_card: "packaging_set",
  gift_packaging: "packaging_set",
};

/** Fallback template prompt keys по slideRole, если lookup по templateId пуст. */
export const CARD_BUILDER_TEMPLATE_PROMPT_ROLE_FALLBACK: Record<string, string> = {
  main_photo: "main_photo",
  benefits_infographic: "benefits_infographic",
  dimensions: "dimensions_size",
  materials: "materials_texture",
  lifestyle: "lifestyle_scene",
  detail_closeup: "detail_closeup",
  packaging: "packaging_set",
  premium_poster: "premium_poster",
  ad_banner: "ad_banner",
};

export function resolveCardBuilderTemplatePromptKey(templateId?: string | null): string {
  const id = templateId?.trim();
  if (!id) return "main_photo";
  return CARD_BUILDER_TEMPLATE_PROMPT_ALIASES[id] ?? id;
}
