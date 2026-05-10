import type { AiModel } from "@/generated/prisma/client";
import { isRecord } from "@/lib/model-pricing-shared";

import {
  buildPerSecondMotionControlPreview,
  buildPricingPreview,
  getFinalCreditsFromPricingSchema,
} from "@/server/services/modelPricingCalculator";
import {
  buildGeneralPriceBreakdownV2,
  type PriceBreakdownV2General,
} from "@/server/services/unifiedModelPricing";

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

/** Обратная совместимость: историческое имя; фактически V2-блок маржей. */
export type GenerationPriceBreakdownV1 = PriceBreakdownV2General;

/**
 * Кредиты + структурированный снимок для `Generation.metadata.priceBreakdown` и `/api/generations/estimate`.
 */
export function calculateGenerationCreditsWithBreakdown(
  model: Pick<
    AiModel,
    "id" | "slug" | "name" | "type" | "apiModelId" | "costCredits" | "pricingSchema"
  >,
  settings: Record<string, unknown>,
): { credits: number; priceBreakdown: PriceBreakdownV2General } {
  const priceBreakdown = buildGeneralPriceBreakdownV2(model, settings);
  return { credits: priceBreakdown.tokens, priceBreakdown };
}

/**
 * Нижняя граница «от N токенов» в каталоге / селекте (matrix / per_second).
 */
export function getCreditsUiFloor(
  model: Pick<AiModel, "costCredits" | "pricingSchema">,
): number {
  const base = Math.max(0, Math.floor(model.costCredits));
  const raw = model.pricingSchema;
  if (!isRecord(raw)) {
    return base;
  }
  const t = String(raw.type ?? "");
  if (t === "per_second") {
    const preview = buildPerSecondMotionControlPreview(raw);
    const m = preview.summary.minTokens;
    return m > 0 ? m : base;
  }
  if (t === "matrix") {
    const preview = buildPricingPreview(raw);
    const m = preview.summary.minTokens;
    return m > 0 ? m : base;
  }
  return base;
}

export { getFinalCreditsFromPricingSchema } from "@/server/services/modelPricingCalculator";
export type { PriceBreakdownV2General } from "@/server/services/unifiedModelPricing";
