import { isAdminPricingPinned } from "../../src/lib/admin-pricing-pinned";

const OMIT_WHEN_PINNED_KEYS = ["costCredits", "pricingSchema", "realCost"] as const;
const OMIT_KIE_UNLESS_SEED_ALLOWED = [
  "settingsSchema",
  "payloadMapping",
  "metadata",
] as const;

const SEED_ALLOW_KIE_OVERRIDES_KEY = "seedAllowKieOverrides";

/**
 * Если в БД уже задана цена админом (`pricingSchema.adminPricingPinned`),
 * реплики сидов не перезаписывают costCredits / pricingSchema / realCost.
 * Дополнительно: при закреплении не трогаем settingsSchema/payloadMapping/metadata,
 * если в metadata модели не `seedAllowKieOverrides: true`.
 */
export function omitSeedPricingWhenPinned<
  T extends Record<string, unknown>,
>(
  existing: {
    pricingSchema?: unknown;
    metadata?: unknown;
  } | null,
  update: T,
): T {
  if (!existing || !isAdminPricingPinned(existing.pricingSchema)) {
    return update;
  }
  const next = { ...update };
  for (const k of OMIT_WHEN_PINNED_KEYS) {
    delete next[k];
  }
  const metadataWasFetched =
    Object.prototype.hasOwnProperty.call(existing, "metadata");
  if (!metadataWasFetched) {
    return next;
  }
  const meta =
    existing.metadata &&
    typeof existing.metadata === "object" &&
    !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};
  const allow = meta[SEED_ALLOW_KIE_OVERRIDES_KEY] === true;
  if (!allow) {
    for (const k of OMIT_KIE_UNLESS_SEED_ALLOWED) {
      delete next[k];
    }
  }
  return next;
}
