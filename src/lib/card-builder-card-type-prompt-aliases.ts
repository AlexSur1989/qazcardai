/** Алиасы slideRole/cardType key → канонический ключ cardTypePrompts v2.2. */
export const CARD_BUILDER_CARD_TYPE_PROMPT_ALIASES: Record<string, string> = {
  benefits: "benefits_infographic",
  infographic: "benefits_infographic",
  comparison: "comparison_card",
  dimensions: "dimensions_card",
  package: "package_contents",
  instruction: "usage_instruction",
  premium_banner: "premium_poster",
  lifestyle: "lifestyle_card",
  details: "detail_closeup",
  materials: "material_texture",
  offer_card: "offer_card",
  ad_banner: "offer_card",
};

export function resolveCardBuilderCardTypePromptKey(key: string): string {
  const k = key.trim();
  return CARD_BUILDER_CARD_TYPE_PROMPT_ALIASES[k] ?? k;
}
