/** Hailuo 2.3 Image→Video (Kie Market: hailuo/2-3-image-to-video-*). */

export function isHailuo23ImageToVideoModel(
  apiModelId: string | null | undefined,
): boolean {
  const id = String(apiModelId ?? "").trim().toLowerCase();
  return (
    id === "hailuo/2-3-image-to-video-standard" ||
    id === "hailuo/2-3-image-to-video-pro"
  );
}

function imageUrlList(settings: Record<string, unknown>): string[] {
  if (!Array.isArray(settings.imageUrls)) return [];
  return settings.imageUrls
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
}

/**
 * В payload Kie уходит `image_url` (один URL); в форме — `imageUrls[0]` или файл из inputFiles.
 */
export function mergeHailuo23SettingsWithInputFiles(
  apiModelId: string,
  settings: Record<string, unknown>,
  inputHttpUrls: string[],
): Record<string, unknown> {
  if (!isHailuo23ImageToVideoModel(apiModelId)) return settings;
  if (imageUrlList(settings).length > 0) return settings;
  if (inputHttpUrls.length === 0) return settings;
  return { ...settings, imageUrls: [inputHttpUrls[0]!] };
}

export function validateHailuo23ImageToVideoSettings(
  apiModelId: string | null | undefined,
  settings: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  if (!isHailuo23ImageToVideoModel(apiModelId)) return { ok: true };

  const imgs = imageUrlList(settings);
  if (imgs.length === 0) {
    return {
      ok: false,
      message:
        "Hailuo 2.3: укажите URL изображения (поле imageUrls) или публичный URL вложения.",
    };
  }

  const dur = String(settings.duration ?? "6").trim();
  if (dur !== "6" && dur !== "10") {
    return {
      ok: false,
      message: "Hailuo 2.3: длительность — 6 или 10 с.",
    };
  }

  const resRaw =
    typeof settings.resolution === "string" ? settings.resolution.trim() : "";
  const resUp = resRaw.toUpperCase();
  const resolution = resUp === "1080P" ? "1080P" : "768P";
  if (resolution === "1080P" && dur === "10") {
    return {
      ok: false,
      message:
        "Hailuo 2.3: для 1080P недоступно 10 с (по доке Kie — только 6 с).",
    };
  }

  return { ok: true };
}
