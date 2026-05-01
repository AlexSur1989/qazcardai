import "server-only";

import { isRecord } from "@/lib/model-pricing-shared";
import { prisma } from "@/lib/prisma";

export const KLING_MOTION_CONTROL_API_MODEL_ID = "kling-3.0/motion-control";

export function isKlingMotionControlModel(
  apiModelId: string | null | undefined,
): boolean {
  return String(apiModelId ?? "").trim() === KLING_MOTION_CONTROL_API_MODEL_ID;
}

function singleHttpUrlList(
  value: unknown,
  label: string,
): { ok: true; url: string } | { ok: false; message: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, message: `Укажите ${label} (один URL).` };
  }
  const urls = value
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
  if (urls.length !== 1) {
    return {
      ok: false,
      message: `Нужен ровно один URL в ${label}.`,
    };
  }
  if (!/^https?:\/\//i.test(urls[0])) {
    return {
      ok: false,
      message: `${label}: укажите публичный http(s) URL.`,
    };
  }
  return { ok: true, url: urls[0] };
}

function resolutionOk(mode: string): boolean {
  return mode === "720p" || mode === "1080p";
}

/**
 * Estimate / превью: без обязательных URL; проверяем resolution/mode и поля сценария.
 */
export function validateKlingMotionControlSettingsForEstimate(
  settings: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const mode =
    typeof settings.resolution === "string" && settings.resolution.trim() !== ""
      ? settings.resolution.trim()
      : typeof settings.mode === "string" && settings.mode.trim() !== ""
        ? settings.mode.trim()
        : "720p";
  if (!resolutionOk(mode)) {
    return { ok: false, message: "Некорректное разрешение: допустимы 720p и 1080p." };
  }
  const co = String(settings.characterOrientation ?? "image").trim();
  if (co !== "image") {
    return {
      ok: false,
      message: "Некорректная ориентация: допустимо только image.",
    };
  }
  const bg = String(settings.backgroundSource ?? "input_video").trim();
  if (bg !== "input_video" && bg !== "input_image") {
    return {
      ok: false,
      message:
        "Некорректный backgroundSource: допустимы input_video и input_image.",
    };
  }
  return { ok: true };
}

/**
 * Полная проверка перед созданием Generation.
 */
export function validateKlingMotionControlSettings(
  settings: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const est = validateKlingMotionControlSettingsForEstimate(settings);
  if (!est.ok) {
    return est;
  }
  const inputRes = singleHttpUrlList(
    settings.inputUrls,
    "Reference image (inputUrls)",
  );
  if (!inputRes.ok) {
    return inputRes;
  }
  const videoRes = singleHttpUrlList(settings.videoUrls, "Motion video (videoUrls)");
  if (!videoRes.ok) {
    return videoRes;
  }
  return { ok: true };
}

/**
 * URL должны соответствовать записям UploadedFile текущего пользователя (загрузка в S3).
 */
export async function assertKlingMotionUrlsOwnedByUser(
  userId: string,
  inputUrls: string[],
  videoUrls: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (inputUrls.length !== 1 || videoUrls.length !== 1) {
    return { ok: false, message: "Нужен ровно один reference image и одно motion video." };
  }
  const a = inputUrls[0].trim();
  const b = videoUrls[0].trim();
  if (!a || !b) {
    return { ok: false, message: "Нужен ровно один reference image и одно motion video." };
  }
  const rows = await prisma.uploadedFile.findMany({
    where: { userId, url: { in: [a, b] } },
    select: { url: true },
  });
  const set = new Set(
    rows.map((r) => r.url).filter((u): u is string => typeof u === "string" && u.length > 0),
  );
  if (!set.has(a)) {
    return {
      ok: false,
      message:
        "Reference image: загрузите изображение кнопкой «Reference image» (или укажите URL своего ранее загруженного файла).",
    };
  }
  if (!set.has(b)) {
    return {
      ok: false,
      message:
        "Motion video: загрузите видео кнопкой «Motion video» (или укажите URL своего ранее загруженного файла).",
    };
  }
  return { ok: true };
}

export function collectKlingMotionControlHttpUrls(
  settings: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  for (const key of ["inputUrls", "videoUrls"] as const) {
    const arr = settings[key];
    if (!Array.isArray(arr)) continue;
    for (const x of arr) {
      if (typeof x === "string" && x.trim() !== "") out.push(x.trim());
    }
  }
  return out;
}

function durationFromMetadata(meta: unknown): number | null {
  if (!isRecord(meta)) return null;
  const d = meta.durationSeconds;
  if (typeof d !== "number" || !Number.isFinite(d) || d <= 0) return null;
  return d;
}

/**
 * Длительность для тарификации: предпочитаем UploadedFile.metadata.durationSeconds,
 * иначе settings.videoDurationSeconds.
 */
export async function resolveKlingMotionVideoDurationSeconds(
  userId: string,
  settings: Record<string, unknown>,
): Promise<
  | {
      ok: true;
      videoDurationSeconds: number;
      billingDurationSeconds: number;
    }
  | { ok: false; message: string }
> {
  const videoUrls = Array.isArray(settings.videoUrls)
    ? settings.videoUrls
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((s) => s.trim())
    : [];
  const motionVideoFileId =
    typeof settings.motionVideoFileId === "string"
      ? settings.motionVideoFileId.trim()
      : "";

  const clientDurRaw = settings.videoDurationSeconds;
  const clientDur =
    typeof clientDurRaw === "number" &&
    Number.isFinite(clientDurRaw) &&
    clientDurRaw > 0
      ? clientDurRaw
      : null;

  let fromMeta: number | null = null;
  let fileUrl: string | null = null;

  if (motionVideoFileId) {
    const row = await prisma.uploadedFile.findFirst({
      where: { id: motionVideoFileId, userId },
      select: { url: true, metadata: true },
    });
    if (!row) {
      return { ok: false, message: "Файл motion video не найден." };
    }
    fileUrl = row.url?.trim() ?? null;
    fromMeta = durationFromMetadata(row.metadata);
  } else if (videoUrls.length === 1) {
    const row = await prisma.uploadedFile.findFirst({
      where: { userId, url: videoUrls[0] },
      select: { metadata: true },
    });
    if (row) {
      fromMeta = durationFromMetadata(row.metadata);
    }
  }

  if (motionVideoFileId && fileUrl && videoUrls.length === 1) {
    if (videoUrls[0].trim() !== fileUrl) {
      return {
        ok: false,
        message: "motionVideoFileId не соответствует URL загруженного видео.",
      };
    }
  }

  let videoDurationSeconds: number | null = null;
  if (fromMeta != null) {
    videoDurationSeconds = fromMeta;
  } else if (clientDur != null) {
    videoDurationSeconds = clientDur;
  }

  if (videoDurationSeconds == null) {
    return {
      ok: false,
      message:
        "Не удалось определить длительность видео. Загрузите видео заново.",
    };
  }

  const billingDurationSeconds = Math.ceil(videoDurationSeconds);
  return {
    ok: true,
    videoDurationSeconds,
    billingDurationSeconds,
  };
}

/**
 * Нормализация полей для Kie: в input.mode уходит разрешение (720p / 1080p).
 */
export function normalizeKlingMotionControlSettingsForPricing(
  settings: Record<string, unknown>,
  videoDurationSeconds: number,
  billingDurationSeconds: number,
): Record<string, unknown> {
  const res =
    typeof settings.resolution === "string" && settings.resolution.trim() !== ""
      ? settings.resolution.trim()
      : typeof settings.mode === "string" && settings.mode.trim() !== ""
        ? settings.mode.trim()
        : "720p";
  const effective = res === "1080p" ? "1080p" : "720p";
  return {
    ...settings,
    resolution: effective,
    mode: effective,
    videoDurationSeconds,
    billingDurationSeconds,
  };
}
