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

function validateProductCardMatrixSchema(
  input: Record<string, unknown>,
): { ok: true; pricingSchema: Record<string, unknown> } | { ok: false; error: string } {
  const base = input.baseTokens ?? input.fallbackTokens;
  if (typeof base !== "number" || !Number.isFinite(base) || base < 0) {
    return { ok: false, error: "baseTokens / fallbackTokens — число ≥ 0" };
  }
  const pm = input.priceMultiplier;
  if (pm !== undefined) {
    const p = typeof pm === "number" ? pm : Number(pm);
    if (!Number.isFinite(p) || p <= 0) {
      return { ok: false, error: "priceMultiplier должно быть > 0" };
    }
  }
  const mpc = input.minTokens;
  if (mpc !== undefined) {
    const n = typeof mpc === "number" ? mpc : Number(mpc);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "minTokens должно быть ≥ 0" };
    }
  }
  const bt = input.variantsBundleTokens;
  if (bt !== undefined) {
    const n = typeof bt === "number" ? bt : Number(bt);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "variantsBundleTokens должно быть ≥ 0" };
    }
  }
  const vpc = input.variantCount;
  if (vpc !== undefined) {
    const n = typeof vpc === "number" ? vpc : Number(vpc);
    if (!Number.isInteger(n) || n < 1 || n > 12) {
      return { ok: false, error: "variantCount должно быть от 1 до 12" };
    }
  }
  const by = input.variantsBundleByCount;
  if (by !== undefined) {
    if (!isRecord(by)) {
      return { ok: false, error: "variantsBundleByCount должен быть объектом" };
    }
    for (const [k, v] of Object.entries(by)) {
      if (!/^\d+$/.test(k)) continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        return { ok: false, error: `variantsBundleByCount.${k}: число ≥ 0` };
      }
    }
  }

  function assertMultiplierMap(title: string, raw: unknown): { ok: false; error: string } | null {
    if (raw === undefined) return null;
    if (!isRecord(raw)) {
      return { ok: false, error: `${title} должен быть объектом` };
    }
    for (const val of Object.values(raw)) {
      if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
        return { ok: false, error: `${title}: множитель > 0` };
      }
    }
    return null;
  }

  const m1 = assertMultiplierMap("cardSizeMultipliers", input.cardSizeMultipliers);
  if (m1) return m1;
  const m2 = assertMultiplierMap("templateMultipliers", input.templateMultipliers);
  if (m2) return m2;

  const tgt = input.targetMarginPercent;
  if (tgt !== undefined) {
    const n = typeof tgt === "number" ? tgt : Number(tgt);
    if (!Number.isFinite(n) || n < 0 || n > 99) {
      return {
        ok: false,
        error: "targetMarginPercent должно быть от 0 до 99",
      };
    }
  }

  const pUsd = input.providerCostUsd;
  if (
    pUsd !== undefined &&
    (typeof pUsd !== "number" || !Number.isFinite(pUsd) || pUsd < 0)
  ) {
    return { ok: false, error: "providerCostUsd ≥ 0" };
  }

  const mo = input.manualOverrides;
  if (mo !== undefined && typeof mo !== "object") {
    return { ok: false, error: "manualOverrides: ожидается JSON объект" };
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
  if (String(input.type) === "product_card_matrix") {
    return validateProductCardMatrixSchema(input);
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
