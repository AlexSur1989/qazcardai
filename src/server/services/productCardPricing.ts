
import type { AiModel } from "@/generated/prisma/client";
import {
  getProductCardSettings,
  type ProductCardSettings,
} from "@/server/services/productCardSettings";

export type ProductCardPricingScenario =
  | "concept_image"
  | "marketplace_card"
  | "video";

export type ProductCardPriceBreakdown = {
  pricingScope: "PRODUCT_CARD";
  scenario: ProductCardPricingScenario;
  productCardModelType: string | null;
  modelId: string;
  modelSlug: string;
  modelName: string;
  credits: number;
  tokens: number;
  providerCostUsd: number;
  providerCostKzt: number;
  revenueKzt: number;
  marginKzt: number;
  marginPercent: number | null;
  priceSource: "manual_override" | "matrix" | "base" | "legacy_model_cost";
  formula: string;
  warnings: string[];
};

type PricingSchema = {
  pricingScope?: unknown;
  type?: unknown;
  baseTokens?: unknown;
  fallbackTokens?: unknown;
  minTokens?: unknown;
  minConceptImageTokens?: unknown;
  minMarketplaceCardTokens?: unknown;
  minVideoTokens?: unknown;
  providerCostUsd?: unknown;
  providerCost?: unknown;
  markupPercent?: unknown;
  manualOverrides?: unknown;
  matrix?: unknown;
  multipliers?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function schemaOf(model: AiModel): PricingSchema | null {
  return asRecord(model.pricingSchema) as PricingSchema | null;
}

function scenarioMinTokens(
  scenario: ProductCardPricingScenario,
  settings: ProductCardSettings,
  schema: PricingSchema | null,
): number {
  if (scenario === "concept_image") {
    return Math.round(asNumber(schema?.minConceptImageTokens, settings.minConceptImageTokens));
  }
  if (scenario === "marketplace_card") {
    return Math.round(
      asNumber(schema?.minMarketplaceCardTokens, settings.minMarketplaceCardTokens),
    );
  }
  return Math.round(asNumber(schema?.minVideoTokens, settings.minVideoTokens));
}

function pickKeys(settings: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const name of [
    "size",
    "cardSize",
    "preset",
    "resolution",
    "quality",
    "aspectRatio",
    "duration",
    "style",
  ]) {
    const value = settings[name];
    if (typeof value === "string" || typeof value === "number") {
      keys.push(`${name}:${String(value)}`);
      keys.push(String(value));
    }
  }
  return keys;
}

function entryForKeys(source: unknown, keys: string[]): Record<string, unknown> | null {
  const obj = asRecord(source);
  if (!obj) return null;
  for (const key of keys) {
    const entry = asRecord(obj[key]);
    if (entry) return entry;
    const direct = obj[key];
    if (typeof direct === "number") return { tokens: direct };
  }
  return null;
}

function multiplierForSettings(source: unknown, settings: Record<string, unknown>): number {
  const multipliers = asRecord(source);
  if (!multipliers) return 1;
  let multiplier = 1;
  for (const key of pickKeys(settings)) {
    const value = multipliers[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      multiplier *= value;
    }
  }
  return multiplier;
}

export async function calculateProductCardModelPrice(input: {
  model: AiModel;
  scenario: ProductCardPricingScenario;
  settings?: Record<string, unknown>;
}): Promise<ProductCardPriceBreakdown> {
  const settings = await getProductCardSettings();
  const modelSettings = input.settings ?? {};
  const schema = schemaOf(input.model);
  const warnings: string[] = [];
  const productCardSchema =
    schema?.pricingScope === "PRODUCT_CARD" && schema.type === "product_card_matrix";

  if (!productCardSchema) {
    warnings.push("Model pricingSchema is not PRODUCT_CARD/product_card_matrix.");
  }

  const keys = pickKeys(modelSettings);
  const manualEntry = productCardSchema ? entryForKeys(schema.manualOverrides, keys) : null;
  const matrixEntry = productCardSchema ? entryForKeys(schema.matrix, keys) : null;
  const entry = manualEntry ?? matrixEntry;
  const priceSource = manualEntry
    ? "manual_override"
    : matrixEntry
      ? "matrix"
      : productCardSchema
        ? "base"
        : "legacy_model_cost";

  const minTokens = scenarioMinTokens(input.scenario, settings, schema);
  const baseTokens = productCardSchema
    ? asNumber(schema.baseTokens ?? schema.fallbackTokens, input.model.costCredits)
    : input.model.costCredits;
  const entryTokens = entry ? asNumber(entry.tokens ?? entry.credits, baseTokens) : baseTokens;
  const multiplier = productCardSchema
    ? multiplierForSettings(schema.multipliers, modelSettings)
    : 1;
  const tokens = Math.max(minTokens, Math.ceil(entryTokens * multiplier));

  const providerCostUsd = entry
    ? asNumber(entry.providerCostUsd ?? entry.providerCost, asNumber(schema?.providerCostUsd ?? schema?.providerCost, 0))
    : asNumber(schema?.providerCostUsd ?? schema?.providerCost, 0);
  const providerCostKzt = providerCostUsd * settings.usdToKzt;
  const revenueKzt = tokens * settings.tokenValueKzt;
  const marginKzt = revenueKzt - providerCostKzt;
  const marginPercent = revenueKzt > 0 ? (marginKzt / revenueKzt) * 100 : null;

  if (!settings.allowNegativeMargin && marginKzt < 0) {
    warnings.push("Negative margin is not allowed for Product Card pricing.");
  } else if (
    marginPercent != null &&
    marginPercent < settings.lowMarginWarningPercent
  ) {
    warnings.push("Product Card margin is below warning threshold.");
  }

  return {
    pricingScope: "PRODUCT_CARD",
    scenario: input.scenario,
    productCardModelType: input.model.productCardModelType,
    modelId: input.model.id,
    modelSlug: input.model.slug,
    modelName: input.model.name,
    credits: tokens,
    tokens,
    providerCostUsd,
    providerCostKzt,
    revenueKzt,
    marginKzt,
    marginPercent,
    priceSource,
    formula: `${priceSource}: max(${minTokens}, ceil(${entryTokens} * ${multiplier}))`,
    warnings,
  };
}

export function assertProductCardPriceAllowed(price: ProductCardPriceBreakdown): void {
  if (price.warnings.includes("Negative margin is not allowed for Product Card pricing.")) {
    throw new Error("Цена Product Card ниже себестоимости. Измените pricing или разрешите отрицательную маржу.");
  }
}

export function calculateProductCardConceptImageCredits(
  model: AiModel,
  settings?: Record<string, unknown>,
): Promise<ProductCardPriceBreakdown> {
  return calculateProductCardModelPrice({
    model,
    scenario: "concept_image",
    settings,
  });
}

export function calculateProductCardMarketplaceCardCredits(
  model: AiModel,
  settings?: Record<string, unknown>,
): Promise<ProductCardPriceBreakdown> {
  return calculateProductCardModelPrice({
    model,
    scenario: "marketplace_card",
    settings,
  });
}

export function calculateProductCardVideoCredits(
  model: AiModel,
  settings?: Record<string, unknown>,
): Promise<ProductCardPriceBreakdown> {
  return calculateProductCardModelPrice({
    model,
    scenario: "video",
    settings,
  });
}
