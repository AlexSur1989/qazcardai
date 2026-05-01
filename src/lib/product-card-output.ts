/**
 * Парсинг outputFiles у Generation (массив объектов с url / kind).
 */
export function getFirstOutputUrlFromJson(outputFiles: unknown): string | null {
  if (outputFiles == null) return null;
  if (Array.isArray(outputFiles)) {
    for (const x of outputFiles) {
      if (typeof x === "object" && x && "url" in x && typeof (x as { url: unknown }).url === "string") {
        const u = (x as { url: string }).url.trim();
        if (u.startsWith("http")) return u;
      }
    }
  }
  if (typeof outputFiles === "object" && outputFiles && "url" in outputFiles) {
    const u = (outputFiles as { url: unknown }).url;
    if (typeof u === "string" && u.trim().startsWith("http")) return u.trim();
  }
  return null;
}
