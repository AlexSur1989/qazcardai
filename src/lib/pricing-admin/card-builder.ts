import { z } from "zod";

import type { ProductCardCardBuilderPricing } from "@/server/services/productCardSettings";
import { computeCardBuilderCreditsBeforeMargin } from "@/server/services/productCardPricing";

export const CARD_BUILDER_PRICING_SETTING_KEY = "PRODUCT_CARD_CARD_BUILDER_PRICING";

export const DEFAULT_CARD_BUILDER_PRICING_API = {
  planCredits: 0,
  singleSlideCredits: 150,
  gallery6Credits: 750,
  gallery8Credits: 950,
  multipliers: {
    premiumStyle: 1.2,
    heavyTextInfographic: 1.1,
  },
} as const;

export const cardBuilderPricingPatchSchema = z.object({
  planCredits: z.number().int().min(0),
  singleSlideCredits: z.number().int().min(1),
  gallery6Credits: z.number().int().min(1),
  gallery8Credits: z.number().int().min(1),
  multipliers: z.object({
    premiumStyle: z.number().min(1).max(5),
    heavyTextInfographic: z.number().min(1).max(5),
  }),
});

export type CardBuilderPricingApi = z.infer<typeof cardBuilderPricingPatchSchema>;

export function storageToCardBuilderPricingApi(
  raw: ProductCardCardBuilderPricing,
): CardBuilderPricingApi {
  return {
    planCredits: raw.cardBuilderPlanCredits,
    singleSlideCredits: raw.cardBuilderSingleSlideCredits,
    gallery6Credits: raw.cardBuilderGallery6Credits,
    gallery8Credits: raw.cardBuilderGallery8Credits,
    multipliers: {
      premiumStyle: raw.multipliers.premiumStyle,
      heavyTextInfographic: raw.multipliers.heavyTextInfographic,
    },
  };
}

export function cardBuilderPricingApiToStorage(
  api: CardBuilderPricingApi,
  preserveUnknown?: Record<string, unknown>,
): Record<string, unknown> {
  const base = preserveUnknown && typeof preserveUnknown === "object" ? { ...preserveUnknown } : {};
  return {
    ...base,
    cardBuilderPlanCredits: Math.round(api.planCredits),
    cardBuilderSingleSlideCredits: Math.round(api.singleSlideCredits),
    cardBuilderGallery6Credits: Math.round(api.gallery6Credits),
    cardBuilderGallery8Credits: Math.round(api.gallery8Credits),
    multipliers: {
      ...(typeof base.multipliers === "object" && base.multipliers && !Array.isArray(base.multipliers)
        ? (base.multipliers as Record<string, unknown>)
        : {}),
      premiumStyle: api.multipliers.premiumStyle,
      heavyTextInfographic: api.multipliers.heavyTextInfographic,
    },
  };
}

export function cardBuilderPricingToProductCardShape(
  api: CardBuilderPricingApi,
): ProductCardCardBuilderPricing {
  return {
    cardBuilderPlanCredits: api.planCredits,
    cardBuilderSingleSlideCredits: api.singleSlideCredits,
    cardBuilderGallery6Credits: api.gallery6Credits,
    cardBuilderGallery8Credits: api.gallery8Credits,
    multipliers: { ...api.multipliers },
  };
}

export type CardBuilderPricingPreviewLine = {
  label: string;
  formula: string;
  credits: number;
};

export function buildCardBuilderPricingPreview(
  pricing: ProductCardCardBuilderPricing,
): CardBuilderPricingPreviewLine[] {
  const prem = { premiumStyle: true, heavyText: false };
  const premHeavy = { premiumStyle: true, heavyText: true };
  const slidePrem = computeCardBuilderCreditsBeforeMargin("slide", pricing, prem);
  const slidePremHeavy = computeCardBuilderCreditsBeforeMargin("slide", pricing, premHeavy);
  const g6Prem = computeCardBuilderCreditsBeforeMargin("gallery6", pricing, prem);
  const g8PremHeavy = computeCardBuilderCreditsBeforeMargin("gallery8", pricing, premHeavy);

  const m = pricing.multipliers;
  return [
    {
      label: "1 слайд (premium)",
      credits: slidePrem,
      formula: `${pricing.cardBuilderSingleSlideCredits} × premium ${m.premiumStyle} = ${slidePrem}`,
    },
    {
      label: "1 слайд (premium + heavy)",
      credits: slidePremHeavy,
      formula: `${pricing.cardBuilderSingleSlideCredits} × premium ${m.premiumStyle} × heavy ${m.heavyTextInfographic} = ${slidePremHeavy}`,
    },
    {
      label: "Галерея 6 (premium)",
      credits: g6Prem,
      formula: `${pricing.cardBuilderGallery6Credits} × premium ${m.premiumStyle} = ${g6Prem}`,
    },
    {
      label: "Галерея 8 (premium + heavy)",
      credits: g8PremHeavy,
      formula: `${pricing.cardBuilderGallery8Credits} × premium ${m.premiumStyle} × heavy ${m.heavyTextInfographic} = ${g8PremHeavy}`,
    },
  ];
}

export function cardBuilderPricingSoftWarnings(
  api: CardBuilderPricingApi,
): string[] {
  const w: string[] = [];
  if (api.gallery6Credits < api.singleSlideCredits * 3) {
    w.push(
      `Галерея 6 (${api.gallery6Credits}) меньше 3× цены одного слайда (${api.singleSlideCredits * 3}) — клиентам может быть выгоднее генерировать по одному.`,
    );
  }
  if (api.gallery8Credits < api.gallery6Credits) {
    w.push(
      `Галерея 8 (${api.gallery8Credits}) дешевле галереи 6 (${api.gallery6Credits}).`,
    );
  }
  if (api.gallery8Credits < api.singleSlideCredits * 4) {
    w.push(
      `Галерея 8 (${api.gallery8Credits}) меньше 4× цены одного слайда.`,
    );
  }
  return w;
}
