
import type { AiModel } from "@/generated/prisma/client";
import {
  isRecord,
  type CalculatePricingRowInput,
  type CalculatedPricingRow,
  type PerSecondMotionPreviewRow,
} from "@/lib/model-pricing-shared";

export { isRecord } from "@/lib/model-pricing-shared";
export type {
  CalculatePricingRowInput,
  CalculatedPricingRow,
  PerSecondMotionPreviewRow,
} from "@/lib/model-pricing-shared";

export function calculatePricingRow(
  p: CalculatePricingRowInput,
): CalculatedPricingRow {
  const duration = p.duration;
  const kieCreditsTotal = p.kieCreditsPerSecond * duration;
  const providerUsdTotal = p.usdPerSecond * duration;
  const providerKztTotal = providerUsdTotal * p.usdToKzt;
  const clientKztPrice =
    providerKztTotal * (1 + p.markupPercent / 100);
  const autoClientTokens = Math.ceil(
    clientKztPrice / p.internalTokenValueKzt,
  );
  const manual =
    p.manualClientTokens != null &&
    typeof p.manualClientTokens === "number" &&
    Number.isFinite(p.manualClientTokens)
      ? Math.max(0, Math.floor(p.manualClientTokens))
      : null;
  const isManual = manual !== null;
  const finalClientTokens = isManual ? manual! : autoClientTokens;
  const marginKzt =
    finalClientTokens * p.internalTokenValueKzt - providerKztTotal;
  const marginPercent =
    providerKztTotal > 0 ? (marginKzt / providerKztTotal) * 100 : 0;

  return {
    inputType: p.inputType,
    matrixKey: p.matrixKey,
    resolution: p.resolution,
    duration: p.duration,
    kieCreditsPerSecond: p.kieCreditsPerSecond,
    kieCreditsTotal,
    usdPerSecond: p.usdPerSecond,
    providerUsdTotal,
    providerKztTotal,
    markupPercent: p.markupPercent,
    autoClientTokens,
    manualClientTokens: manual,
    finalClientTokens,
    clientKztPrice: finalClientTokens * p.internalTokenValueKzt,
    marginKzt,
    marginPercent,
    isManual,
  };
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function toNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

/**
 * Восстанавливает matrix / videoInputMatrix из providerCost, durations, usdToKzt,
 * internalTokenValueKzt, markupPercent. manualOverrides не трогает.
 */
export function recalculatePricingSchema(
  pricingSchema: Record<string, unknown>,
): Record<string, unknown> {
  const out = deepClone(pricingSchema) as Record<string, unknown>;
  if (String(out.type) !== "matrix") {
    return out;
  }
  const providerCost = out.providerCost;
  if (!isRecord(providerCost)) {
    return out;
  }
  const usdToKzt = toNum(out.usdToKzt, 500);
  const internalTokenValueKzt = toNum(out.internalTokenValueKzt, 10);
  const markupPercent = toNum(out.markupPercent, 0);
  const durations = out.durations;
  const durList: number[] = Array.isArray(durations)
    ? (durations as unknown[]).map((d) => Number(d)).filter((n) => Number.isFinite(n) && n > 0)
    : [4, 5, 6, 8, 10, 12, 15];

  const noVideo = isRecord(providerCost.noVideo) ? providerCost.noVideo : null;
  const withVideo = isRecord(providerCost.withVideo)
    ? providerCost.withVideo
    : null;

  function fillMatrix(
    costBranch: Record<string, unknown> | null,
    targetKey: "matrix" | "videoInputMatrix",
    inputType: "noVideo" | "withVideo",
  ) {
    if (!costBranch) return;
    const resKeys = out.resolutions;
    const resolutions: string[] = Array.isArray(resKeys)
      ? (resKeys as unknown[]).map((x) => String(x))
      : Object.keys(costBranch);
    if (!isRecord(out[targetKey])) {
      out[targetKey] = {};
    }
    const target = out[targetKey] as Record<string, unknown>;
    for (const res of resolutions) {
      const cell = costBranch[res];
      if (!isRecord(cell)) continue;
      const kie = toNum(cell.kieCreditsPerSecond, 0);
      const usd = toNum(cell.usdPerSecond, 0);
      if (!isRecord(target[res])) {
        target[res] = {};
      }
      const row = target[res] as Record<string, unknown>;
      for (const d of durList) {
        const r = calculatePricingRow({
          inputType,
          resolution: res,
          duration: d,
          kieCreditsPerSecond: kie,
          usdPerSecond: usd,
          usdToKzt,
          internalTokenValueKzt,
          markupPercent,
          manualClientTokens: undefined,
          matrixKey: targetKey,
        });
        row[String(d)] = r.finalClientTokens;
      }
    }
  }

  fillMatrix(noVideo, "matrix", "noVideo");
  fillMatrix(withVideo, "videoInputMatrix", "withVideo");
  return out;
}

export type PricingPreviewResult = {
  rows: CalculatedPricingRow[];
  summary: {
    minTokens: number;
    maxTokens: number;
    avgMarginPercent: number;
  };
};

/**
 * Сводка строк для админки (без обращения к Kie).
 */
export function buildPricingPreview(
  pricingSchema: Record<string, unknown>,
): PricingPreviewResult {
  const usdToKzt = toNum(pricingSchema.usdToKzt, 500);
  const internalTokenValueKzt = toNum(pricingSchema.internalTokenValueKzt, 10);
  const markupPercent = toNum(pricingSchema.markupPercent, 0);
  const providerCost = pricingSchema.providerCost;
  const manualRaw = pricingSchema.manualOverrides;
  const manual = isRecord(manualRaw) ? manualRaw : null;
  const durations = pricingSchema.durations;
  const durList: number[] = Array.isArray(durations)
    ? (durations as unknown[]).map((d) => Number(d)).filter((n) => Number.isFinite(n) && n > 0)
    : [4, 5, 6, 8, 10, 12, 15];

  const rows: CalculatedPricingRow[] = [];
  if (!isRecord(providerCost)) {
    return { rows, summary: { minTokens: 0, maxTokens: 0, avgMarginPercent: 0 } };
  }

  function manualAt(
    matrixKey: "matrix" | "videoInputMatrix",
    res: string,
    d: string,
  ): number | null {
    if (!manual) return null;
    const b = manual[matrixKey];
    if (!isRecord(b)) return null;
    const rrow = b[res];
    if (!isRecord(rrow)) return null;
    let v: unknown = rrow[d];
    if (v === undefined) {
      const n = Number.parseInt(d, 10);
      if (Number.isInteger(n) && String(n) in rrow) v = rrow[String(n)];
    }
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) {
      return Math.max(0, Math.floor(v));
    }
    return null;
  }

  function pushBranch(
    costBranch: Record<string, unknown> | null,
    inputLabel: "noVideo" | "withVideo",
    matrixKey: "matrix" | "videoInputMatrix",
  ) {
    if (!costBranch) return;
    const resKeys = pricingSchema.resolutions;
    const resolutions: string[] = Array.isArray(resKeys)
      ? (resKeys as unknown[]).map((x) => String(x))
      : Object.keys(costBranch);
    for (const res of resolutions) {
      const cell = costBranch[res];
      if (!isRecord(cell)) continue;
      const kie = toNum(cell.kieCreditsPerSecond, 0);
      const usd = toNum(cell.usdPerSecond, 0);
      for (const d of durList) {
        const ds = String(d);
        const man = manualAt(matrixKey, res, ds);
        rows.push(
          calculatePricingRow({
            inputType: inputLabel,
            resolution: res,
            duration: d,
            kieCreditsPerSecond: kie,
            usdPerSecond: usd,
            usdToKzt,
            internalTokenValueKzt,
            markupPercent,
            manualClientTokens: man,
            matrixKey,
          }),
        );
      }
    }
  }

  const noV = isRecord(providerCost.noVideo) ? providerCost.noVideo : null;
  const wV = isRecord(providerCost.withVideo) ? providerCost.withVideo : null;
  pushBranch(noV, "noVideo", "matrix");
  pushBranch(wV, "withVideo", "videoInputMatrix");

  if (rows.length === 0) {
    return { rows, summary: { minTokens: 0, maxTokens: 0, avgMarginPercent: 0 } };
  }
  const tokens = rows.map((r) => r.finalClientTokens);
  const minTokens = Math.min(...tokens);
  const maxTokens = Math.max(...tokens);
  const marginPercents = rows
    .filter((r) => r.providerKztTotal > 0)
    .map((r) => r.marginPercent);
  const avgMarginPercent =
    marginPercents.length > 0
      ? marginPercents.reduce((a, b) => a + b, 0) / marginPercents.length
      : 0;

  return {
    rows,
    summary: {
      minTokens,
      maxTokens,
      avgMarginPercent: Math.round(avgMarginPercent * 100) / 100,
    },
  };
}

function klingModeSoundMatrixKey(settings: Record<string, unknown>): string {
  const rawMode = settings.mode;
  const mode =
    typeof rawMode === "string"
      ? rawMode.trim()
      : rawMode === null || rawMode === undefined
        ? ""
        : String(rawMode).trim();
  const sound = settings.sound === true;
  if (mode === "4K") return "4K";
  if (mode === "std" && sound) return "std_sound";
  if (mode === "std" && !sound) return "std_no_sound";
  if (mode === "pro" && sound) return "pro_sound";
  if (mode === "pro" && !sound) return "pro_no_sound";
  return "";
}

function matrixResolutionDurationCell(
  matrix: unknown,
  resKey: string,
  dur: string,
): number | null {
  if (!isRecord(matrix) || !resKey || !dur) {
    return null;
  }
  const row = isRecord(matrix[resKey]) ? (matrix[resKey] as Record<string, unknown>) : null;
  if (!row) {
    return null;
  }
  let credits: unknown = row[dur];
  if (credits === undefined) {
    const n = Number.parseInt(dur, 10);
    if (Number.isInteger(n) && String(n) in row) {
      credits = row[String(n)];
    }
  }
  if (typeof credits === "number" && Number.isFinite(credits)) {
    return Math.max(0, Math.floor(credits));
  }
  return null;
}

function manualCell(
  manualOverrides: unknown,
  matrixKey: string,
  resKey: string,
  dur: string,
): number | null {
  if (!isRecord(manualOverrides)) return null;
  const branch = manualOverrides[matrixKey];
  if (!isRecord(branch)) return null;
  const row = branch[resKey];
  if (!isRecord(row)) return null;
  let credits: unknown = row[dur];
  if (credits === undefined) {
    const n = Number.parseInt(dur, 10);
    if (Number.isInteger(n) && String(n) in row) {
      credits = row[String(n)];
    }
  }
  if (credits === null || credits === undefined) return null;
  if (typeof credits === "number" && Number.isFinite(credits)) {
    return Math.max(0, Math.floor(credits));
  }
  return null;
}

function hasSeedanceVideoInput(settings: Record<string, unknown>): boolean {
  if (!Array.isArray(settings.referenceVideoUrls)) {
    return false;
  }
  return settings.referenceVideoUrls.some(
    (x) => typeof x === "string" && x.trim() !== "",
  );
}

/**
 * Seedance 2.0: matrix / videoInputMatrix + addOns. manualOverrides имеет приоритет.
 */
function seedanceStyleCredits(
  raw: Record<string, unknown>,
  settings: Record<string, unknown>,
): number | null {
  const resKey =
    typeof settings.resolution === "string"
      ? settings.resolution.trim()
      : settings.resolution != null
        ? String(settings.resolution).trim()
        : "";
  const dur = String(settings.duration ?? "").trim();
  if (!resKey || !dur) {
    return null;
  }
  const hasVideo = hasSeedanceVideoInput(settings);
  const matrixKey = hasVideo ? "videoInputMatrix" : "matrix";
  const manual = manualCell(raw.manualOverrides, matrixKey, resKey, dur);
  if (manual !== null) {
    return applySeedanceAddOns(raw, settings, manual);
  }
  const primary: unknown = hasVideo && isRecord(raw.videoInputMatrix)
    ? raw.videoInputMatrix
    : raw.matrix;
  const base = matrixResolutionDurationCell(primary, resKey, dur);
  if (base === null) {
    return null;
  }
  return applySeedanceAddOns(raw, settings, base);
}

function applySeedanceAddOns(
  raw: Record<string, unknown>,
  settings: Record<string, unknown>,
  base: number,
): number {
  let total = base;
  const add = raw.addOns;
  if (isRecord(add)) {
    if (settings.generateAudio === true) {
      const a = add.generateAudio;
      if (typeof a === "number" && Number.isFinite(a)) {
        total += a;
      }
    }
    if (settings.returnLastFrame === true) {
      const a = add.returnLastFrame;
      if (typeof a === "number" && Number.isFinite(a)) {
        total += a;
      }
    }
    if (settings.webSearch === true) {
      const a = add.webSearch;
      if (typeof a === "number" && Number.isFinite(a)) {
        total += a;
      }
    }
  }
  return Math.max(0, Math.floor(total));
}

/**
 * Без videoInputMatrix: resolution × duration + manual matrix.
 */
function resolutionDurationMatrixCredits(
  raw: Record<string, unknown>,
  settings: Record<string, unknown>,
): number | null {
  const resKey =
    typeof settings.resolution === "string"
      ? settings.resolution.trim()
      : settings.resolution != null
        ? String(settings.resolution).trim()
        : "";
  const modeFallback =
    typeof settings.mode === "string" && settings.mode.trim() !== ""
      ? settings.mode.trim()
      : "";
  const effectiveRes = resKey || modeFallback;
  const dur = String(settings.duration ?? "").trim();
  if (!effectiveRes || !dur) {
    return null;
  }
  const manual = manualCell(raw.manualOverrides, "matrix", effectiveRes, dur);
  if (manual !== null) {
    return manual;
  }
  return matrixResolutionDurationCell(raw.matrix, effectiveRes, dur);
}

function pickFallbackCredits(
  raw: Record<string, unknown>,
  costCredits: number,
): number {
  const def = raw.defaultCredits;
  if (typeof def === "number" && Number.isFinite(def)) {
    return Math.max(0, Math.floor(def));
  }
  const fb = raw.fallbackCredits;
  if (typeof fb === "number" && Number.isFinite(fb)) {
    return Math.max(0, Math.floor(fb));
  }
  return costCredits;
}

function effectiveMotionControlResolution(
  settings: Record<string, unknown>,
): "720p" | "1080p" {
  const r =
    typeof settings.resolution === "string" && settings.resolution.trim() !== ""
      ? settings.resolution.trim()
      : typeof settings.mode === "string" && settings.mode.trim() !== ""
        ? settings.mode.trim()
        : "720p";
  return r === "1080p" ? "1080p" : "720p";
}

/**
 * Kling Motion Control: `pricingSchema.type === "per_second"`, длительность — загруженное видео.
 */
export function perSecondMotionControlCreditsFromSchema(
  raw: Record<string, unknown>,
  settings: Record<string, unknown>,
  videoDurationSeconds: number,
): number | null {
  if (String(raw.type) !== "per_second") return null;
  const pc = raw.providerCost;
  if (!isRecord(pc)) return null;
  const motionControl = pc.motionControl;
  if (!isRecord(motionControl)) return null;

  const res = effectiveMotionControlResolution(settings);
  const cell = motionControl[res];
  if (!isRecord(cell)) return null;

  const usd = toNum(cell.usdPerSecond, 0);
  const usdToKzt = toNum(raw.usdToKzt, 500);
  const internalTokenValueKzt = toNum(raw.internalTokenValueKzt, 10);
  const markupPercent = toNum(raw.markupPercent, 0);

  const billingSeconds = Math.ceil(videoDurationSeconds);
  if (!Number.isFinite(videoDurationSeconds) || videoDurationSeconds <= 0 || billingSeconds < 1) {
    return null;
  }

  const manualRoot = raw.manualOverrides;
  let manualPerSec: number | null = null;
  if (isRecord(manualRoot)) {
    const pt = manualRoot.perSecondTokens;
    if (isRecord(pt)) {
      const v = pt[res];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        manualPerSec = Math.floor(v);
      }
    }
  }
  if (manualPerSec !== null) {
    return Math.max(0, Math.ceil(manualPerSec * billingSeconds));
  }

  const providerUsdTotal = usd * billingSeconds;
  const providerKztCost = providerUsdTotal * usdToKzt;
  const clientKztPrice = providerKztCost * (1 + markupPercent / 100);
  const autoClientTokens = Math.ceil(clientKztPrice / internalTokenValueKzt);
  return Math.max(0, autoClientTokens);
}

export function buildPerSecondMotionControlPreview(
  pricingSchema: Record<string, unknown>,
): {
  rows: PerSecondMotionPreviewRow[];
  summary: { minTokens: number; maxTokens: number; avgMarginPercent: number };
} {
  const usdToKzt = toNum(pricingSchema.usdToKzt, 500);
  const internalTokenValueKzt = toNum(pricingSchema.internalTokenValueKzt, 10);
  const markupPercent = toNum(pricingSchema.markupPercent, 0);
  const pc = pricingSchema.providerCost;
  const motionControl =
    isRecord(pc) && isRecord(pc.motionControl) ? pc.motionControl : null;

  const rows: PerSecondMotionPreviewRow[] = [];
  if (!motionControl) {
    return {
      rows,
      summary: { minTokens: 0, maxTokens: 0, avgMarginPercent: 0 },
    };
  }

  const resolutions = ["720p", "1080p"] as const;
  const manualRoot = pricingSchema.manualOverrides;
  const manualPt =
    isRecord(manualRoot) && isRecord(manualRoot.perSecondTokens)
      ? manualRoot.perSecondTokens
      : null;

  for (const res of resolutions) {
    const cell = motionControl[res];
    if (!isRecord(cell)) continue;
    const kie = toNum(cell.kieCreditsPerSecond, 0);
    const usd = toNum(cell.usdPerSecond, 0);

    let manualPerSec: number | null = null;
    if (manualPt) {
      const raw = (manualPt as Record<string, unknown>)[res];
      if (typeof raw === "number" && Number.isFinite(raw)) {
        manualPerSec = Math.max(0, Math.floor(raw));
      }
    }

    const providerKztPerSec = usd * usdToKzt;
    const clientKztPerSec = providerKztPerSec * (1 + markupPercent / 100);
    const autoTokensPerSec = clientKztPerSec / internalTokenValueKzt;

    const ex5 = perSecondMotionControlCreditsFromSchema(pricingSchema, { resolution: res }, 5);
    const ex10 = perSecondMotionControlCreditsFromSchema(pricingSchema, { resolution: res }, 10);
    const marginApprox =
      providerKztPerSec > 0
        ? (((ex5 ?? 0) * internalTokenValueKzt - providerKztPerSec * 5) /
            (providerKztPerSec * 5)) *
          100
        : 0;

    rows.push({
      resolution: res,
      kieCreditsPerSecond: kie,
      usdPerSecond: usd,
      autoTokensPerSecond: Math.round(autoTokensPerSec * 10_000) / 10_000,
      manualTokensPerSecond: manualPerSec,
      example5SecTokens: ex5 ?? 0,
      example10SecTokens: ex10 ?? 0,
      marginPercentApprox: Math.round(marginApprox * 100) / 100,
    });
  }

  const tokSamples = rows.flatMap((r) => [r.example5SecTokens, r.example10SecTokens]);
  const minTokens = tokSamples.length ? Math.min(...tokSamples) : 0;
  const maxTokens = tokSamples.length ? Math.max(...tokSamples) : 0;
  const avgMarginPercent =
    rows.length > 0
      ? rows.reduce((a, r) => a + r.marginPercentApprox, 0) / rows.length
      : 0;

  return {
    rows,
    summary: {
      minTokens,
      maxTokens,
      avgMarginPercent: Math.round(avgMarginPercent * 100) / 100,
    },
  };
}

/**
 * Списание кредитов: единая логика для estimate, сабмита и админ-превью.
 */
export function getFinalCreditsFromPricingSchema(
  model: Pick<AiModel, "costCredits" | "pricingSchema">,
  settings: Record<string, unknown>,
): number {
  const fallbackBase = Math.max(0, Math.floor(model.costCredits));
  const raw = model.pricingSchema;
  if (!isRecord(raw)) {
    return fallbackBase;
  }

  if (String(raw.type) === "per_second") {
    const vd = settings.videoDurationSeconds;
    if (typeof vd !== "number" || !Number.isFinite(vd) || vd <= 0) {
      return pickFallbackCredits(raw, fallbackBase);
    }
    const computed = perSecondMotionControlCreditsFromSchema(raw, settings, vd);
    if (computed !== null) {
      return computed;
    }
    return pickFallbackCredits(raw, fallbackBase);
  }

  if (raw.type !== "matrix") {
    return fallbackBase;
  }

  const strategyRaw = raw.matrixKeyStrategy;
  const strategy = String(strategyRaw ?? "").trim();

  if (strategy === "kling_mode_sound") {
    const matrix = raw.matrix;
    if (!isRecord(matrix)) {
      return pickFallbackCredits(raw, fallbackBase);
    }

    const key = klingModeSoundMatrixKey(settings);
    const row = key && isRecord(matrix[key]) ? (matrix[key] as Record<string, unknown>) : null;
    const dur = String(settings.duration ?? "").trim();
    let credits: unknown;
    if (row && dur.length > 0) {
      if (dur in row) {
        credits = row[dur];
      } else {
        const n = Number.parseInt(dur, 10);
        if (Number.isInteger(n) && String(n) in row) {
          credits = row[String(n)];
        }
      }
    }
    if (typeof credits === "number" && Number.isFinite(credits)) {
      return Math.max(0, Math.floor(credits));
    }

    return pickFallbackCredits(raw, fallbackBase);
  }

  if (strategy === "kling_motion_control") {
    const matrix = raw.matrix;
    if (!isRecord(matrix)) {
      return pickFallbackCredits(raw, fallbackBase);
    }
    const mode =
      typeof settings.mode === "string" && settings.mode.trim() !== ""
        ? settings.mode.trim()
        : "720p";
    const row = isRecord(matrix[mode])
      ? (matrix[mode] as Record<string, unknown>)
      : null;
    const def = row?.default;
    if (typeof def === "number" && Number.isFinite(def)) {
      return Math.max(0, Math.floor(def));
    }
    return pickFallbackCredits(raw, fallbackBase);
  }

  if (strategy === "sora_storyboard_n_frames") {
    const matrix = raw.matrix;
    if (!isRecord(matrix)) {
      return pickFallbackCredits(raw, fallbackBase);
    }
    const nf = String(settings.n_frames ?? "").trim();
    let credits: unknown = matrix[nf];
    if (isRecord(credits)) {
      credits =
        credits["1"] ??
        credits.base ??
        credits.credits ??
        credits.default;
    }
    if (typeof credits === "number" && Number.isFinite(credits)) {
      return Math.max(0, Math.floor(credits));
    }
    return pickFallbackCredits(raw, fallbackBase);
  }

  if (strategy !== "") {
    return pickFallbackCredits(raw, fallbackBase);
  }

  if (isRecord(raw.videoInputMatrix)) {
    const seed = seedanceStyleCredits(raw, settings);
    if (seed !== null) {
      return seed;
    }
    return pickFallbackCredits(raw, fallbackBase);
  }

  const fromResDur = resolutionDurationMatrixCredits(raw, settings);
  if (fromResDur !== null) {
    return fromResDur;
  }

  return pickFallbackCredits(raw, fallbackBase);
}
