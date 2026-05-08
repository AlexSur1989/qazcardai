import { MODEL_SLUG_ALIASES } from "@/config/generation-models";

/** Разрешение короткого ?model= (алиас или полный slug в БД). */
export function canonicalModelSlug(param: string | null | undefined): string | undefined {
  if (!param || !param.trim()) {
    return undefined;
  }
  const p = param.trim();
  const mapped = MODEL_SLUG_ALIASES[p];
  return mapped ?? p;
}
