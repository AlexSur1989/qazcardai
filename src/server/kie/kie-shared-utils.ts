/**
 * Общие утилиты Kie-моделей (без привязки к конкретному каталогу).
 */

export const KIE_METADATA_SOURCE_LINE = "docs.kie.ai + kie.ai playground";

/** Для Kie: без aspect допускается только 1K — в теле создаём согласованный aspect_ratio:auto. */
export function normalizeGptImage2AspectIfOmittedForKie(
  apiModelId: string,
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const id = apiModelId.trim();
  if (
    id !== "gpt-image-2-text-to-image" &&
    id !== "gpt-image-2-image-to-image"
  ) {
    return settings;
  }
  const r = String(settings.resolution ?? "").trim();
  const raw = settings.aspectRatio;
  const missing =
    raw === undefined || raw === null || String(raw).trim() === "";
  if (missing && r === "1K") {
    return { ...settings, aspectRatio: "auto" };
  }
  return settings;
}

export function listingFieldNamesFromSettingsSchema(
  settingsSchema: Record<string, unknown> | null | undefined,
): string[] {
  const fields = (settingsSchema as { fields?: { name?: string }[] } | undefined)
    ?.fields;
  if (!Array.isArray(fields)) return [];
  return fields.map((f) => f.name).filter((n): n is string => Boolean(n));
}

/** @deprecated Используйте slug из KieModelDefinition; реестр пуст. */
export function phase1SlugByApiModelId(_apiModelId: string): string | null {
  return null;
}
