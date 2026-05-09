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

export function validateWan27ModelScenario(
  apiModelId: string,
  normalizedSettings: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  if (!isWanMarketModel(apiModelId)) return { ok: true };

  const id = apiModelId.toLowerCase();

  if (id === "wan/2-7-image-to-video" || id === "wan/2-6-image-to-video") {
    const firstFrame = nonemptyUrl(normalizedSettings.firstFrameUrl);
    const firstClip = nonemptyUrl(normalizedSettings.firstClipUrl);
    const lastFrame = nonemptyUrl(normalizedSettings.lastFrameUrl);

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

    return { ok: true };
  }

  if (id === "wan/2-7-r2v") {
    const imgs = stringUrls(normalizedSettings.referenceImageUrls);
    const vids = stringUrls(normalizedSettings.referenceVideoUrls);
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
    return { ok: true };
  }

  if (id === "wan/2-7-videoedit" || id === "wan/2-6-video-to-video") {
    if (!nonemptyUrl(normalizedSettings.videoUrl)) {
      return {
        ok: false,
        message: "Wan Video→Video / Video Edit: укажите URL исходного видео.",
      };
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

  push(normalizedSettings.firstFrameUrl);
  push(normalizedSettings.firstFrame);
  push(normalizedSettings.lastFrameUrl);
  push(normalizedSettings.firstClipUrl);
  if (nonemptyUrl(normalizedSettings.drivingAudioUrl)) {
    push(normalizedSettings.drivingAudioUrl);
  } else {
    push(normalizedSettings.audioUrl);
  }
  push(normalizedSettings.referenceVoiceUrl);
  push(normalizedSettings.videoUrl);
  push(normalizedSettings.referenceImageUrl);

  for (const u of stringUrls(normalizedSettings.referenceImageUrls)) {
    out.push(u);
  }
  for (const u of stringUrls(normalizedSettings.referenceVideoUrls)) {
    out.push(u);
  }

  return out;
}
