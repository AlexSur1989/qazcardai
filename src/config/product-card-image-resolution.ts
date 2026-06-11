export const PRODUCT_CARD_IMAGE_RESOLUTIONS = ["1K", "2K", "4K"] as const;

export type ProductCardImageResolution = (typeof PRODUCT_CARD_IMAGE_RESOLUTIONS)[number];

export const PRODUCT_CARD_IMAGE_RESOLUTION_DEFAULT: ProductCardImageResolution = "1K";

export function isProductCardImageResolution(value: string): value is ProductCardImageResolution {
  return (PRODUCT_CARD_IMAGE_RESOLUTIONS as readonly string[]).includes(value);
}

/** GPT Image 2: 1:1 не поддерживает 4K. */
export function isProductCardImageResolutionAllowed(
  resolution: ProductCardImageResolution,
  aspectRatio: string,
): boolean {
  if (resolution === "4K" && aspectRatio === "1:1") return false;
  return true;
}

export function coerceProductCardImageResolution(
  resolution: string | undefined | null,
): ProductCardImageResolution {
  const t = String(resolution ?? "").trim();
  return isProductCardImageResolution(t) ? t : PRODUCT_CARD_IMAGE_RESOLUTION_DEFAULT;
}

/** Матрица цен по resolution для product_card_matrix (ключи resolution:1K …). */
export function buildProductCardImageResolutionPricingMatrix(baseTokens: number): Record<
  string,
  { tokens: number; providerCostUsd: number }
> {
  const base = Math.max(1, Math.round(baseTokens));
  const usd = (tokens: number) =>
    Math.round(((0.04 * tokens) / base) * 100_000) / 100_000;
  return {
    "resolution:1K": { tokens: base, providerCostUsd: usd(base) },
    "resolution:2K": { tokens: Math.max(base, Math.round(base * 1.35)), providerCostUsd: usd(Math.max(base, Math.round(base * 1.35))) },
    "resolution:4K": { tokens: Math.max(base, Math.round(base * 1.9)), providerCostUsd: usd(Math.max(base, Math.round(base * 1.9))) },
  };
}

export function buildProductCardImageResolutionPricingSchema(baseTokens: number) {
  const base = Math.max(1, Math.round(baseTokens));
  return {
    pricingScope: "PRODUCT_CARD",
    type: "product_card_matrix",
    baseTokens: base,
    providerCostUsd: 0.04,
    matrix: buildProductCardImageResolutionPricingMatrix(base),
  };
}
