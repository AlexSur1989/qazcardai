/**
 * Валидация и нормализация настроек Gemini Omni (Kie docs 2026-05-23).
 * Video: docs.kie.ai/market/gemini-omni-video
 * Audio: docs.kie.ai/market/gemini-omni-audio
 * Character: docs.kie.ai/market/gemini-omni-character
 */

export const GEMINI_OMNI_VIDEO_API_ID = "gemini-omni-video";
export const GEMINI_OMNI_AUDIO_API_ID = "gemini-omni-audio";
export const GEMINI_OMNI_CHARACTER_API_ID = "gemini-omni-character";

export const GEMINI_OMNI_QUOTA_MAX = 7;

export type GeminiOmniVideoListItem = {
  url: string;
  start: number;
  ends: number;
};

const DURATION_VALUES = new Set(["4", "6", "8", "10"]);
const ASPECT_VALUES = new Set(["16:9", "9:16"]);
const RESOLUTION_VALUES = new Set(["720p", "1080p", "4k"]);

const AUDIO_VOICE_IDS = new Set([
  "achernar",
  "achird",
  "algenib",
  "algieba",
  "alnilam",
  "aoede",
  "autonoe",
  "callirrhoe",
  "charon",
  "despina",
  "enceladus",
  "erinome",
  "fenrir",
  "gacrux",
  "iapetus",
  "kore",
  "laomedeia",
  "leda",
  "orus",
  "puck",
  "pulcherrima",
  "rasalgethi",
  "sadachbia",
  "sadaltager",
  "schedar",
  "sulafat",
  "umbriel",
  "vindemiatrix",
  "zephyr",
  "zubenelgenubi",
]);

type ValidationResult = { ok: true } | { ok: false; message: string };

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseGeminiOmniVideoList(
  raw: unknown,
): GeminiOmniVideoListItem[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      parsed = JSON.parse(t) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out: GeminiOmniVideoListItem[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const url = typeof rec.url === "string" ? rec.url.trim() : "";
    const startRaw = rec.start;
    const endsRaw = rec.ends;
    const start =
      typeof startRaw === "number" && Number.isFinite(startRaw)
        ? startRaw
        : Number(startRaw);
    const ends =
      typeof endsRaw === "number" && Number.isFinite(endsRaw)
        ? endsRaw
        : Number(endsRaw);
    if (!url || !Number.isFinite(start) || !Number.isFinite(ends)) continue;
    out.push({ url, start, ends });
  }
  return out;
}

export function geminiOmniQuotaUsed(settings: Record<string, unknown>): number {
  const images = stringList(settings.imageUrls).length;
  const videos = parseGeminiOmniVideoList(settings.videoList).length;
  const characters = stringList(settings.characterIds).length;
  return images + videos * 2 + characters;
}

function validateVideoListItems(
  items: GeminiOmniVideoListItem[],
): ValidationResult {
  if (items.length > 1) {
    return {
      ok: false,
      message: "Gemini Omni Video: допускается не более 1 видео в video_list",
    };
  }
  for (const item of items) {
    if (item.ends <= item.start) {
      return {
        ok: false,
        message:
          "Gemini Omni Video: ends должно быть больше start в video_list",
      };
    }
    if (item.ends - item.start > 10) {
      return {
        ok: false,
        message:
          "Gemini Omni Video: разница ends − start в video_list не более 10 секунд",
      };
    }
  }
  return { ok: true };
}

export function validateGeminiOmniVideoSettings(
  modelId: string,
  settings: Record<string, unknown>,
): ValidationResult {
  if (modelId !== GEMINI_OMNI_VIDEO_API_ID) return { ok: true };

  const duration = String(settings.duration ?? "").trim();
  if (!DURATION_VALUES.has(duration)) {
    return {
      ok: false,
      message: "Gemini Omni Video: выберите длительность 4, 6, 8 или 10 секунд",
    };
  }

  const aspect = String(settings.aspectRatio ?? "").trim();
  if (aspect && !ASPECT_VALUES.has(aspect)) {
    return {
      ok: false,
      message: "Gemini Omni Video: формат 16:9 или 9:16",
    };
  }

  const resolution = String(settings.resolution ?? "720p").trim();
  if (!RESOLUTION_VALUES.has(resolution)) {
    return {
      ok: false,
      message: "Gemini Omni Video: разрешение 720p, 1080p или 4k",
    };
  }

  const images = stringList(settings.imageUrls);
  if (images.length > 7) {
    return {
      ok: false,
      message: "Gemini Omni Video: не более 7 изображений",
    };
  }

  const audioIds = stringList(settings.audioIds);
  if (audioIds.length > 3) {
    return {
      ok: false,
      message: "Gemini Omni Video: не более 3 audio_ids",
    };
  }

  const characterIds = stringList(settings.characterIds);
  if (characterIds.length > 3) {
    return {
      ok: false,
      message: "Gemini Omni Video: не более 3 character_ids",
    };
  }

  const videoList = parseGeminiOmniVideoList(settings.videoList);
  const listCheck = validateVideoListItems(videoList);
  if (!listCheck.ok) return listCheck;

  const quota = geminiOmniQuotaUsed(settings);
  if (quota > GEMINI_OMNI_QUOTA_MAX) {
    return {
      ok: false,
      message: `Gemini Omni Video: квота ${quota}/7 превышает лимит (изображения×1 + видео×2 + character_ids×1 ≤ 7)`,
    };
  }

  if (typeof settings.seed !== "undefined" && settings.seed !== null) {
    const seed =
      typeof settings.seed === "number"
        ? settings.seed
        : Number(settings.seed);
    if (!Number.isInteger(seed) || seed < 0 || seed > 2147483647) {
      return {
        ok: false,
        message: "Gemini Omni Video: seed от 0 до 2147483647",
      };
    }
  }

  return { ok: true };
}

export function validateGeminiOmniAudioSettings(
  modelId: string,
  settings: Record<string, unknown>,
): ValidationResult {
  if (modelId !== GEMINI_OMNI_AUDIO_API_ID) return { ok: true };

  const audioId = String(settings.audioId ?? "").trim();
  if (!AUDIO_VOICE_IDS.has(audioId)) {
    return {
      ok: false,
      message: "Gemini Omni Audio: выберите голос (audio_id) из списка Kie",
    };
  }

  const name = String(settings.name ?? "").trim();
  if (!name) {
    return { ok: false, message: "Gemini Omni Audio: укажите имя голоса" };
  }
  if (name.length > 210) {
    return {
      ok: false,
      message: "Gemini Omni Audio: имя не длиннее 210 символов",
    };
  }

  const voiceDescription = String(settings.voiceDescription ?? "").trim();
  if (voiceDescription.length > 20000) {
    return {
      ok: false,
      message: "Gemini Omni Audio: описание голоса не длиннее 20000 символов",
    };
  }

  const exampleDialogue = String(settings.exampleDialogue ?? "").trim();
  if (exampleDialogue.length > 120) {
    return {
      ok: false,
      message: "Gemini Omni Audio: пример диалога не длиннее 120 символов",
    };
  }

  return { ok: true };
}

export function validateGeminiOmniCharacterSettings(
  modelId: string,
  settings: Record<string, unknown>,
): ValidationResult {
  if (modelId !== GEMINI_OMNI_CHARACTER_API_ID) return { ok: true };

  const descriptions = String(settings.descriptions ?? "").trim();
  if (!descriptions) {
    return {
      ok: false,
      message: "Gemini Omni Character: укажите описание персонажа",
    };
  }

  const imageUrls = stringList(settings.imageUrls);
  if (imageUrls.length !== 1) {
    return {
      ok: false,
      message:
        "Gemini Omni Character: нужен ровно 1 референс-кадр (image_urls)",
    };
  }

  const audioIds = stringList(settings.audioIds);
  if (audioIds.length > 3) {
    return {
      ok: false,
      message: "Gemini Omni Character: не более 3 audio_ids",
    };
  }

  return { ok: true };
}

export function isGeminiOmniSyncModelId(apiModelId: string): boolean {
  const id = apiModelId.trim();
  return (
    id === GEMINI_OMNI_AUDIO_API_ID || id === GEMINI_OMNI_CHARACTER_API_ID
  );
}

export function isGeminiOmniVideoModelId(apiModelId: string): boolean {
  return apiModelId.trim() === GEMINI_OMNI_VIDEO_API_ID;
}
