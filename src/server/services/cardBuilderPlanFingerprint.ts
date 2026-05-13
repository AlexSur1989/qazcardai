import { createHash } from "node:crypto";

import { PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION } from "@/config/product-card-marketplace-profiles";

import type { CardBuilderGallerySlide, CardBuilderPlanInput } from "@/server/services/productCardBuilderPlan";

export type CardBuilderPlanFingerprintInput = {
  selectedCategory: string;
  marketplace: string;
  goal: string;
  preserveProduct?: boolean;
  preserveAspects: string[];
  allowCreativeStylization?: boolean;
  benefits: string[];
  benefitsExtra?: string;
  subtitle?: string;
  dimensions?: string;
  languageMode?: string;
  mustShow: string[];
  audience: string;
  priceSegment: string;
  salesStyle: string;
  textDensity: string;
  marketplaceProfileId?: string;
  marketplaceProfileVersion?: string;
};

function slideStrip(slides: CardBuilderGallerySlide[]) {
  return slides.map((s) => ({
    slideId: s.slideId,
    imageRole: s.imageRole,
    templateId: s.templateId,
    layoutPreset: s.layoutPreset,
    sourceImageMode: s.sourceImageMode,
  }));
}

/** Детеминированный отпечаток плана: estimate отдаёт hash, generate сверяет до reserveCredits. */
export function computeCardBuilderPlanFingerprint(
  plan: CardBuilderPlanFingerprintInput,
  slides: CardBuilderGallerySlide[],
): string {
  const planNorm: CardBuilderPlanFingerprintInput = {
    selectedCategory: plan.selectedCategory,
    marketplace: plan.marketplace,
    goal: plan.goal,
    preserveProduct: plan.preserveProduct ?? true,
    preserveAspects: [...plan.preserveAspects].sort(),
    allowCreativeStylization: Boolean(plan.allowCreativeStylization),
    benefits: [...plan.benefits].sort(),
    benefitsExtra: (plan.benefitsExtra ?? "").trim(),
    subtitle: (plan.subtitle ?? "").trim(),
    dimensions: (plan.dimensions ?? "").trim(),
    languageMode: plan.languageMode ?? "auto",
    mustShow: [...plan.mustShow].sort(),
    audience: plan.audience,
    priceSegment: plan.priceSegment,
    salesStyle: plan.salesStyle,
    textDensity: plan.textDensity,
    ...(plan.marketplaceProfileId ? { marketplaceProfileId: plan.marketplaceProfileId } : {}),
    ...(plan.marketplaceProfileVersion ? { marketplaceProfileVersion: plan.marketplaceProfileVersion } : {}),
  };

  const body = JSON.stringify({
    plan: planNorm,
    slides: slideStrip(slides),
  });
  return createHash("sha256").update(body).digest("hex");
}

/** Вход fingerprint из актуального плана + id профиля (merge из AppSetting уже в planInput.marketplaceProfileId если сохранено). */
export function cardBuilderLivePlanFingerprintInputs(
  plan: CardBuilderPlanInput,
  profileId: string,
): CardBuilderPlanFingerprintInput {
  return {
    selectedCategory: plan.selectedCategory,
    marketplace: plan.marketplace,
    goal: plan.goal,
    preserveProduct: plan.preserveProduct ?? true,
    preserveAspects: plan.preserveAspects ?? [],
    allowCreativeStylization: plan.allowCreativeStylization,
    benefits: plan.benefits ?? [],
    benefitsExtra: plan.benefitsExtra,
    subtitle: plan.subtitle,
    dimensions: plan.dimensions,
    languageMode: plan.languageMode,
    mustShow: plan.mustShow ?? [],
    audience: plan.audience,
    priceSegment: plan.priceSegment,
    salesStyle: plan.salesStyle,
    textDensity: plan.textDensity,
    marketplaceProfileId: profileId,
    marketplaceProfileVersion: PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION,
  };
}
