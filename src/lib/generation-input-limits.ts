const DATA_URL_PREFIX = /^data:image\/(png|jpeg|jpg|webp|gif|jfif|pjpeg|pjp);base64,(.+)$/i;

function getMaxImageBytes(): number {
  const raw = process.env.MAX_IMAGE_UPLOAD_MB;
  const mb = raw ? parseInt(raw, 10) : 10;
  if (!Number.isFinite(mb) || mb < 1) {
    return 10 * 1024 * 1024;
  }
  return Math.min(mb, 100) * 1024 * 1024;
}

function getMaxInputFileCount(): number {
  const raw = process.env.GENERATION_MAX_INPUT_IMAGE_COUNT;
  const n = raw ? parseInt(raw, 10) : 5;
  if (!Number.isFinite(n) || n < 1) return 5;
  return Math.min(n, 10);
}

export type InputFilesValidation = { ok: true } | { ok: false; error: string };

/**
 * Проверка лимитов: для data URL — размер base64, для публичных URL — только количество (без скачивания).
 */
export function validateImageInputFiles(inputFiles: string[] | undefined): InputFilesValidation {
  if (!inputFiles || inputFiles.length === 0) {
    return { ok: true };
  }
  const maxCount = getMaxInputFileCount();
  if (inputFiles.length > maxCount) {
    return { ok: false, error: `Допустимо не более ${maxCount} изображений` };
  }
  const maxBytes = getMaxImageBytes();
  for (const entry of inputFiles) {
    const t = entry.trim();
    if (t.startsWith("http://") || t.startsWith("https://")) {
      continue;
    }
    if (t.startsWith("data:")) {
      const m = t.match(DATA_URL_PREFIX);
      if (!m) {
        return {
          ok: false,
          error: "data URL: допустимы изображения png, jpg, webp, gif (base64)",
        };
      }
      const b64 = m[2] ?? "";
      const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
      const estBytes = Math.max(0, (b64.length * 3) / 4 - padding);
      if (estBytes > maxBytes) {
        return {
          ok: false,
          error: `Превышен лимит размера вложения (${process.env.MAX_IMAGE_UPLOAD_MB ?? 10} МБ)`,
        };
      }
      continue;
    }
    return {
      ok: false,
      error: "Каждое вложение должно быть data URL (base64) или публичным https URL",
    };
  }
  return { ok: true };
}

export function publicHttpUrlsOnly(inputFiles: string[] | undefined): string[] {
  if (!inputFiles?.length) return [];
  return inputFiles
    .map((s) => s.trim())
    .filter((s) => s.startsWith("https://") || s.startsWith("http://"));
}
