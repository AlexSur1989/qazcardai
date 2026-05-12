import { getAppSetting } from "@/server/services/appSettings";
import type { AiModel } from "@/generated/prisma/client";
import type { ProductCardPriceBreakdown } from "@/server/services/productCardPricing";
import type { CardBuilderRecommendedTextMode } from "@/server/services/productCardBuilderPlan";
import { getProductCardSettings } from "@/server/services/productCardSettings";

export type CardBuilderPriceMultipliers = {
  premiumStyle?: number;
  heavyTextInfographic?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getCardBuilderPricingConstants(): Promise<{
  planCredits: number;
  singleSlideCredits: number;
  gallery6Credits: number;
  gallery8Credits: number;
  multipliers: CardBuilderPriceMultipliers;
}> {
  const [planRow, slideRow, g6, g8, multRow] = await Promise.all([
    getAppSetting("PRODUCT_CARD_BUILDER_PLAN_CREDITS"),
    getAppSetting("PRODUCT_CARD_BUILDER_SLIDE_CREDITS"),
    getAppSetting("PRODUCT_CARD_BUILDER_GALLERY_6_CREDITS"),
    getAppSetting("PRODUCT_CARD_BUILDER_GALLERY_8_CREDITS"),
    getAppSetting("PRODUCT_CARD_BUILDER_PRICE_MULTIPLIERS"),
  ]);
  const m = asRecord(multRow);
  return {
    planCredits: Math.round(asNumber(planRow, 0)),
    singleSlideCredits: Math.round(asNumber(slideRow, 150)),
    gallery6Credits: Math.round(asNumber(g6, 750)),
    gallery8Credits: Math.round(asNumber(g8, 950)),
    multipliers: {
      premiumStyle: m ? asNumber(m.premiumStyle, 1.2) : 1.2,
      heavyTextInfographic: m ? asNumber(m.heavyTextInfographic, 1.1) : 1.1,
    },
  };
}

const PREMIUM_SALES = new Set(["premium_sales", "editorial"]);

function applyMultiplier(
  baseCredits: number,
  salesStyle: string,
  textDensity: CardBuilderRecommendedTextMode,
  mult: CardBuilderPriceMultipliers,
): { credits: number; applied: Array<{ key: string; value: number }> } {
  let c = Math.max(0, Math.round(baseCredits));
  const applied: Array<{ key: string; value: number }> = [];
  if (PREMIUM_SALES.has(salesStyle)) {
    const f = Math.max(1, mult.premiumStyle ?? 1);
    c = Math.max(1, Math.round(c * f));
    applied.push({ key: "premiumStyle", value: f });
  }
  if (textDensity === "heavy" || textDensity === "infographic") {
    const f = Math.max(1, mult.heavyTextInfographic ?? 1);
    c = Math.max(1, Math.round(c * f));
    applied.push({ key: "heavyTextInfographic", value: f });
  }
  return { credits: c, applied };
}

export async function estimateCardBuilderPlanCreditsCost(): Promise<number> {
  const row = await getCardBuilderPricingConstants();
  return row.planCredits;
}

export async function estimateCardBuilderGalleryCredits(opts: {
  slideCount: 6 | 8;
  salesStyle: string;
  textDensity: CardBuilderRecommendedTextMode;
}): Promise<{ credits: number; breakdown: Record<string, unknown>; appliedMultipliers: Array<{ key: string; value: number }> }> {
  const row = await getCardBuilderPricingConstants();
  const base = opts.slideCount === 8 ? row.gallery8Credits : row.gallery6Credits;
  const scaled = applyMultiplier(base, opts.salesStyle, opts.textDensity, row.multipliers);
  return {
    credits: scaled.credits,
    appliedMultipliers: scaled.applied,
    breakdown: {
      kind: "card_builder_bundle",
      baseCredits: base,
      slideCount: opts.slideCount,
      multipliersApplied: scaled.applied,
    },
  };
}

export async function estimateCardBuilderSingleSlideCredits(opts: {
  salesStyle: string;
  textDensity: CardBuilderRecommendedTextMode;
}): Promise<{ credits: number; breakdown: Record<string, unknown>; appliedMultipliers: Array<{ key: string; value: number }> }> {
  const row = await getCardBuilderPricingConstants();
  const scaled = applyMultiplier(row.singleSlideCredits, opts.salesStyle, opts.textDensity, row.multipliers);
  return {
    credits: scaled.credits,
    appliedMultipliers: scaled.applied,
    breakdown: {
      kind: "card_builder_slide",
      baseCredits: row.singleSlideCredits,
      multipliersApplied: scaled.applied,
    },
  };
}

/** Фиксированный Product Card breakdown для очереди (внутренний сценарий card_builder). */
export async function buildCardBuilderPriceBreakdown(
  model: AiModel,
  finalCredits: number,
  extras: {
    scenarioKey?: string;
    slideRole?: string;
    slideId?: string;
    gallerySlides?: number;
    usedFallbackMarketplaceCard?: boolean;
    appliedMultipliers?: Array<{ key: string; value: number }>;
    finalCreditsField?: number;
  },
): Promise<ProductCardPriceBreakdown> {
  const settings = await getProductCardSettings();
  const tok = Math.round(finalCredits);
  const revenueKzt = Math.round(tok * settings.tokenValueKzt * 100) / 100;
  const formulaPieces = [`card_builder credits=${tok}`];
  if (extras.slideRole) formulaPieces.push(`slide=${extras.slideRole}`);
  if (extras.gallerySlides != null) formulaPieces.push(`gallery=${extras.gallerySlides}`);
  if (extras.usedFallbackMarketplaceCard) formulaPieces.push("fallback=marketplace_card_model");
  return {
    v: 2,
    pricingScope: "PRODUCT_CARD",
    scenario: "card_builder",
    scenarioKey: "card_builder",
    slideRole: extras.slideRole,
    finalCredits: extras.finalCreditsField ?? tok,
    productCardModelType: model.productCardModelType,
    modelId: model.id,
    modelSlug: model.slug,
    modelName: model.name,
    credits: tok,
    tokens: tok,
    providerCostUsd: 0,
    providerCostKzt: 0,
    revenueKzt,
    marginKzt: revenueKzt,
    marginPercent: 100,
    priceSource: "manual_override",
    formula: formulaPieces.join("; "),
    warnings: [],
    ...(extras.appliedMultipliers && extras.appliedMultipliers.length > 0
      ? { appliedMultipliers: extras.appliedMultipliers }
      : {}),
  };
}
