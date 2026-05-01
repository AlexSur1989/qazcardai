import {
  buildPricingPreview,
} from "@/server/services/modelPricingCalculator";
import { isRecord } from "@/lib/model-pricing-shared";

/**
 * Проверка JSON ценообразования перед сохранением (SUPER_ADMIN).
 * Не доверяет произвольной форме, но допускает расширения полями.
 */
function validatePerSecondMotionSchema(
  input: Record<string, unknown>,
): { ok: true; pricingSchema: Record<string, unknown> } | { ok: false; error: string } {
  const usdToKzt = input.usdToKzt;
  if (typeof usdToKzt !== "number" || !Number.isFinite(usdToKzt) || usdToKzt <= 0) {
    return { ok: false, error: "usdToKzt должен быть числом > 0" };
  }
  const internalTokenValueKzt = input.internalTokenValueKzt;
  if (
    typeof internalTokenValueKzt !== "number" ||
    !Number.isFinite(internalTokenValueKzt) ||
    internalTokenValueKzt <= 0
  ) {
    return {
      ok: false,
      error: "internalTokenValueKzt должен быть числом > 0",
    };
  }
  const markup = input.markupPercent;
  if (typeof markup !== "number" || !Number.isFinite(markup) || markup < 0) {
    return { ok: false, error: "markupPercent должен быть числом ≥ 0" };
  }
  const pc = input.providerCost;
  if (!isRecord(pc)) {
    return { ok: false, error: "providerCost.motionControl обязателен" };
  }
  const mc = pc.motionControl;
  if (!isRecord(mc)) {
    return { ok: false, error: "providerCost.motionControl должен быть объектом" };
  }
  for (const res of ["720p", "1080p"] as const) {
    const cell = mc[res];
    if (!isRecord(cell)) {
      return { ok: false, error: `providerCost.motionControl.${res} обязателен` };
    }
    const k = cell.kieCreditsPerSecond;
    const u = cell.usdPerSecond;
    if (typeof k !== "number" || !Number.isFinite(k) || k < 0) {
      return { ok: false, error: `kieCreditsPerSecond (${res}) ≥ 0` };
    }
    if (typeof u !== "number" || !Number.isFinite(u) || u < 0) {
      return { ok: false, error: `usdPerSecond (${res}) ≥ 0` };
    }
  }
  const mo = input.manualOverrides;
  if (mo !== undefined && isRecord(mo) && isRecord(mo.perSecondTokens)) {
    for (const v of Object.values(mo.perSecondTokens)) {
      if (v === null || v === undefined || v === "") continue;
      if (typeof v === "number") {
        if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
          return { ok: false, error: "manualOverrides.perSecondTokens: целое ≥ 0" };
        }
      } else {
        return { ok: false, error: "manualOverrides.perSecondTokens: ожидается целое число" };
      }
    }
  }
  if (input.defaultCredits !== undefined) {
    const d = input.defaultCredits;
    if (typeof d !== "number" || !Number.isFinite(d) || d < 0 || !Number.isInteger(d)) {
      return { ok: false, error: "defaultCredits — целое число ≥ 0" };
    }
  }
  if (input.fallbackCredits !== undefined) {
    const f = input.fallbackCredits;
    if (typeof f !== "number" || !Number.isFinite(f) || f < 0 || !Number.isInteger(f)) {
      return { ok: false, error: "fallbackCredits — целое число ≥ 0" };
    }
  }
  return { ok: true, pricingSchema: input };
}

export function validateAdminPricingSchema(
  input: unknown,
): { ok: true; pricingSchema: Record<string, unknown> } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: "pricingSchema должен быть объектом" };
  }
  if (String(input.type) === "per_second") {
    return validatePerSecondMotionSchema(input);
  }
  if (String(input.type) !== "matrix") {
    return { ok: true, pricingSchema: input };
  }
  const usdToKzt = input.usdToKzt;
  if (typeof usdToKzt !== "number" || !Number.isFinite(usdToKzt) || usdToKzt <= 0) {
    return { ok: false, error: "usdToKzt должен быть числом > 0" };
  }
  const internalTokenValueKzt = input.internalTokenValueKzt;
  if (
    typeof internalTokenValueKzt !== "number" ||
    !Number.isFinite(internalTokenValueKzt) ||
    internalTokenValueKzt <= 0
  ) {
    return {
      ok: false,
      error: "internalTokenValueKzt должен быть числом > 0",
    };
  }
  const markup = input.markupPercent;
  if (typeof markup !== "number" || !Number.isFinite(markup) || markup < 0) {
    return { ok: false, error: "markupPercent должен быть числом ≥ 0" };
  }
  if (input.defaultCredits !== undefined) {
    const d = input.defaultCredits;
    if (typeof d !== "number" || !Number.isFinite(d) || d < 0 || !Number.isInteger(d)) {
      return { ok: false, error: "defaultCredits — целое число ≥ 0" };
    }
  }
  if (input.fallbackCredits !== undefined) {
    const f = input.fallbackCredits;
    if (typeof f !== "number" || !Number.isFinite(f) || f < 0 || !Number.isInteger(f)) {
      return { ok: false, error: "fallbackCredits — целое число ≥ 0" };
    }
  }
  const providerCost = input.providerCost;
  if (isRecord(providerCost)) {
    for (const branch of [providerCost.noVideo, providerCost.withVideo]) {
      if (!isRecord(branch)) continue;
      for (const res of Object.values(branch)) {
        if (!isRecord(res)) continue;
        const k = res.kieCreditsPerSecond;
        const u = res.usdPerSecond;
        if (typeof k !== "number" || !Number.isFinite(k) || k < 0) {
          return { ok: false, error: "kieCreditsPerSecond ≥ 0" };
        }
        if (typeof u !== "number" || !Number.isFinite(u) || u < 0) {
          return { ok: false, error: "usdPerSecond ≥ 0" };
        }
      }
    }
  }
  const mo = input.manualOverrides;
  if (mo !== undefined && isRecord(mo)) {
    for (const b of Object.values(mo)) {
      if (!isRecord(b)) continue;
      for (const row of Object.values(b)) {
        if (!isRecord(row)) continue;
        for (const v of Object.values(row)) {
          if (v === null || v === undefined || v === "") continue;
          if (typeof v === "number") {
            if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
              return { ok: false, error: "manual client tokens: целое ≥ 0" };
            }
          } else {
            return { ok: false, error: "manual client tokens: ожидается целое число" };
          }
        }
      }
    }
  }
  const { rows } = buildPricingPreview(input);
  for (const r of rows) {
    if (r.finalClientTokens < 0) {
      return { ok: false, error: "финальные токены не могут быть отрицательными" };
    }
  }
  return { ok: true, pricingSchema: input };
}
