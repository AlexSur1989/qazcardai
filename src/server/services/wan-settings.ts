/** Wan 2.x (Kie Market: wan/2-7-*, wan/2-6-*). */

export function isWanMarketModel(apiModelId: string): boolean {
  const t = apiModelId.toLowerCase();
  return t.startsWith("wan/2-7-") || t.startsWith("wan/2-6-");
}

/** @deprecated используйте isWanMarketModel */
export function isWan27MarketModel(apiModelId: string): boolean {
  return isWanMarketModel(apiModelId);
}

/** Длительность 0 или 2–10 с (Wan Video Edit и Wan 2.6 video-to-video). */
export function isWanVideoEditDurationModel(apiModelId: string): boolean {
  const id = apiModelId.toLowerCase();
  return id === "wan/2-7-videoedit" || id === "wan/2-6-video-to-video";
}

function stringUrls(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function nonemptyUrl(s: unknown): boolean {
  return typeof s === "string" && s.trim() !== "";
}

function firstUrl(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    const first = v.find((x): x is string => typeof x === "string" && x.trim() !== "");
    return first?.trim() ?? "";
  }
  return "";
}

function numberInRange(
  value: unknown,
  min: number,
  max: number,
  allowZero = false,
): boolean {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n)) return false;
  if (allowZero && n === 0) return true;
  return n >= min && n <= max;
}

function enumValue(value: unknown, allowed: readonly string[]): boolean {
  return allowed.includes(String(value ?? "").trim());
}

const RESOLUTIONS = ["720p", "1080p"] as const;
const ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4"] as const;

export function validateWan27ModelScenario(
  apiModelId: string,
  normalizedSettings: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  if (!isWanMarketModel(apiModelId)) return { ok: true };

  const id = apiModelId.toLowerCase();

  if (id.startsWith("wan/2-7-")) {
    if (!enumValue(normalizedSettings.resolution, RESOLUTIONS)) {
      return { ok: false, message: "Wan 2.7: выберите разрешение 720p или 1080p." };
    }
    const seed = normalizedSettings.seed;
    if (seed !== undefined && seed !== null && seed !== "") {
      const n = typeof seed === "number" ? seed : Number(seed);
      if (!Number.isInteger(n) || n < 0 || n > 2147483647) {
        return { ok: false, message: "Wan 2.7: seed должен быть целым числом 0..2147483647." };
      }
    }
  }

  if (id === "wan/2-7-image-to-video" || id === "wan/2-6-image-to-video") {
    const firstFrame = firstUrl(normalizedSettings.firstFrameUrl) !== "";
    const firstClip = firstUrl(normalizedSettings.firstClipUrl) !== "";
    const lastFrame = firstUrl(normalizedSettings.lastFrameUrl) !== "";

    if (lastFrame && !firstFrame) {
      return {
        ok: false,
        message:
          "Wan Image→Video: укажите URL первого кадра (first frame) вместе с последним при необходимости.",
      };
    }

    if (!firstFrame && !firstClip) {
      return {
        ok: false,
        message:
          "Wan Image→Video: укажите URL первого кадра (или first clip для продолжения ролика).",
      };
    }

    if (firstClip && (firstFrame || lastFrame)) {
      return {
        ok: false,
        message:
          "Wan Image→Video: first_clip_url используется отдельно от first_frame_url/last_frame_url.",
      };
    }
    if (!numberInRange(normalizedSettings.duration, 2, 15)) {
      return { ok: false, message: "Wan Image→Video: длительность должна быть 2..15 секунд." };
    }
    return { ok: true };
  }

  if (id === "wan/2-7-r2v") {
    const imgs = [
      ...stringUrls(normalizedSettings.referenceImageUrls),
      ...stringUrls(normalizedSettings.referenceImage),
    ];
    const vids = [
      ...stringUrls(normalizedSettings.referenceVideoUrls),
      ...stringUrls(normalizedSettings.referenceVideo),
    ];
    if (imgs.length === 0 && vids.length === 0) {
      return {
        ok: false,
        message:
          "Wan Reference→Video: укажите хотя бы один reference image или reference video URL.",
      };
    }
    if (imgs.length + vids.length > 5) {
      return {
        ok: false,
        message:
          "Wan Reference→Video: не более 5 ссылок (изображения и видео вместе).",
      };
    }
    if (!enumValue(normalizedSettings.aspectRatio, ASPECTS)) {
      return { ok: false, message: "Wan Reference→Video: выберите допустимый aspect_ratio." };
    }
    if (!numberInRange(normalizedSettings.duration, 2, 10)) {
      return { ok: false, message: "Wan Reference→Video: длительность должна быть 2..10 секунд." };
    }
    return { ok: true };
  }

  if (id === "wan/2-7-videoedit" || id === "wan/2-6-video-to-video") {
    if (!nonemptyUrl(normalizedSettings.videoUrl) && firstUrl(normalizedSettings.videoUrl) === "") {
      return {
        ok: false,
        message: "Wan Video→Video / Video Edit: укажите URL исходного видео.",
      };
    }
    if (!numberInRange(normalizedSettings.duration, 2, 10, true)) {
      return {
        ok: false,
        message: "Wan Video Edit: длительность должна быть 0 или 2..10 секунд.",
      };
    }
    const aspect = String(normalizedSettings.aspectRatio ?? "").trim();
    if (aspect !== "" && !enumValue(aspect, ASPECTS)) {
      return { ok: false, message: "Wan Video Edit: выберите допустимый aspect_ratio." };
    }
    if (!enumValue(normalizedSettings.audioSetting, ["auto", "origin"])) {
      return { ok: false, message: "Wan Video Edit: audio_setting должен быть auto или origin." };
    }
    return { ok: true };
  }

  if (id === "wan/2-7-text-to-video") {
    if (!enumValue(normalizedSettings.ratio, ASPECTS)) {
      return { ok: false, message: "Wan Text→Video: выберите допустимый ratio." };
    }
    if (!numberInRange(normalizedSettings.duration, 2, 15)) {
      return { ok: false, message: "Wan Text→Video: длительность должна быть 2..15 секунд." };
    }
    return { ok: true };
  }

  return { ok: true };
}

/** URL из настроек для модерации / лимитов вложений. */
export function collectWan27SettingsHttpUrls(
  apiModelId: string,
  normalizedSettings: Record<string, unknown>,
): string[] {
  if (!isWanMarketModel(apiModelId)) return [];

  const out: string[] = [];
  const push = (s: unknown) => {
    if (typeof s === "string" && s.trim()) out.push(s.trim());
  };

  push(firstUrl(normalizedSettings.firstFrameUrl));
  push(firstUrl(normalizedSettings.firstFrame));
  push(firstUrl(normalizedSettings.lastFrameUrl));
  push(firstUrl(normalizedSettings.firstClipUrl));
  push(firstUrl(normalizedSettings.drivingAudioUrl));
  push(firstUrl(normalizedSettings.audioUrl));
  push(firstUrl(normalizedSettings.referenceVoiceUrl));
  push(firstUrl(normalizedSettings.referenceVoice));
  push(firstUrl(normalizedSettings.videoUrl));
  push(firstUrl(normalizedSettings.referenceImageUrl));
  push(firstUrl(normalizedSettings.referenceImage));

  for (const u of stringUrls(normalizedSettings.referenceImageUrls)) {
    out.push(u);
  }
  for (const u of stringUrls(normalizedSettings.referenceImage)) {
    out.push(u);
  }
  for (const u of stringUrls(normalizedSettings.referenceVideoUrls)) {
    out.push(u);
  }
  for (const u of stringUrls(normalizedSettings.referenceVideo)) {
    out.push(u);
  }

  return out;
}
