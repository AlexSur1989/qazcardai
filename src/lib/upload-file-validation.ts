import "server-only";

import type { RateUploadSettings } from "@/lib/rate-upload-settings";
import { getRateUploadSettings } from "@/lib/rate-upload-settings";

export type UploadKind = "image" | "video";

/** Что мы принимаем (строго по MIME) + проверка сигнатур для изображений и основных видео. */
/** Статические allowlist'ы. TODO: подключить AppSetting (ALLOWED_*_MIME_TYPES), когда договоримся с async-валидацией. */
const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const UNSAFE_MIMES = new Set([
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
  "text/html",
  "application/zip",
  "application/x-zip-compressed",
]);

function looksLikePng(b: Buffer): boolean {
  return b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

function looksLikeJpeg(b: Buffer): boolean {
  return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

function looksLikeWebp(b: Buffer): boolean {
  if (b.length < 12) return false;
  const s = b.subarray(0, 4).toString("ascii");
  if (s !== "RIFF") return false;
  return b.subarray(8, 12).toString("ascii") === "WEBP";
}

function looksLikeGif(b: Buffer): boolean {
  if (b.length < 6) return false;
  const s = b.subarray(0, 6).toString("ascii");
  return s === "GIF87a" || s === "GIF89a";
}

function looksLikeMp4(b: Buffer): boolean {
  if (b.length < 12) return false;
  // ftyp at offset 4
  if (b.subarray(4, 8).toString("ascii") === "ftyp") return true;
  return false;
}

function looksLikeWebm(b: Buffer): boolean {
  return b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
}

/** MOV/QuickTime часто с тем же `ftyp`, что и MP4. */
function looksLikeMov(b: Buffer): boolean {
  return looksLikeMp4(b);
}

export type UploadValidationError = {
  ok: false;
  message: string;
  code: "FILE_TOO_LARGE" | "INVALID_TYPE" | "UNSAFE" | "MAGIC_MISMATCH";
};

export type UploadValidationOk = {
  ok: true;
  mime: string;
  maxBytes: number;
};

/**
 * Проверка в памяти: без записи на диск VPS. Для production всё равно нужен грамотный reverse proxy.
 */
export async function getUploadSizeLimitBytes(
  kind: UploadKind,
  settings?: RateUploadSettings,
): Promise<{ maxBytes: number; maxMb: number }> {
  const s = settings ?? (await getRateUploadSettings());
  const maxMb = kind === "image" ? s.maxImageUploadMb : s.maxVideoUploadMb;
  return { maxBytes: maxMb * 1024 * 1024, maxMb };
}

function validateImageMagic(mime: string, buf: Buffer): boolean {
  if (mime === "image/png") return looksLikePng(buf);
  if (mime === "image/jpeg" || mime === "image/jpg") return looksLikeJpeg(buf);
  if (mime === "image/webp") return looksLikeWebp(buf);
  if (mime === "image/gif") return looksLikeGif(buf);
  return false;
}

function validateVideoMagic(mime: string, buf: Buffer): boolean {
  if (mime === "video/mp4") return looksLikeMp4(buf);
  if (mime === "video/webm") return looksLikeWebm(buf);
  if (mime === "video/quicktime") return looksLikeMov(buf) || looksLikeMp4(buf);
  return false;
}

export function validateUploadBuffer(
  kind: UploadKind,
  fileName: string,
  clientMime: string,
  size: number,
  buffer: Buffer,
  limits: { maxBytes: number; maxMb: number },
): UploadValidationError | UploadValidationOk {
  const rawMime = clientMime?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!rawMime) {
    return { ok: false, message: "Укажите корректный Content-Type", code: "INVALID_TYPE" };
  }
  if (UNSAFE_MIMES.has(rawMime) || rawMime === "application/octet-stream") {
    return { ok: false, message: "Неподдерживаемый или небезопасный тип файла", code: "UNSAFE" };
  }

  if (size > limits.maxBytes) {
    return {
      ok: false,
      message: `Файл слишком большой. Максимум ${limits.maxMb} МБ`,
      code: "FILE_TOO_LARGE",
    };
  }
  if (size < 16) {
    return { ok: false, message: "Файл пустой или слишком короткий", code: "INVALID_TYPE" };
  }

  if (kind === "image") {
    if (!IMAGE_MIMES.has(rawMime)) {
      return {
        ok: false,
        message: "Расрешены только изображения: PNG, JPEG, WebP, GIF",
        code: "INVALID_TYPE",
      };
    }
    if (!validateImageMagic(rawMime, buffer)) {
      return {
        ok: false,
        message: "Содержимое файла не соответствует заявленному формату изображения",
        code: "MAGIC_MISMATCH",
      };
    }
  } else {
    if (!VIDEO_MIMES.has(rawMime)) {
      return {
        ok: false,
        message: "Расрешены только видео: MP4, WebM, QuickTime (MOV)",
        code: "INVALID_TYPE",
      };
    }
    if (!validateVideoMagic(rawMime, buffer)) {
      return {
        ok: false,
        message: "Содержимое файла не похоже на поддерживаемый видеоконтейнер",
        code: "MAGIC_MISMATCH",
      };
    }
  }

  const nameLower = (fileName || "").toLowerCase();
  if (nameLower.endsWith(".php") || nameLower.endsWith(".exe") || nameLower.endsWith(".sh")) {
    return { ok: false, message: "Недопустимое расширение файла", code: "UNSAFE" };
  }

  return { ok: true, mime: rawMime, maxBytes: limits.maxBytes };
}

const MAX_KLING_MOTION_REF_BYTES = 10 * 1024 * 1024;
const MAX_KLING_MOTION_VIDEO_BYTES = 100 * 1024 * 1024;

/** Макс. длительность motion video для Kling Motion Control (сек), см. подсказки в UI. */
export const MAX_KLING_MOTION_VIDEO_DURATION_SECONDS = 30;

const KLING_MOTION_VIDEO_MIMES = new Set(["video/mp4", "video/quicktime"]);

/**
 * Kling 3.0 Motion Control — только JPEG/PNG, до 10 МБ, проверка сигнатур.
 */
export function validateKlingMotionReferenceImageBuffer(
  fileName: string,
  clientMime: string,
  size: number,
  buffer: Buffer,
): UploadValidationError | UploadValidationOk {
  const rawMime = clientMime?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!rawMime) {
    return { ok: false, message: "Укажите корректный Content-Type", code: "INVALID_TYPE" };
  }
  const effective =
    rawMime === "image/jpg" || rawMime === "image/pjpeg" ? "image/jpeg" : rawMime;
  if (effective !== "image/jpeg" && effective !== "image/png") {
    return {
      ok: false,
      message: "Reference image: допустимы JPEG или PNG (до 10 МБ)",
      code: "INVALID_TYPE",
    };
  }
  if (size > MAX_KLING_MOTION_REF_BYTES) {
    return {
      ok: false,
      message: "Reference image: максимум 10 МБ",
      code: "FILE_TOO_LARGE",
    };
  }
  if (size < 16) {
    return { ok: false, message: "Файл пустой или слишком короткий", code: "INVALID_TYPE" };
  }
  if (effective === "image/jpeg") {
    if (!looksLikeJpeg(buffer)) {
      return {
        ok: false,
        message: "Содержимое не похоже на JPEG",
        code: "MAGIC_MISMATCH",
      };
    }
  } else if (!looksLikePng(buffer)) {
    return {
      ok: false,
      message: "Содержимое не похоже на PNG",
      code: "MAGIC_MISMATCH",
    };
  }
  const nameLower = (fileName || "").toLowerCase();
  if (nameLower.endsWith(".php") || nameLower.endsWith(".exe") || nameLower.endsWith(".sh")) {
    return { ok: false, message: "Недопустимое расширение файла", code: "UNSAFE" };
  }
  return { ok: true, mime: effective, maxBytes: MAX_KLING_MOTION_REF_BYTES };
}

/**
 * Kling 3.0 Motion Control — MP4/QuickTime, до 100 МБ.
 */
export function validateKlingMotionVideoBuffer(
  fileName: string,
  clientMime: string,
  size: number,
  buffer: Buffer,
): UploadValidationError | UploadValidationOk {
  const rawMime = clientMime?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!KLING_MOTION_VIDEO_MIMES.has(rawMime)) {
    return {
      ok: false,
      message: "Motion video: допустимы MP4 и QuickTime (MOV), до 100 МБ",
      code: "INVALID_TYPE",
    };
  }
  if (size > MAX_KLING_MOTION_VIDEO_BYTES) {
    return {
      ok: false,
      message: "Motion video: максимум 100 МБ",
      code: "FILE_TOO_LARGE",
    };
  }
  if (size < 32) {
    return { ok: false, message: "Файл пустой или слишком короткий", code: "INVALID_TYPE" };
  }
  if (!validateVideoMagic(rawMime, buffer)) {
    return {
      ok: false,
      message: "Содержимое не похоже на MP4/MOV",
      code: "MAGIC_MISMATCH",
    };
  }
  const nameLower = (fileName || "").toLowerCase();
  if (nameLower.endsWith(".php") || nameLower.endsWith(".exe") || nameLower.endsWith(".sh")) {
    return { ok: false, message: "Недопустимое расширение файла", code: "UNSAFE" };
  }
  return { ok: true, mime: rawMime, maxBytes: MAX_KLING_MOTION_VIDEO_BYTES };
}

const MAX_PRODUCT_CARD_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Исходник «карточка товара»: JPEG, PNG, WebP, до 10 МБ.
 */
export function validateProductCardSourceImageBuffer(
  fileName: string,
  clientMime: string,
  size: number,
  buffer: Buffer,
): UploadValidationError | UploadValidationOk {
  const rawMime = clientMime?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!rawMime) {
    return { ok: false, message: "Укажите корректный Content-Type", code: "INVALID_TYPE" };
  }
  const effective =
    rawMime === "image/jpg" || rawMime === "image/pjpeg" ? "image/jpeg" : rawMime;
  if (effective !== "image/jpeg" && effective !== "image/png" && effective !== "image/webp") {
    return {
      ok: false,
      message: "Для карточки товара: JPEG, PNG или WebP (до 10 МБ)",
      code: "INVALID_TYPE",
    };
  }
  if (size > MAX_PRODUCT_CARD_IMAGE_BYTES) {
    return {
      ok: false,
      message: "Изображение: максимум 10 МБ",
      code: "FILE_TOO_LARGE",
    };
  }
  if (size < 16) {
    return { ok: false, message: "Файл пустой или слишком короткий", code: "INVALID_TYPE" };
  }
  if (effective === "image/jpeg") {
    if (!looksLikeJpeg(buffer)) {
      return {
        ok: false,
        message: "Содержимое не похоже на JPEG",
        code: "MAGIC_MISMATCH",
      };
    }
  } else if (effective === "image/png") {
    if (!looksLikePng(buffer)) {
      return {
        ok: false,
        message: "Содержимое не похоже на PNG",
        code: "MAGIC_MISMATCH",
      };
    }
  } else if (!looksLikeWebp(buffer)) {
    return {
      ok: false,
      message: "Содержимое не похоже на WebP",
      code: "MAGIC_MISMATCH",
    };
  }
  const nameLower = (fileName || "").toLowerCase();
  if (nameLower.endsWith(".php") || nameLower.endsWith(".exe") || nameLower.endsWith(".sh")) {
    return { ok: false, message: "Недопустимое расширение файла", code: "UNSAFE" };
  }
  return { ok: true, mime: effective, maxBytes: MAX_PRODUCT_CARD_IMAGE_BYTES };
}

const MAX_SEEDANCE_AUDIO_BYTES = 15 * 1024 * 1024;

const SEEDANCE_AUDIO_MIMES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
]);

/**
 * Референс-аудио для Seedance (Kie): распространённые MIME, до 50 МБ.
 */
export function validateSeedanceReferenceAudioBuffer(
  fileName: string,
  clientMime: string,
  size: number,
  _buffer: Buffer,
): UploadValidationError | UploadValidationOk {
  const rawMime = clientMime?.split(";")[0]?.trim().toLowerCase() ?? "";
  const effective =
    rawMime === "audio/mp3" || rawMime === "audio/x-mpeg"
      ? "audio/mpeg"
      : rawMime;
  if (!effective || !SEEDANCE_AUDIO_MIMES.has(effective)) {
    return {
      ok: false,
      message:
        "Аудио: допустимы MP3, WAV, M4A, AAC, OGG (тип audio/* из списка), до 15 МБ",
      code: "INVALID_TYPE",
    };
  }
  if (size > MAX_SEEDANCE_AUDIO_BYTES) {
    return {
      ok: false,
      message: "Аудио: максимум 15 МБ",
      code: "FILE_TOO_LARGE",
    };
  }
  if (size < 32) {
    return { ok: false, message: "Файл пустой или слишком короткий", code: "INVALID_TYPE" };
  }
  const nameLower = (fileName || "").toLowerCase();
  if (nameLower.endsWith(".php") || nameLower.endsWith(".exe") || nameLower.endsWith(".sh")) {
    return { ok: false, message: "Недопустимое расширение файла", code: "UNSAFE" };
  }
  return { ok: true, mime: effective, maxBytes: MAX_SEEDANCE_AUDIO_BYTES };
}
