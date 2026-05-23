import { createHash } from "node:crypto";

import { PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION } from "@/config/product-card-marketplace-profiles";
import { styleReferenceFingerprintPayload } from "@/lib/card-builder-style-reference";

import type { CardBuilderGallerySlide, CardBuilderPlanInput } from "@/server/services/productCardBuilderPlan";

export type CardBuilderPlanFingerprintInput = {
  selectedCategory: string;
  marketplace: string;
  goal: string;
  preserveProduct?: boolean;
  preserveAspects: string[];
  allowCreativeStylization?: boolean;
  languageMode?: string;
  audience: string;
  priceSegment: string;
  salesStyle: string;
  textDensity: string;
  marketplaceProfileId?: string;
  marketplaceProfileVersion?: string;
  targetPlatform?: string;
  cardBuilderCategoryKey?: string;
  creationMode?: string;
  singleCardType?: string;
  visualStyle?: string;
  productFactsFingerprint?: string;
  styleReferenceFingerprint?: Record<string, unknown>;
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

function productFactsFingerprint(plan: CardBuilderPlanInput): string | undefined {
  const facts = plan.productFacts ?? [];
  if (!facts.length) return undefined;
  const norm = facts
    .map((f) => ({
      id: f.id,
      label: f.label.trim(),
      value: f.value.trim(),
      type: f.type,
      visibleOnCard: f.visibleOnCard ?? true,
      lockedText: f.lockedText ?? false,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify(norm)).digest("hex");
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
    languageMode: plan.languageMode ?? "auto",
    audience: plan.audience,
    priceSegment: plan.priceSegment,
    salesStyle: plan.salesStyle,
    textDensity: plan.textDensity,
    targetPlatform: plan.targetPlatform ?? "universal",
    cardBuilderCategoryKey: plan.cardBuilderCategoryKey ?? "auto",
    creationMode: plan.creationMode ?? "full_gallery",
    singleCardType: plan.singleCardType ?? "auto",
    visualStyle: plan.visualStyle ?? "auto",
    ...(plan.marketplaceProfileId ? { marketplaceProfileId: plan.marketplaceProfileId } : {}),
    ...(plan.marketplaceProfileVersion ? { marketplaceProfileVersion: plan.marketplaceProfileVersion } : {}),
    ...(plan.productFactsFingerprint ? { productFactsFingerprint: plan.productFactsFingerprint } : {}),
    ...(plan.styleReferenceFingerprint && Object.keys(plan.styleReferenceFingerprint).length
      ? { styleReferenceFingerprint: plan.styleReferenceFingerprint }
      : {}),
  };

  const body = JSON.stringify({
    plan: planNorm,
    slides: slideStrip(slides),
  });
  return createHash("sha256").update(body).digest("hex");
}

export function cardBuilderLivePlanFingerprintInputs(
  plan: CardBuilderPlanInput,
  profileId: string,
): CardBuilderPlanFingerprintInput {
  const styleReferenceFingerprint = styleReferenceFingerprintPayload(plan.styleReference);
  const factsFp = productFactsFingerprint(plan);
  return {
    selectedCategory: plan.selectedCategory,
    marketplace: plan.marketplace,
    goal: plan.goal,
    preserveProduct: plan.preserveProduct ?? true,
    preserveAspects: plan.preserveAspects ?? [],
    allowCreativeStylization: plan.allowCreativeStylization,
    languageMode: plan.languageMode,
    audience: plan.audience,
    priceSegment: plan.priceSegment,
    salesStyle: plan.salesStyle,
    textDensity: plan.textDensity,
    targetPlatform: plan.targetPlatform,
    cardBuilderCategoryKey: plan.cardBuilderCategoryKey,
    creationMode: plan.creationMode,
    singleCardType: plan.singleCardType,
    visualStyle: plan.visualStyle,
    marketplaceProfileId: profileId,
    marketplaceProfileVersion: PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION,
    ...(factsFp ? { productFactsFingerprint: factsFp } : {}),
    ...(styleReferenceFingerprint ? { styleReferenceFingerprint } : {}),
  };
}
