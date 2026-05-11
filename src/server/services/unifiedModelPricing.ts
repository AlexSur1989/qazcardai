/**
 * Единые типы и сборка breakdown V2 для GENERAL-моделей (image/video).
 */

import type { AiModel } from "@/generated/prisma/client";
import { isAdminPricingPinned } from "@/lib/admin-pricing-pinned";
import { isRecord } from "@/lib/model-pricing-shared";
import { evaluateFormulaCredits } from "@/server/services/formulaPricing";
import {
  getFinalCreditsFromPricingSchema,
  manualPricingMatrixCell,
  matrixResolutionDurationCell,
  normalizeMatrixProviderCostBranches,
} from "@/server/services/modelPricingCalculator";

export type UnifiedPriceTaskType = "IMAGE" | "VIDEO" | "PRODUCT_CARD";

export type PriceBreakdownPriceSource =
  | "admin"
  | "matrix"
  | "manual_override"
  | "fallback"
  | "legacy_model_cost"
  | "formula"
  | "fixed";

export type PriceBreakdownV2General = {
  v: 2;
  pricingScope: "GENERAL";
  tokens: number;
  modelId: string;
  modelSlug: string;
  modelName: string | null;
  apiModelId: string;
  taskType: UnifiedPriceTaskType;
  priceSource: PriceBreakdownPriceSource;
  providerCostUsd: number;
  providerCostKzt: number;
  revenueKzt: number;
  marginKzt: number;
  marginPercent: number;
  formula: string;
  appliedMultipliers: Array<{ key: string; value: number }>;
  manualOverrideKey: string | null;
  adminPricingPinned: boolean;
  pricingSchemaType: string | null;
  matrixKeyStrategy: string | null;
  settingsSnapshot: Record<string, unknown>;
  /** Детальный снимок формулы или fixed для metadata / отладки. */
  formulaPricingDetail?: Record<string, unknown> | null;
};

function num(v: unknown, d: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return d;
}

function hasSeedanceVideoInput(settings: Record<string, unknown>): boolean {
  if (!Array.isArray(settings.referenceVideoUrls)) return false;
  return settings.referenceVideoUrls.some((x) => typeof x === "string" && x.trim() !== "");
}

function manualOverrideKey(matrixKey: string, resKey: string, dur: string): string {
  return `${matrixKey}.${resKey}.${dur}`;
}

/** USD по ячейке providerCost ( Kie per-second себестоимость ). */
function providerUsdFromMatrixBranch(
  providerCost: Record<string, unknown>,
  branchKey: "noVideo" | "withVideo",
  resolution: string,
  durationSeconds: number,
): number {
  const branch = providerCost[branchKey];
  if (!isRecord(branch)) return 0;
  const cell = branch[resolution];
  if (!isRecord(cell)) return 0;
  const usdPerSecond = num(cell.usdPerSecond, 0);
  return Math.max(0, usdPerSecond * durationSeconds);
}

export function buildGeneralPriceBreakdownV2(
  model: Pick<
    AiModel,
    "id" | "slug" | "name" | "type" | "apiModelId" | "costCredits" | "pricingSchema"
  >,
  settings: Record<string, unknown>,
): PriceBreakdownV2General {
  const tokens = getFinalCreditsFromPricingSchema(model, settings);
  const fallbackBase = Math.max(0, Math.floor(model.costCredits));
  const raw = model.pricingSchema;
  const schema = isRecord(raw)
    ? normalizeMatrixProviderCostBranches(raw as Record<string, unknown>)
    : null;

  const usdToKzt = schema != null ? num(schema.usdToKzt, 500) : 500;
  const internalTokenValueKzt =
    schema != null ? num(schema.internalTokenValueKzt, 10) : 10;

  const pricingSchemaType =
    schema != null && typeof schema.type !== "undefined" ? String(schema.type) : null;
  const matrixKeyStrategy =
    schema != null && typeof schema.matrixKeyStrategy === "string"
      ? schema.matrixKeyStrategy
      : schema != null && schema.matrixKeyStrategy != null
        ? String(schema.matrixKeyStrategy)
        : null;

  const pinnedFlag = schema != null && isAdminPricingPinned(schema);
  const revenueKzt = tokens * internalTokenValueKzt;

  let providerCostUsd = 0;
  let priceSource: PriceBreakdownPriceSource = "fallback";
  let formula = `tokens=${tokens} (fallback costCredits или defaultCredits)`;
  const appliedMultipliers: Array<{ key: string; value: number }> = [];
  let manualKey: string | null = null;

  if (!schema) {
    priceSource = pinnedFlag ? "admin" : "fallback";
    formula = `${priceSource}: costCredits (${fallbackBase}) → ${tokens}`;
    const mk = revenueKzt;
    const provKzt = 0;
    return {
      v: 2,
      pricingScope: "GENERAL",
      tokens,
      modelId: model.id,
      modelSlug: model.slug,
      modelName: model.name,
      apiModelId: model.apiModelId,
      taskType: model.type === "VIDEO" ? "VIDEO" : "IMAGE",
      priceSource,
      providerCostUsd: 0,
      providerCostKzt: provKzt,
      revenueKzt: mk,
      marginKzt: mk - provKzt,
      marginPercent:
        mk > 0 ? ((mk - provKzt) / mk) * 100 : mk - provKzt > 0 ? 100 : 0,
      formula,
      appliedMultipliers,
      manualOverrideKey: null,
      adminPricingPinned: pinnedFlag,
      pricingSchemaType,
      matrixKeyStrategy,
      settingsSnapshot: { ...settings },
      formulaPricingDetail: null,
    };
  }

  const typ = String(schema.type ?? "");

  let formulaPricingDetail: Record<string, unknown> | null = null;
  if (typ === "fixed" && typeof schema.credits === "number") {
    formulaPricingDetail = {
      type: "fixed",
      credits: Math.max(0, Math.floor(schema.credits as number)),
    };
    priceSource = pinnedFlag ? "admin" : "fixed";
    formula = `fixed: ${String(schema.credits)} → ${tokens}`;
  } else if (typ === "formula") {
    const ev = evaluateFormulaCredits(schema, settings);
    const baseCredits =
      typeof schema.baseCredits === "number"
        ? Math.floor(schema.baseCredits as number)
        : undefined;
    formulaPricingDetail = {
      type: "formula",
      baseCredits,
      appliedRules: ev.error
        ? []
        : ev.appliedRules.map((r) => ({
            field: r.field,
            operator: r.operator,
            value: r.value,
            effect: r.effect,
            amount: r.amount,
          })),
      finalCredits: tokens,
      ...(ev.error ? { evaluationError: ev.error } : {}),
    };
    priceSource =
      pinnedFlag ? "admin" : ev.error ? "fallback" : "formula";
    formula = ev.error
      ? `formula (ошибка: ${ev.error}) → fallback ${tokens}`
      : `formula(base=${String(baseCredits ?? "")}) → ${tokens}`;
  } else if (typ === "per_second") {
    const vd = settings.videoDurationSeconds;
    const sec =
      typeof vd === "number" && Number.isFinite(vd) && vd > 0 ? Math.ceil(vd) : 1;
    const pc = schema.providerCost;
    const mc =
      isRecord(pc) && isRecord(pc.motionControl) ? pc.motionControl : null;
    const res = effectiveMotionResolution(settings);

    let manualSecs: number | null = null;
    const moRoot = schema.manualOverrides;
    if (isRecord(moRoot) && isRecord(moRoot.perSecondTokens)) {
      const pv = moRoot.perSecondTokens[res];
      if (typeof pv === "number" && Number.isFinite(pv)) {
        manualSecs = Math.floor(pv);
      }
    }

    const cell =
      mc && isRecord(mc[res]) ? (mc[res] as Record<string, unknown>) : null;
    const usdPerSecond = cell != null ? num(cell.usdPerSecond, 0) : 0;
    providerCostUsd = usdPerSecond * Math.max(1, sec);

    if (manualSecs !== null) {
      priceSource = "manual_override";
      manualKey = `perSecondTokens.${res}`;
      formula = `manual perSecondTokens.${res}: ceil(${manualSecs} * ${sec}s) → ${tokens}`;
    } else {
      priceSource = "matrix";
      formula = `per_second (${res}, ${sec}s): ceil(providerUsd*kzt/markup/tokenValue) → ${tokens}`;
    }
  } else if (typ === "matrix") {
    const strategy = String(matrixKeyStrategy ?? "").trim();
    const resKeyRaw =
      typeof settings.resolution === "string"
        ? settings.resolution.trim()
        : settings.resolution != null
          ? String(settings.resolution).trim()
          : "";
    const modeFallback =
      typeof settings.mode === "string" && settings.mode.trim() !== ""
        ? settings.mode.trim()
        : "";
    const resolution = resKeyRaw || modeFallback;
    const dur = String(settings.duration ?? "").trim() || "1";
    const durParsed = Number.parseInt(dur, 10);
    const durationSeconds =
      Number.isInteger(durParsed) && durParsed > 0 ? durParsed : 1;
    const hasVideoBranch = hasSeedanceVideoInput(settings);
    const matrixKeyLabel = hasVideoBranch ? "videoInputMatrix" : "matrix";

    if (strategy === "" && isRecord(schema.providerCost) && resolution) {
      const branch = hasVideoBranch ? ("withVideo" as const) : ("noVideo" as const);
      providerCostUsd = providerUsdFromMatrixBranch(
        schema.providerCost as Record<string, unknown>,
        branch,
        resolution,
        durationSeconds,
      );
    }

    const manualTok = manualPricingMatrixCell(
      schema.manualOverrides,
      matrixKeyLabel,
      resolution,
      dur,
    );

    const matrixTok = matrixResolutionDurationCell(
      hasVideoBranch && isRecord(schema.videoInputMatrix)
        ? schema.videoInputMatrix
        : schema.matrix,
      resolution,
      dur,
    );

    if (strategy === "" && manualTok !== null) {
      priceSource = "manual_override";
      manualKey = manualOverrideKey(matrixKeyLabel, resolution, dur);
      formula = `${manualKey}: manual matrix override → ${tokens}`;
    } else if (strategy === "" && matrixTok !== null) {
      priceSource = pinnedFlag && tokens === fallbackBase ? "fallback" : "matrix";
      formula = `${matrixKeyLabel}[${resolution}][${dur}]: preset matrix → ${tokens}`;
    } else if (strategy !== "") {
      priceSource = pinnedFlag && tokens === fallbackBase ? "fallback" : "matrix";
      formula = `${strategy}: strategy matrix → ${tokens}`;
    }

    appliedMultipliers.push(
      ...(resolution !== "" ? [{ key: "resolution", value: 1 }] : []),
    );

    if (pinnedFlag && priceSource === "fallback" && tokens === fallbackBase) {
      priceSource = "admin";
    }
  }

  const providerCostKzt = providerCostUsd * usdToKzt;
  const marginKzt = revenueKzt - providerCostKzt;
  const marginPercent =
    revenueKzt > 0 ? (marginKzt / revenueKzt) * 100 : marginKzt > 0 ? 100 : 0;

  if (pinnedFlag && priceSource === "fallback") {
    priceSource = "admin";
  }

  return {
    v: 2,
    pricingScope: "GENERAL",
    tokens,
    modelId: model.id,
    modelSlug: model.slug,
    modelName: model.name,
    apiModelId: model.apiModelId,
    taskType: model.type === "VIDEO" ? "VIDEO" : "IMAGE",
    priceSource,
    providerCostUsd,
    providerCostKzt,
    revenueKzt,
    marginKzt,
    marginPercent,
    formula,
    appliedMultipliers,
    manualOverrideKey: manualKey,
    adminPricingPinned: pinnedFlag,
    pricingSchemaType,
    matrixKeyStrategy,
    settingsSnapshot: { ...settings },
    formulaPricingDetail,
  };
}

function effectiveMotionResolution(settings: Record<string, unknown>): "720p" | "1080p" {
  const r =
    typeof settings.resolution === "string" && settings.resolution.trim() !== ""
      ? settings.resolution.trim()
      : typeof settings.mode === "string" && settings.mode.trim() !== ""
        ? settings.mode.trim()
        : "720p";
  return r === "1080p" ? "1080p" : "720p";
}
