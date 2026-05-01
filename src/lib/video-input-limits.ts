import {
  type InputFilesValidation,
  validateImageInputFiles,
} from "@/lib/generation-input-limits";

const VIDEO_DATA = /^data:video\/(mp4|webm|quicktime|x-msvideo);base64,(.+)$/i;
const MAX_VIDEO_INPUT_COUNT_ENV = "GENERATION_MAX_VIDEO_INPUT_COUNT";

function getMaxVideoInputCount(): number {
  const raw = process.env[MAX_VIDEO_INPUT_COUNT_ENV];
  const n = raw ? parseInt(raw, 10) : 3;
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(n, 10);
}

function getMaxVideoBytes(): number {
  const raw = process.env.MAX_VIDEO_UPLOAD_MB;
  const mb = raw ? parseInt(raw, 10) : 100;
  if (!Number.isFinite(mb) || mb < 1) {
    return 100 * 1024 * 1024;
  }
  return Math.min(mb, 2000) * 1024 * 1024;
}

/**
 * Входы для видео: URL, data:video (лимит MAX_VIDEO_UPLOAD_MB), data:image (лимит MAX_IMAGE_* из image-валидации).
 */
export function validateVideoInputFiles(
  inputFiles: string[] | undefined,
): InputFilesValidation {
  if (!inputFiles || inputFiles.length === 0) {
    return { ok: true };
  }
  const maxCount = getMaxVideoInputCount();
  if (inputFiles.length > maxCount) {
    return { ok: false, error: `Допустимо не более ${maxCount} вложений` };
  }
  const maxVideo = getMaxVideoBytes();
  const nonVideoData: string[] = [];
  for (const entry of inputFiles) {
    const t = entry.trim();
    if (t.startsWith("http://") || t.startsWith("https://")) {
      nonVideoData.push(entry);
      continue;
    }
    if (t.startsWith("/uploads/")) {
      nonVideoData.push(entry);
      continue;
    }
    if (t.startsWith("data:video/")) {
      const m = t.match(VIDEO_DATA);
      if (!m) {
        return {
          ok: false,
          error: "data: видео — mp4, webm, mov, avi (base64), см. MAX_VIDEO_UPLOAD_MB",
        };
      }
      const b64 = m[2] ?? "";
      const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
      const estBytes = Math.max(0, (b64.length * 3) / 4 - padding);
      if (estBytes > maxVideo) {
        return {
          ok: false,
          error: `Превышен лимит размера видео-вложения (${process.env.MAX_VIDEO_UPLOAD_MB ?? 100} МБ)`,
        };
      }
      continue;
    }
    nonVideoData.push(entry);
  }
  if (nonVideoData.length === 0) {
    return { ok: true };
  }
  return validateImageInputFiles(nonVideoData);
}
