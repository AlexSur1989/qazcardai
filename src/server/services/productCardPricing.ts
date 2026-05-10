
import type { AiModel } from "@/generated/prisma/client";
import { isAdminPricingPinned } from "@/lib/admin-pricing-pinned";
import {
  getProductCardSettings,
  type ProductCardSettings,
} from "@/server/services/productCardSettings";

export type ProductCardPricingScenario =
  | "concept_image"
  | "marketplace_card"
  | "video";

export type ProductCardPriceBreakdown = {
  v?: 2;
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
  priceSource:
    | "manual_override"
    | "matrix"
    | "base"
    | "legacy_model_cost";
  formula: string;
  warnings: string[];
  manualOverrideKey?: string | null;
  adminPricingPinned?: boolean;
  appliedMultipliers?: Array<{ key: string; value: number }>;
  /** Одна генерация маркетплейса (до бандла) */
  singleVariantCredits?: number;
  /** Число вариантов витрины (≥1) */
  variantCount?: number | null;
  /** Фиксированная цена пакета variantsBundleTokens / variantsBundleByCount или null */
  bundleCredits?: number | null;
  /** Итоговые списания (= credits при estimate бандла) */
  totalCredits?: number;
  variantAllocations?: number[] | null;
};

type PricingSchema = {
  pricingScope?: unknown;
  type?: unknown;
  baseTokens?: unknown;
  fallbackTokens?: unknown;
  minTokens?: unknown;
  /** Дополнительный глобальный множитель в схеме */
  priceMultiplier?: unknown;
  minConceptImageTokens?: unknown;
  minMarketplaceCardTokens?: unknown;
  minVideoTokens?: unknown;
  providerCostUsd?: unknown;
  providerCost?: unknown;
  markupPercent?: unknown;
  manualOverrides?: unknown;
  matrix?: unknown;
  multipliers?: unknown;
  cardSizeMultipliers?: unknown;
  templateMultipliers?: unknown;
  variantsBundleTokens?: unknown;
  variantsBundleByCount?: unknown;
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
    "templatePreset",
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

function multiplierFromNestedMap(
  source: unknown,
  keyRaw: unknown,
): { value: number; hit: boolean } {
  const key =
    typeof keyRaw === "string"
      ? keyRaw.trim()
      : keyRaw != null && String(keyRaw).trim() !== ""
        ? String(keyRaw).trim()
        : "";
  const map = asRecord(source);
  if (!map || !key) {
    return { value: 1, hit: false };
  }
  const v = map[key];
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return { value: v, hit: true };
  }
  return { value: 1, hit: false };
}

function resolveBundleCreditsFromSchema(
  schema: PricingSchema | null,
  variantCount: number,
): number | null {
  if (!schema || variantCount <= 1) return null;
  const byRaw = schema.variantsBundleByCount as unknown;
  const byMap = asRecord(byRaw);
  const k = String(Math.round(variantCount));
  if (byMap && typeof byMap[k] === "number" && Number.isFinite(byMap[k])) {
    const n = Math.max(0, Math.ceil(byMap[k] as number));
    return n >= 0 ? n : null;
  }
  if (
    typeof schema.variantsBundleTokens === "number" &&
    Number.isFinite(schema.variantsBundleTokens)
  ) {
    return Math.max(0, Math.ceil(schema.variantsBundleTokens));
  }
  return null;
}

/**
 * Целые списания по вариантам, сумма = totalCredits.
 */
export function allocateCreditsAcrossVariants(totalCredits: number, variantCount: number): number[] {
  const n = Math.min(12, Math.max(1, Math.round(variantCount)));
  const t = Math.max(0, Math.round(totalCredits));
  if (n <= 1) return [t];
  const base = Math.floor(t / n);
  const rem = t - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Итого за витрину + распределение списания по задачам. */
export function resolveMarketplaceVariantBundleTotals(
  model: AiModel,
  variantCount: number,
  perVariant: ProductCardPriceBreakdown,
): {
  totalCredits: number;
  allocations: number[];
  bundleCredits: number | null;
  singleVariantCredits: number;
  formulaAddon: string;
  priceBreakdown: ProductCardPriceBreakdown;
} {
  const schema = schemaOf(model);
  const vc = Math.min(12, Math.max(1, Math.round(variantCount)));
  const single = Math.max(0, Math.round(perVariant.credits));

  let bundleCredits: number | null = resolveBundleCreditsFromSchema(schema, vc);
  if (vc <= 1) {
    bundleCredits = null;
  }

  const totalCredits =
    bundleCredits != null ? bundleCredits : single * vc;
  const formulaAddon =
    bundleCredits != null
      ? `variants bundle (n=${vc}): total=${bundleCredits}`
      : `variants linear: ${single} * ${vc} = ${totalCredits}`;

  const allocations = allocateCreditsAcrossVariants(totalCredits, vc);

  const perCredRev =
    perVariant.credits > 0 ? perVariant.revenueKzt / perVariant.credits : 0;
  const perCredUsd =
    perVariant.credits > 0 ? perVariant.providerCostUsd / perVariant.credits : 0;
  const kUsd =
    perVariant.providerCostUsd > 0 ? perVariant.providerCostKzt / perVariant.providerCostUsd : 0;

  const revenueKzt =
    Math.round(perCredRev * totalCredits * 100) / 100;
  const providerCostUsd =
    Math.round(perCredUsd * totalCredits * 100_000) / 100_000;
  const providerCostKzt =
    Math.round(providerCostUsd * kUsd * 100) / 100;
  const marginKzt = Math.round((revenueKzt - providerCostKzt) * 100) / 100;
  const marginPercent =
    revenueKzt > 0
      ? Math.round(((marginKzt / revenueKzt) * 100) * 100) / 100
      : null;

  const priceBreakdown: ProductCardPriceBreakdown = {
    ...perVariant,
    v: 2,
    credits: totalCredits,
    tokens: totalCredits,
    variantCount: vc,
    singleVariantCredits: single,
    bundleCredits,
    totalCredits,
    variantAllocations: allocations,
    formula: `${perVariant.formula}; ${formulaAddon}`,
    revenueKzt,
    providerCostUsd,
    providerCostKzt,
    marginKzt,
    marginPercent,
  };

  return {
    totalCredits,
    allocations,
    bundleCredits,
    singleVariantCredits: single,
    formulaAddon,
    priceBreakdown,
  };
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

  let manualOverrideKey: string | null = null;
  if (manualEntry) {
    const mo = asRecord(schema?.manualOverrides);
    if (mo) {
      for (const k of keys) {
        if (asRecord(mo[k]) || typeof mo[k] === "number") {
          manualOverrideKey = k;
          break;
        }
      }
    }
  }

  const priceSource = manualEntry
    ? "manual_override"
    : matrixEntry
      ? "matrix"
      : productCardSchema
        ? "base"
        : "legacy_model_cost";

  const pinned = schema != null && isAdminPricingPinned(schema);

  const minTokens = scenarioMinTokens(input.scenario, settings, schema);
  const baseTokens = productCardSchema
    ? asNumber(schema.baseTokens ?? schema.fallbackTokens, input.model.costCredits)
    : input.model.costCredits;
  const entryTokens = entry ? asNumber(entry.tokens ?? entry.credits, baseTokens) : baseTokens;
  let multiplierMult = productCardSchema
    ? multiplierForSettings(schema.multipliers, modelSettings)
    : 1;

  const appliedStructured: Array<{ key: string; value: number }> = [];

  const cardSizeMul = multiplierFromNestedMap(schema?.cardSizeMultipliers, modelSettings.cardSize);
  if (cardSizeMul.hit) {
    multiplierMult *= cardSizeMul.value;
    appliedStructured.push({ key: `cardSize:${String(modelSettings.cardSize)}`, value: cardSizeMul.value });
  }
  const templateMul = multiplierFromNestedMap(
    schema?.templateMultipliers,
    modelSettings.templatePreset,
  );
  if (templateMul.hit) {
    multiplierMult *= templateMul.value;
    appliedStructured.push({
      key: `template:${String(modelSettings.templatePreset)}`,
      value: templateMul.value,
    });
  }

  const globalMul =
    typeof schema?.priceMultiplier === "number" && Number.isFinite(schema.priceMultiplier)
      ? Math.max(0.001, schema.priceMultiplier)
      : typeof schema?.priceMultiplier === "string" && Number(schema.priceMultiplier) > 0
        ? Number(schema.priceMultiplier)
        : 1;
  if (globalMul !== 1) appliedStructured.push({ key: "priceMultiplier", value: globalMul });

  const tokens = Math.max(
    minTokens,
    Math.ceil(entryTokens * multiplierMult * globalMul),
  );

  const providerCostUsd = entry
    ? asNumber(entry.providerCostUsd ?? entry.providerCost, asNumber(schema?.providerCostUsd ?? schema?.providerCost, 0))
    : asNumber(schema?.providerCostUsd ?? schema?.providerCost, 0);
  const providerCostKzt = providerCostUsd * settings.usdToKzt;

  const formulaBase = `${priceSource}: max(${minTokens}, ceil(${entryTokens} * mult${globalMul !== 1 ? ` * pm=${globalMul}` : ""}))`;
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
    v: 2,
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
    formula: `${formulaBase} where mult=${multiplierMult}`,
    warnings,
    manualOverrideKey,
    adminPricingPinned: pinned,
    appliedMultipliers:
      appliedStructured.length > 0 ? appliedStructured : undefined,
    variantCount: 1,
    singleVariantCredits: tokens,
    bundleCredits: null,
    totalCredits: tokens,
    variantAllocations: [tokens],
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
