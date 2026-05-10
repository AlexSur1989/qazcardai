import { isAdminPricingPinned } from "../../src/lib/admin-pricing-pinned";

const OMIT_WHEN_PINNED_KEYS = ["costCredits", "pricingSchema", "realCost"] as const;

/**
 * Если в БД уже задана цена админом (`pricingSchema.adminPricingPinned`),
 * реплики сидов не перезаписывают costCredits / pricingSchema / realCost.
 */
export function omitSeedPricingWhenPinned<
  T extends Record<string, unknown>,
>(existing: { pricingSchema?: unknown } | null, update: T): T {
  if (!existing || !isAdminPricingPinned(existing.pricingSchema)) {
    return update;
  }
  const next = { ...update };
  for (const k of OMIT_WHEN_PINNED_KEYS) {
    delete next[k];
  }
  return next;
}
