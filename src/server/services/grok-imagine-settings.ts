/** Grok Imagine (Kie Market: grok-imagine/*). */

export function isGrokImagineModel(apiModelId: string | null | undefined): boolean {
  return String(apiModelId ?? "").trim().toLowerCase().startsWith("grok-imagine/");
}

function imageUrlList(settings: Record<string, unknown>): string[] {
  if (!Array.isArray(settings.imageUrls)) return [];
  return settings.imageUrls
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
}

export function validateGrokImagineSettings(
  apiModelId: string | null | undefined,
  settings: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const id = String(apiModelId ?? "").trim().toLowerCase();
  if (!id.startsWith("grok-imagine/")) return { ok: true };

  const imgs = imageUrlList(settings);

  if (id === "grok-imagine/image-to-image" || id === "grok-imagine/image-to-video") {
    if (imgs.length === 0) {
      return {
        ok: false,
        message:
          id === "grok-imagine/image-to-video"
            ? "Grok Imagine Image→Video: укажите минимум один URL в imageUrls."
            : "Grok Imagine Image→Image: укажите минимум один URL в imageUrls.",
      };
    }
  }

  return { ok: true };
}

/** URL из imageUrls для модерации / лимитов. */
export function collectGrokImagineSettingsHttpUrls(
  apiModelId: string,
  normalizedSettings: Record<string, unknown>,
): string[] {
  if (!isGrokImagineModel(apiModelId)) return [];
  return imageUrlList(normalizedSettings);
}
