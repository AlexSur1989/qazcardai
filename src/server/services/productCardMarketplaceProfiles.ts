import "server-only";

import {
  PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION,
  type AppliedMarketplaceRulesSnapshot,
  type ProductCardMarketplaceProfile,
  buildAppliedMarketplaceRulesSnapshot,
} from "@/config/product-card-marketplace-profiles";
import { isUniversalCardBuilderTarget, UNIVERSAL_CARD_BUILDER_PROFILE } from "@/config/universal-card-builder-profile";

/** Снимок для Generation.metadata.card_builder — только ключевые применённые правила */
export type CardBuilderGenerationAppliedMarketplaceRules = {
  mainPhotoTextAllowed: boolean;
  maxBenefitBadges: number;
};

/** Для card_builder всегда возвращает универсальный профиль. */
export async function getMergedProductCardMarketplaceProfiles(): Promise<
  ProductCardMarketplaceProfile[]
> {
  return [UNIVERSAL_CARD_BUILDER_PROFILE];
}

export async function resolveProductCardMarketplaceProfile(
  marketplaceId: string,
): Promise<
  | { ok: true; profile: ProductCardMarketplaceProfile }
  | { ok: false; error: string; status: number; code?: string }
> {
  void marketplaceId;
  return { ok: true, profile: UNIVERSAL_CARD_BUILDER_PROFILE };
}

export async function resolveCardBuilderPlanMarketplaceProfile(plan: {
  targetPlatform?: string | null;
  marketplace?: string | null;
}): Promise<
  | { ok: true; profile: ProductCardMarketplaceProfile }
  | { ok: false; error: string; status: number; code?: string }
> {
  void plan;
  if (isUniversalCardBuilderTarget(plan.targetPlatform ?? "universal")) {
    return { ok: true, profile: UNIVERSAL_CARD_BUILDER_PROFILE };
  }
  return { ok: true, profile: UNIVERSAL_CARD_BUILDER_PROFILE };
}

export function marketplaceBenefitsOverLimitMessage(
  benefits: readonly string[] | undefined,
  profile: ProductCardMarketplaceProfile,
): string | null {
  const n = benefits?.length ?? 0;
  if (n <= profile.maxBenefitBadges) return null;
  return `Слишком много акцентов преимуществ (${n}). Можно не более ${profile.maxBenefitBadges}. Уберите лишнее и сохраните структуру снова.`;
}

export function buildCardBuilderGenerationMarketplaceRules(
  profile: ProductCardMarketplaceProfile,
): CardBuilderGenerationAppliedMarketplaceRules {
  return {
    mainPhotoTextAllowed: profile.mainPhotoTextAllowed,
    maxBenefitBadges: profile.maxBenefitBadges,
  };
}

export {
  buildAppliedMarketplaceRulesSnapshot,
  PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION,
  type AppliedMarketplaceRulesSnapshot,
};
