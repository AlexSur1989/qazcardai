
import type { AiModel } from "@/generated/prisma/client";

import { getFinalCreditsFromPricingSchema } from "@/server/services/modelPricingCalculator";

/**
 * РЎРїРёСЃР°РЅРёРµ РєСЂРµРґРёС‚РѕРІ РґР»СЏ РіРµРЅРµСЂР°С†РёРё. РСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹ вЂ” `getFinalCreditsFromPricingSchema`
 * (РѕС†РµРЅРєР°, СЃР°Р±РјРёС‚ Рё Pricing Studio).
 */
export function calculateGenerationCredits(
  model: Pick<AiModel, "costCredits" | "pricingSchema">,
  settings: Record<string, unknown>,
): number {
  return getFinalCreditsFromPricingSchema(model, settings);
}

export { getFinalCreditsFromPricingSchema } from "@/server/services/modelPricingCalculator";
