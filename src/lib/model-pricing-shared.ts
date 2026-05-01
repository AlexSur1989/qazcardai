/**
 * Разделяем с сервером типы/утилиты без "server-only" (для клиентских компонентов).
 */

export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export type CalculatePricingRowInput = {
  inputType: string;
  resolution: string;
  duration: number;
  kieCreditsPerSecond: number;
  usdPerSecond: number;
  usdToKzt: number;
  internalTokenValueKzt: number;
  markupPercent: number;
  manualClientTokens: number | null | undefined;
  matrixKey: string;
};

export type CalculatedPricingRow = {
  inputType: string;
  matrixKey: string;
  resolution: string;
  duration: number;
  kieCreditsPerSecond: number;
  kieCreditsTotal: number;
  usdPerSecond: number;
  providerUsdTotal: number;
  providerKztTotal: number;
  markupPercent: number;
  autoClientTokens: number;
  manualClientTokens: number | null;
  finalClientTokens: number;
  clientKztPrice: number;
  marginKzt: number;
  marginPercent: number;
  isManual: boolean;
};

/** Превью строк для Kling Motion Control (`pricingSchema.type === "per_second"`). */
export type PerSecondMotionPreviewRow = {
  resolution: string;
  kieCreditsPerSecond: number;
  usdPerSecond: number;
  autoTokensPerSecond: number;
  manualTokensPerSecond: number | null;
  example5SecTokens: number;
  example10SecTokens: number;
  marginPercentApprox: number;
};
