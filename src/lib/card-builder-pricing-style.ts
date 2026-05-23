import type { CardBuilderProductFact } from "@/lib/card-builder-product-facts";
import {
  lockedTextPhrasesFromFacts,
  productFactsForSlideRole,
} from "@/lib/card-builder-product-facts";
import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
import { computeEffectiveCardBuilderSettings } from "@/lib/card-builder-effective-settings";
import { derivePlanStyleFields } from "@/lib/card-builder-style-choice";

export function estimateExactTextPhraseCountForSlide(input: {
  slideRole: string;
  productFacts: readonly CardBuilderProductFact[];
  productTitle?: string;
  textDensity: string;
}): number {
  const role = input.slideRole.trim() as CardBuilderTemplateSlideRole;
  const density = input.textDensity.trim();
  if (density === "none") return 0;
  let count = 0;
  const title = input.productTitle?.trim();
  if (title) count += 1;
  const fromFacts = lockedTextPhrasesFromFacts(
    productFactsForSlideRole(input.productFacts, role),
  );
  count += fromFacts.length;
  return count;
}

/** salesStyle/textDensity для pricing с учётом effective settings по slideRole. */
export function resolveCardBuilderPricingStyleForSlide(input: {
  slideRole: string;
  visualStyle?: string;
  salesStyle?: string;
  textDensity?: string;
  categoryKey?: string;
  productFacts?: readonly CardBuilderProductFact[];
  productTitle?: string;
}): { salesStyle: string; textDensity: string } {
  const derived = derivePlanStyleFields({
    visualStyle: input.visualStyle,
    legacySalesStyle: input.salesStyle,
    legacyTextDensity: input.textDensity,
    textAmountToggle: "more",
  });

  const phraseCount = estimateExactTextPhraseCountForSlide({
    slideRole: input.slideRole,
    productFacts: input.productFacts ?? [],
    productTitle: input.productTitle,
    textDensity: derived.textDensity,
  });

  const effective = computeEffectiveCardBuilderSettings({
    slideRole: input.slideRole,
    categoryKey: input.categoryKey,
    rawSalesStyle: derived.salesStyle,
    rawTextDensity: derived.textDensity,
    rawVisualStyle: input.visualStyle,
    productFactsForSlide: productFactsForSlideRole(
      input.productFacts ?? [],
      input.slideRole.trim() as CardBuilderTemplateSlideRole,
    ),
    allProductFacts: input.productFacts ?? [],
    exactTextPhrases: Array.from({ length: phraseCount }, (_, i) => `phrase_${i}`),
  });

  return {
    salesStyle: effective.effectiveSalesStyle,
    textDensity: effective.effectiveTextDensity,
  };
}
