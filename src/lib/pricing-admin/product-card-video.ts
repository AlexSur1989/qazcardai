import { z } from "zod";

import {
  buildProductCardVideoMatrixKey,
  entryForProductCardMatrixKeys,
  matrixKeyUsedForSettings,
  pickProductCardPricingKeys,
} from "@/lib/product-card-matrix-keys";
import { isRecord } from "@/lib/model-pricing-shared";

export const DEFAULT_PRODUCT_CARD_VIDEO_DURATIONS = [5, 10] as const;
export const DEFAULT_PRODUCT_CARD_VIDEO_RESOLUTIONS = ["720p", "1080p"] as const;

export type ProductCardVideoMatrixCell = {
  duration: number;
  resolution: string;
  credits: number;
};

export type ProductCardVideoMatrixCellPreview = ProductCardVideoMatrixCell & {
  matrixPrice: number;
  minVideoTokens: number;
  finalCredits: number;
  matrixKey: string;
  matchedKey: string | null;
};

export type ProductCardVideoPricingApi = {
  modelId: string;
  modelSlug: string;
  modelName: string;
  isActive: boolean;
  productCardModelType: string | null;
  pricingSchemaType: string | null;
  durationOptions: number[];
  resolutionOptions: string[];
  matrix: ProductCardVideoMatrixCell[];
  minVideoTokens: number;
  hasMultipliers: boolean;
  appliedMultiplierSummary: string | null;
  warnings: string[];
};

const matrixCellSchema = z.object({
  duration: z.number().int().positive(),
  resolution: z.string().trim().min(1).max(32),
  credits: z.number().int(),
});

export const productCardVideoPricingPatchSchema = z.object({
  modelId: z.string().min(1),
  matrix: z.array(matrixCellSchema).min(1),
});

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function uniqueSortedDurations(values: number[]): number[] {
  return [...new Set(values.map((d) => Math.round(d)).filter((d) => d > 0))].sort((a, b) => a - b);
}

export function uniqueSortedResolutions(values: string[]): string[] {
  return [...new Set(values.map((r) => r.trim()).filter(Boolean))];
}

export function durationResolutionOptionsFromPresets(
  presets: Array<{ duration: number; resolution: string }>,
): { durationOptions: number[]; resolutionOptions: string[] } {
  const durations = uniqueSortedDurations(presets.map((p) => p.duration));
  const resolutions = uniqueSortedResolutions(presets.map((p) => p.resolution));
  return {
    durationOptions:
      durations.length > 0 ? durations : [...DEFAULT_PRODUCT_CARD_VIDEO_DURATIONS],
    resolutionOptions:
      resolutions.length > 0 ? resolutions : [...DEFAULT_PRODUCT_CARD_VIDEO_RESOLUTIONS],
  };
}

export function readMatrixCellCredits(
  matrix: unknown,
  duration: number,
  resolution: string,
  baseTokens: number,
): number {
  const settings = { duration, resolution };
  const keys = pickProductCardPricingKeys(settings);
  const entry = entryForProductCardMatrixKeys(matrix, keys);
  if (entry) {
    return Math.max(0, Math.round(asNumber(entry.tokens ?? entry.credits, baseTokens)));
  }
  return Math.max(0, Math.round(baseTokens));
}

function multiplierForSettings(source: unknown, settings: Record<string, unknown>): number {
  const multipliers = isRecord(source) ? source : null;
  if (!multipliers) return 1;
  let multiplier = 1;
  for (const key of pickProductCardPricingKeys(settings)) {
    const value = multipliers[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      multiplier *= value;
    }
  }
  return multiplier;
}

export function previewProductCardVideoFinalCredits(input: {
  matrixCredits: number;
  minVideoTokens: number;
  settings: { duration: number; resolution: string };
  pricingSchema: Record<string, unknown>;
}): number {
  const mult = multiplierForSettings(input.pricingSchema.multipliers, input.settings);
  const globalMulRaw = input.pricingSchema.priceMultiplier;
  const globalMul =
    typeof globalMulRaw === "number" && Number.isFinite(globalMulRaw)
      ? Math.max(0.001, globalMulRaw)
      : typeof globalMulRaw === "string" && Number(globalMulRaw) > 0
        ? Number(globalMulRaw)
        : 1;
  return Math.max(
    input.minVideoTokens,
    Math.ceil(input.matrixCredits * mult * globalMul),
  );
}

export function hasProductCardVideoMultipliers(pricingSchema: Record<string, unknown>): boolean {
  const mult = pricingSchema.multipliers;
  if (!isRecord(mult)) return false;
  return Object.values(mult).some((v) => typeof v === "number" && Number.isFinite(v) && v !== 1);
}

export function buildProductCardVideoMatrixCells(input: {
  matrix: unknown;
  durationOptions: number[];
  resolutionOptions: string[];
  baseTokens: number;
  minVideoTokens: number;
  pricingSchema: Record<string, unknown>;
}): ProductCardVideoMatrixCellPreview[] {
  const cells: ProductCardVideoMatrixCellPreview[] = [];
  for (const duration of input.durationOptions) {
    for (const resolution of input.resolutionOptions) {
      const settings = { duration, resolution };
      const matrixPrice = readMatrixCellCredits(
        input.matrix,
        duration,
        resolution,
        input.baseTokens,
      );
      const matrixKey = buildProductCardVideoMatrixKey(duration, resolution);
      const matchedKey = matrixKeyUsedForSettings(input.matrix, settings);
      const finalCredits = previewProductCardVideoFinalCredits({
        matrixCredits: matrixPrice,
        minVideoTokens: input.minVideoTokens,
        settings,
        pricingSchema: input.pricingSchema,
      });
      cells.push({
        duration,
        resolution,
        credits: matrixPrice,
        matrixPrice,
        minVideoTokens: input.minVideoTokens,
        finalCredits,
        matrixKey,
        matchedKey,
      });
    }
  }
  return cells;
}

export function productCardVideoMatrixCellsToSchemaMatrix(
  cells: ProductCardVideoMatrixCell[],
  existingMatrix: Record<string, unknown>,
  baseTokens: number,
  baseProviderCostUsd: number,
): Record<string, unknown> {
  const matrix: Record<string, unknown> = { ...existingMatrix };
  for (const cell of cells) {
    const key = buildProductCardVideoMatrixKey(cell.duration, cell.resolution);
    const credits = Math.max(0, Math.round(cell.credits));
    const providerCostUsd =
      baseTokens > 0
        ? Math.round(((baseProviderCostUsd * credits) / baseTokens) * 100_000) / 100_000
        : 0;
    matrix[key] = { tokens: credits, providerCostUsd };
  }
  return matrix;
}

export function productCardVideoPricingSoftWarnings(input: {
  cells: ProductCardVideoMatrixCellPreview[];
  minVideoTokens: number;
  durationOptions: number[];
  resolutionOptions: string[];
  modelFound: boolean;
  modelActive: boolean;
  multipleActiveModels: boolean;
  resolverModelSlug: string | null;
}): string[] {
  const warnings: string[] = [];
  if (!input.modelFound) {
    warnings.push("Модель видео товара (PRODUCT_VIDEO) не найдена.");
    return warnings;
  }
  if (!input.modelActive) {
    warnings.push("Модель видео товара неактивна — клиенты не смогут генерировать видео.");
  }
  if (input.multipleActiveModels && input.resolverModelSlug) {
    warnings.push(
      `Несколько активных PRODUCT_VIDEO моделей — для estimate используется «${input.resolverModelSlug}».`,
    );
  }

  const credits = input.cells.map((c) => c.credits);
  const uniqueCredits = new Set(credits);
  if (
    uniqueCredits.size <= 1 &&
    input.durationOptions.length > 1 &&
    input.resolutionOptions.length > 1
  ) {
    warnings.push("Цена не меняется по длительности/качеству — все ячейки матрицы одинаковые.");
  }

  for (const resolution of input.resolutionOptions) {
    const byDur = input.cells
      .filter((c) => c.resolution === resolution)
      .sort((a, b) => a.duration - b.duration);
    for (let i = 1; i < byDur.length; i++) {
      const prev = byDur[i - 1]!;
      const cur = byDur[i]!;
      if (cur.credits < prev.credits) {
        warnings.push(
          `${cur.duration} секунд дешевле ${prev.duration} секунд при ${resolution}.`,
        );
      }
    }
  }

  for (const duration of input.durationOptions) {
    const row = input.cells.filter((c) => c.duration === duration);
    const p720 = row.find((c) => c.resolution === "720p");
    const p1080 = row.find((c) => c.resolution === "1080p");
    if (p720 && p1080 && p1080.credits < p720.credits) {
      warnings.push(`1080p дешевле 720p при ${duration} секунд.`);
    }
  }

  for (const cell of input.cells) {
    if (cell.finalCredits < input.minVideoTokens) {
      warnings.push(
        `${cell.duration}s / ${cell.resolution}: итог ниже минимума (${cell.finalCredits} < ${input.minVideoTokens}).`,
      );
    }
    if (cell.credits < 1) {
      warnings.push(`${cell.duration}s / ${cell.resolution}: matrix price должна быть ≥ 1.`);
    }
    if (cell.matchedKey && cell.matchedKey !== cell.matrixKey) {
      warnings.push(
        `${cell.duration}s / ${cell.resolution}: estimate читает ключ «${cell.matchedKey}», а не «${cell.matrixKey}».`,
      );
    }
  }

  return warnings;
}

export function buildProductCardVideoFormulaText(input: {
  hasMultipliers: boolean;
  minVideoTokens: number;
}): string {
  if (input.hasMultipliers) {
    return `base = matrix[duration, resolution]\nfinal = max(${input.minVideoTokens}, base × multipliers)`;
  }
  return `base = matrix[duration, resolution]\nfinal = max(${input.minVideoTokens}, base)`;
}

export function validateProductCardVideoPatchCells(input: {
  matrix: ProductCardVideoMatrixCell[];
  durationOptions: number[];
  resolutionOptions: string[];
  minVideoTokens: number;
}): { ok: true } | { ok: false; error: string } {
  const allowedDurations = new Set(input.durationOptions);
  const allowedResolutions = new Set(input.resolutionOptions);

  for (const cell of input.matrix) {
    if (!allowedDurations.has(cell.duration)) {
      return { ok: false, error: `Недопустимая длительность: ${cell.duration}` };
    }
    if (!allowedResolutions.has(cell.resolution)) {
      return { ok: false, error: `Недопустимое разрешение: ${cell.resolution}` };
    }
    if (!Number.isInteger(cell.credits) || cell.credits < 1) {
      return {
        ok: false,
        error: `Credits для ${cell.duration}s / ${cell.resolution} должны быть целым ≥ 1`,
      };
    }
  }
  return { ok: true };
}
