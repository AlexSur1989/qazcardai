
import type { AiModel } from "@/generated/prisma/client";

import { getFinalCreditsFromPricingSchema } from "@/server/services/modelPricingCalculator";

/**
 * Списание кредитов для генерации. Источник истины — `getFinalCreditsFromPricingSchema`
 * (оценка, сабмит и Pricing Studio).
 */
export function calculateGenerationCredits(
  model: Pick<AiModel, "costCredits" | "pricingSchema">,
  settings: Record<string, unknown>,
): number {
  return getFinalCreditsFromPricingSchema(model, settings);
}

export { getFinalCreditsFromPricingSchema } from "@/server/services/modelPricingCalculator";
