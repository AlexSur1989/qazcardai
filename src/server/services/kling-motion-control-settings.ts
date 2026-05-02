
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
    return { ok: false, message: `РЈРєР°Р¶РёС‚Рµ ${label} (РѕРґРёРЅ URL).` };
  }
  const urls = value
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
  if (urls.length !== 1) {
    return {
      ok: false,
      message: `РќСѓР¶РµРЅ СЂРѕРІРЅРѕ РѕРґРёРЅ URL РІ ${label}.`,
    };
  }
  if (!/^https?:\/\//i.test(urls[0])) {
    return {
      ok: false,
      message: `${label}: СѓРєР°Р¶РёС‚Рµ РїСѓР±Р»РёС‡РЅС‹Р№ http(s) URL.`,
    };
  }
  return { ok: true, url: urls[0] };
}

function resolutionOk(mode: string): boolean {
  return mode === "720p" || mode === "1080p";
}

/**
 * Estimate / РїСЂРµРІСЊСЋ: Р±РµР· РѕР±СЏР·Р°С‚РµР»СЊРЅС‹С… URL; РїСЂРѕРІРµСЂСЏРµРј resolution/mode Рё РїРѕР»СЏ СЃС†РµРЅР°СЂРёСЏ.
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
    return { ok: false, message: "РќРµРєРѕСЂСЂРµРєС‚РЅРѕРµ СЂР°Р·СЂРµС€РµРЅРёРµ: РґРѕРїСѓСЃС‚РёРјС‹ 720p Рё 1080p." };
  }
  const co = String(settings.characterOrientation ?? "image").trim();
  if (co !== "image") {
    return {
      ok: false,
      message: "РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ РѕСЂРёРµРЅС‚Р°С†РёСЏ: РґРѕРїСѓСЃС‚РёРјРѕ С‚РѕР»СЊРєРѕ image.",
    };
  }
  const bg = String(settings.backgroundSource ?? "input_video").trim();
  if (bg !== "input_video" && bg !== "input_image") {
    return {
      ok: false,
      message:
        "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ backgroundSource: РґРѕРїСѓСЃС‚РёРјС‹ input_video Рё input_image.",
    };
  }
  return { ok: true };
}

/**
 * РџРѕР»РЅР°СЏ РїСЂРѕРІРµСЂРєР° РїРµСЂРµРґ СЃРѕР·РґР°РЅРёРµРј Generation.
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
 * URL РґРѕР»Р¶РЅС‹ СЃРѕРѕС‚РІРµС‚СЃС‚РІРѕРІР°С‚СЊ Р·Р°РїРёСЃСЏРј UploadedFile С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (Р·Р°РіСЂСѓР·РєР° РІ S3).
 */
export async function assertKlingMotionUrlsOwnedByUser(
  userId: string,
  inputUrls: string[],
  videoUrls: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (inputUrls.length !== 1 || videoUrls.length !== 1) {
    return { ok: false, message: "РќСѓР¶РµРЅ СЂРѕРІРЅРѕ РѕРґРёРЅ reference image Рё РѕРґРЅРѕ motion video." };
  }
  const a = inputUrls[0].trim();
  const b = videoUrls[0].trim();
  if (!a || !b) {
    return { ok: false, message: "РќСѓР¶РµРЅ СЂРѕРІРЅРѕ РѕРґРёРЅ reference image Рё РѕРґРЅРѕ motion video." };
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
        "Reference image: Р·Р°РіСЂСѓР·РёС‚Рµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РєРЅРѕРїРєРѕР№ В«Reference imageВ» (РёР»Рё СѓРєР°Р¶РёС‚Рµ URL СЃРІРѕРµРіРѕ СЂР°РЅРµРµ Р·Р°РіСЂСѓР¶РµРЅРЅРѕРіРѕ С„Р°Р№Р»Р°).",
    };
  }
  if (!set.has(b)) {
    return {
      ok: false,
      message:
        "Motion video: Р·Р°РіСЂСѓР·РёС‚Рµ РІРёРґРµРѕ РєРЅРѕРїРєРѕР№ В«Motion videoВ» (РёР»Рё СѓРєР°Р¶РёС‚Рµ URL СЃРІРѕРµРіРѕ СЂР°РЅРµРµ Р·Р°РіСЂСѓР¶РµРЅРЅРѕРіРѕ С„Р°Р№Р»Р°).",
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
 * Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ РґР»СЏ С‚Р°СЂРёС„РёРєР°С†РёРё: РїСЂРµРґРїРѕС‡РёС‚Р°РµРј UploadedFile.metadata.durationSeconds,
 * РёРЅР°С‡Рµ settings.videoDurationSeconds.
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
      return { ok: false, message: "Р¤Р°Р№Р» motion video РЅРµ РЅР°Р№РґРµРЅ." };
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
        message: "motionVideoFileId РЅРµ СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓРµС‚ URL Р·Р°РіСЂСѓР¶РµРЅРЅРѕРіРѕ РІРёРґРµРѕ.",
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
        "РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РґР»РёС‚РµР»СЊРЅРѕСЃС‚СЊ РІРёРґРµРѕ. Р—Р°РіСЂСѓР·РёС‚Рµ РІРёРґРµРѕ Р·Р°РЅРѕРІРѕ.",
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
 * РќРѕСЂРјР°Р»РёР·Р°С†РёСЏ РїРѕР»РµР№ РґР»СЏ Kie: РІ input.mode СѓС…РѕРґРёС‚ СЂР°Р·СЂРµС€РµРЅРёРµ (720p / 1080p).
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
