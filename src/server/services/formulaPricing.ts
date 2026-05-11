/**
 * PricingSchema type "formula": baseCredits + conditional rules → integer credits.
 * Используется в getFinalCreditsFromPricingSchema, админ-превью и verify.
 */

import { isRecord } from "@/lib/model-pricing-shared";

export type FormulaAppliedRule = {
  field: string;
  operator: string;
  value: unknown;
  effect: "multiply" | "addCredits" | "setCredits";
  amount?: number;
};

export type FormulaEvaluationResult = {
  credits: number;
  appliedRules: FormulaAppliedRule[];
  error?: string;
};

function toNumFlexible(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function looseEquals(settingVal: unknown, ruleVal: unknown): boolean {
  if (settingVal === ruleVal) return true;
  if (typeof ruleVal === "boolean" && typeof settingVal === "boolean") {
    return settingVal === ruleVal;
  }
  const ns = toNumFlexible(settingVal);
  const nr = toNumFlexible(ruleVal);
  if (ns !== null && nr !== null && ns === nr) return true;
  return String(settingVal).trim() === String(ruleVal).trim();
}

/** Поддержка `field` вида «a» или «a.b» как вложенных ключах. */
function getSettingNested(
  settings: Record<string, unknown>,
  field: string,
): unknown {
  const parts = field.split(".").filter((p) => p.length > 0);
  let cur: unknown = settings;
  for (const p of parts) {
    if (!isRecord(cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function matchesWhen(
  settings: Record<string, unknown>,
  when: Record<string, unknown>,
): boolean {
  const fieldRaw = when.field;
  if (typeof fieldRaw !== "string" || fieldRaw.trim() === "") return false;
  const val = getSettingNested(settings, fieldRaw.trim());

  if ("equals" in when) {
    return looseEquals(val, (when as { equals: unknown }).equals);
  }
  if ("in" in when) {
    const list = (when as { in: unknown }).in;
    if (!Array.isArray(list)) return false;
    return list.some((x) => looseEquals(val, x));
  }
  if (when.exists === true) {
    return val !== undefined && val !== null && String(val).trim() !== "";
  }
  const n = toNumFlexible(val);
  if ("min" in when && typeof (when as { min: unknown }).min === "number") {
    const m = (when as { min: number }).min;
    return n !== null && Number.isFinite(n) && n >= m;
  }
  if ("max" in when && typeof (when as { max: unknown }).max === "number") {
    const m = (when as { max: number }).max;
    return n !== null && Number.isFinite(n) && n <= m;
  }
  return false;
}

type RoundMode = "ceil" | "floor" | "round";

function applyRound(mode: RoundMode, value: number): number {
  if (mode === "floor") return Math.floor(value);
  if (mode === "round") return Math.round(value);
  return Math.ceil(value);
}

/** Разбираем правило вида `{ when: {...}, multiply: 2 }` или `{ when, action, amount }`. */
export function evaluateFormulaCredits(
  raw: Record<string, unknown>,
  settings: Record<string, unknown>,
): FormulaEvaluationResult {
  const appliedRules: FormulaAppliedRule[] = [];

  const baseCredits = Number(raw.baseCredits);
  if (!Number.isFinite(baseCredits) || baseCredits < 0) {
    return {
      credits: 0,
      appliedRules,
      error: "formula.baseCredits должен быть числом ≥ 0",
    };
  }

  let credits = baseCredits;

  const rules = raw.rules;
  if (!Array.isArray(rules)) {
    return { credits: 0, appliedRules, error: "formula.rules должен быть массивом" };
  }

  for (const ru of rules) {
    if (!isRecord(ru)) continue;

    let whenRaw: Record<string, unknown>;
    let multiply: number | undefined;
    let addCredits: number | undefined;
    let setCredits: number | undefined;

    if (isRecord(ru.when)) {
      whenRaw = ru.when;
      multiply =
        typeof ru.multiply === "number" && Number.isFinite(ru.multiply)
          ? ru.multiply
          : undefined;
      addCredits =
        typeof ru.addCredits === "number" && Number.isFinite(ru.addCredits)
          ? ru.addCredits
          : undefined;
      setCredits =
        typeof ru.setCredits === "number" && Number.isFinite(ru.setCredits)
          ? ru.setCredits
          : undefined;
      if (
        multiply === undefined &&
        addCredits === undefined &&
        setCredits === undefined
      ) {
        const action = ru.action;
        const amount = ru.amount;
        if (typeof action === "string" && typeof amount === "number") {
          if (action === "multiply" && Number.isFinite(amount))
            multiply = amount;
          else if (action === "addCredits" && Number.isFinite(amount))
            addCredits = amount;
          else if (action === "setCredits" && Number.isFinite(amount))
            setCredits = amount;
        }
      }
    } else continue;

    const field =
      typeof whenRaw.field === "string" ? whenRaw.field.trim() : "";
    if (!field || !matchesWhen(settings, whenRaw)) continue;

    let op: FormulaAppliedRule["effect"] | null = null;
    let amount: number | undefined;

    if (multiply !== undefined && multiply !== null) {
      credits *= multiply;
      op = "multiply";
      amount = multiply;
    } else if (addCredits !== undefined) {
      credits += addCredits;
      op = "addCredits";
      amount = addCredits;
    } else if (setCredits !== undefined) {
      credits = setCredits;
      op = "setCredits";
      amount = setCredits;
    }

    if (op !== null) {
      let reprValue: unknown;
      if ("equals" in whenRaw) reprValue = (whenRaw as { equals?: unknown }).equals;
      else if ("in" in whenRaw)
        reprValue = `[${String((whenRaw as { in?: unknown }).in)}]`;
      else if ("min" in whenRaw)
        reprValue = (whenRaw as { min?: unknown }).min;
      else if ("max" in whenRaw)
        reprValue = (whenRaw as { max?: unknown }).max;
      else reprValue = "exists";

      appliedRules.push({
        field,
        operator: Object.keys(whenRaw).includes("equals")
          ? "equals"
          : Object.keys(whenRaw).includes("in")
            ? "in"
            : whenRaw.exists === true
              ? "exists"
              : "min" in whenRaw
                ? "min"
                : "max" in whenRaw
                  ? "max"
                  : "matches",
        value: reprValue,
        effect: op,
        amount,
      });
    }
  }

  let minCredits: number | undefined;
  const mcRaw = raw.minCredits;
  if (typeof mcRaw === "number" && Number.isFinite(mcRaw) && mcRaw >= 0) {
    minCredits = mcRaw;
    credits = Math.max(credits, minCredits);
  }

  const roundRaw = raw.round;
  const rm: RoundMode =
    roundRaw === "floor" || roundRaw === "round" ? roundRaw : "ceil";
  credits = applyRound(rm, credits);
  credits = Math.max(0, Math.floor(credits));

  return {
    credits,
    appliedRules,
  };
}
