import type { AiModel } from "@/generated/prisma/client";
import {
  calculateProductCardMarketplaceCardCredits,
  type ProductCardPriceBreakdown,
} from "@/server/services/productCardPricing";
import type { ProductCardSettings } from "@/server/services/productCardSettings";

export type MarketplaceCardPricingSummary = {
  modelSlug: string;
  modelName: string;
  modelBaseCredits: number;
  minScenarioTokens: number;
  finalCredits: number;
  limitedByMinimum: boolean;
  priceSource: string;
  formula: string;
  breakdown: ProductCardPriceBreakdown;
};

/**
 * Итоговая цена marketplace card = max(minMarketplaceCardTokens, model base × multipliers).
 * Не меняет настройки — только объясняет текущий расчёт для admin UI.
 */
export async function getMarketplaceCardPricingSummary(
  model: AiModel,
  productSettings: Pick<ProductCardSettings, "minMarketplaceCardTokens">,
  settingsSample: Record<string, unknown> = { cardSize: "1x1", styleMode: "classic" },
): Promise<MarketplaceCardPricingSummary> {
  const breakdown = await calculateProductCardMarketplaceCardCredits(model, settingsSample);
  const modelBaseCredits = model.costCredits;
  const minScenarioTokens = productSettings.minMarketplaceCardTokens;
  const finalCredits = breakdown.credits;

  return {
    modelSlug: model.slug,
    modelName: model.name,
    modelBaseCredits,
    minScenarioTokens,
    finalCredits,
    limitedByMinimum: finalCredits > modelBaseCredits && finalCredits >= minScenarioTokens,
    priceSource: breakdown.priceSource,
    formula: breakdown.formula,
    breakdown,
  };
}
