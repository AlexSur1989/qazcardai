import { isRecord } from "@/lib/model-pricing-shared";

/**
 * Если `true`, сиды не перезаписывают costCredits / realCost / pricingSchema.
 * Выставляется при сохранении цены в админке (форма модели или PATCH pricing).
 */
export const ADMIN_PRICING_PINNED_KEY = "adminPricingPinned";

export function isAdminPricingPinned(pricingSchema: unknown): boolean {
  if (!isRecord(pricingSchema)) return false;
  return pricingSchema[ADMIN_PRICING_PINNED_KEY] === true;
}

export function withAdminPricingPinned(
  pricingSchema: Record<string, unknown>,
): Record<string, unknown> {
  return { ...pricingSchema, [ADMIN_PRICING_PINNED_KEY]: true };
}

export function withoutAdminPricingPinned(
  pricingSchema: Record<string, unknown>,
): Record<string, unknown> {
  const clone = { ...pricingSchema };
  delete clone[ADMIN_PRICING_PINNED_KEY];
  return clone;
}
