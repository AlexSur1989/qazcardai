/** Google Veo 3.1 через Kie (`/api/v1/veo/*`, не jobs/createTask). */

export function isVeo31FamilyApiModelId(
  apiModelId: string | null | undefined,
): boolean {
  const id = String(apiModelId ?? "").trim();
  return (
    id === "veo-3-1" ||
    id === "veo/extend" ||
    id === "veo/get-4k-video" ||
    id === "veo/get-1080p-video"
  );
}

function imageUrlList(settings: Record<string, unknown>): string[] {
  if (!Array.isArray(settings.imageUrls)) return [];
  return settings.imageUrls
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
}

/** Для generate: imageUrls или первый URL вложения. */
export function mergeVeo31GenerateImageUrls(
  apiModelId: string,
  settings: Record<string, unknown>,
  inputHttpUrls: string[],
): Record<string, unknown> {
  if (apiModelId !== "veo-3-1") return settings;
  if (imageUrlList(settings).length > 0) return settings;
  if (inputHttpUrls.length === 0) return settings;
  return { ...settings, imageUrls: [...inputHttpUrls] };
}

export function validateVeo31ModelSettings(
  apiModelId: string | null | undefined,
  settings: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const id = String(apiModelId ?? "").trim();
  if (!isVeo31FamilyApiModelId(id)) return { ok: true };

  if (id === "veo/extend" || id === "veo/get-4k-video" || id === "veo/get-1080p-video") {
    const t = String(settings.sourceTaskId ?? "").trim();
    if (!t) {
      return {
        ok: false,
        message:
          id === "veo/extend"
            ? "Veo Extend: укажите sourceTaskId (taskId исходного ролика Veo)."
            : "Veo: укажите sourceTaskId (taskId задачи Veo).",
      };
    }
  }

  return { ok: true };
}
