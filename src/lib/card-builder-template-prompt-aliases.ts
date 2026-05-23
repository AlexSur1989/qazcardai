/** Алиасы templateId → ключ в templatePrompts (AppSetting / defaults). */
export const CARD_BUILDER_TEMPLATE_PROMPT_ALIASES: Record<string, string> = {
  size_scale: "scale_comparison",
  set_contents: "set_contents",
};

/** Fallback template prompt keys по slideRole, если lookup по templateId пуст. */
export const CARD_BUILDER_TEMPLATE_PROMPT_ROLE_FALLBACK: Record<string, string> = {
  main_photo: "hero_clean",
  benefits_infographic: "benefits_grid",
  dimensions: "scale_comparison",
  materials: "material_focus",
  lifestyle: "lifestyle_card",
  detail_closeup: "texture_closeup",
  packaging: "package_card",
  premium_poster: "premium_poster",
  ad_banner: "ad_banner",
};

export function resolveCardBuilderTemplatePromptKey(templateId?: string | null): string {
  const id = templateId?.trim();
  if (!id) return "hero_clean";
  return CARD_BUILDER_TEMPLATE_PROMPT_ALIASES[id] ?? id;
}
