import { isRecord } from "@/lib/model-pricing-shared";

/** Поля settings, участвующие в pickKeys product card pricing (порядок важен). */
export const PRODUCT_CARD_PRICING_KEY_FIELDS = [
  "size",
  "cardSize",
  "preset",
  "templatePreset",
  "resolution",
  "quality",
  "aspectRatio",
  "duration",
  "style",
] as const;

/** Канонический ключ ячейки duration × resolution для product card video matrix. */
export function buildProductCardVideoMatrixKey(duration: number, resolution: string): string {
  return `duration:${duration}|resolution:${resolution.trim()}`;
}

/** Альтернативный ключ (legacy-friendly), проверяется сразу после канонического. */
export function buildProductCardVideoMatrixKeyAlt(duration: number, resolution: string): string {
  return `${duration}|${resolution.trim()}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

/**
 * Ключи для lookup в matrix / manualOverrides / multipliers.
 * Составные duration|resolution — первыми, чтобы не перебивались flat resolution keys.
 */
export function pickProductCardPricingKeys(settings: Record<string, unknown>): string[] {
  const keys: string[] = [];
  const duration = settings.duration;
  const resolution = settings.resolution;
  if (
    (typeof duration === "string" || typeof duration === "number") &&
    typeof resolution === "string" &&
    resolution.trim()
  ) {
    const d = String(duration);
    const r = resolution.trim();
    keys.push(buildProductCardVideoMatrixKey(Number(duration), r));
    keys.push(buildProductCardVideoMatrixKeyAlt(Number(duration), r));
  }
  for (const name of PRODUCT_CARD_PRICING_KEY_FIELDS) {
    const value = settings[name];
    if (typeof value === "string" || typeof value === "number") {
      keys.push(`${name}:${String(value)}`);
      keys.push(String(value));
    }
  }
  return keys;
}

export function entryForProductCardMatrixKeys(
  source: unknown,
  keys: string[],
): Record<string, unknown> | null {
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

export function matrixKeyUsedForSettings(
  matrix: unknown,
  settings: Record<string, unknown>,
): string | null {
  const obj = asRecord(matrix);
  if (!obj) return null;
  const keys = pickProductCardPricingKeys(settings);
  for (const key of keys) {
    if (asRecord(obj[key]) || typeof obj[key] === "number") {
      return key;
    }
  }
  return null;
}
