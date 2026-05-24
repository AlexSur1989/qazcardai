/** Чистая математика тарифов card_builder — без server/prisma (safe для client bundle). */

export type CardBuilderPricingShape = {
  cardBuilderPlanCredits: number;
  cardBuilderSingleSlideCredits: number;
  cardBuilderGallery6Credits: number;
  cardBuilderGallery8Credits: number;
  multipliers: {
    premiumStyle: number;
    heavyTextInfographic: number;
  };
};

export function computeCardBuilderCreditsBeforeMargin(
  kind: "slide" | "gallery6" | "gallery8",
  cardBuilderPricing: CardBuilderPricingShape,
  opts: { premiumStyle?: boolean; heavyText?: boolean },
): number {
  let n =
    kind === "slide"
      ? cardBuilderPricing.cardBuilderSingleSlideCredits
      : kind === "gallery6"
        ? cardBuilderPricing.cardBuilderGallery6Credits
        : cardBuilderPricing.cardBuilderGallery8Credits;
  if (opts.premiumStyle) {
    n = Math.ceil(n * cardBuilderPricing.multipliers.premiumStyle);
  }
  if (opts.heavyText) {
    n = Math.ceil(n * cardBuilderPricing.multipliers.heavyTextInfographic);
  }
  return Math.max(1, Math.round(n));
}
