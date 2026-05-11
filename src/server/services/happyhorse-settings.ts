/** Валидация и сбор URL для HappyHorse-1.0 (отдельные AiModel на режим Kie). */

const RESOLUTIONS = new Set(["720p", "1080p"]);
const ASPECT = new Set(["16:9", "9:16", "1:1", "4:3", "3:4"]);
const AUDIO = new Set(["auto", "origin"]);

const MODEL = {
  TEXT: "happyhorse/text-to-video",
  IMAGE: "happyhorse/image-to-video",
  REFERENCE: "happyhorse/reference-to-video",
  EDIT: "happyhorse/video-edit",
} as const;

export function isHappyHorseModel(apiModelId: string | null | undefined): boolean {
  return String(apiModelId ?? "").trim().toLowerCase().startsWith("happyhorse/");
}

function stringUrlsStrict(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
}

function stringUrlsRejectNonStrings(value: unknown, fieldLabel: string): string[] | { ok: false; message: string } {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const x of value) {
    if (typeof x !== "string" || x.trim() === "") {
      return {
        ok: false,
        message: `${fieldLabel}: укажите загруженные URL (непустые строки).`,
      };
    }
    out.push(x.trim());
  }
  return out;
}

function validateResolution(settings: Record<string, unknown>): { ok: true } | { ok: false; message: string } {
  const r = String(settings.resolution ?? "").trim();
  if (!RESOLUTIONS.has(r)) {
    return { ok: false, message: "Выберите разрешение 720p или 1080p." };
  }
  return { ok: true };
}

function validateSeed(settings: Record<string, unknown>): { ok: true } | { ok: false; message: string } {
  const raw = settings.seed;
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true };
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || Math.floor(n) !== n) {
    return { ok: false, message: "Seed: укажите целое число." };
  }
  const iv = Math.floor(n);
  if (iv < 0 || iv > 2147483647) {
    return { ok: false, message: "Seed: допустимо от 0 до 2147483647." };
  }
  return { ok: true };
}

function validateDuration(settings: Record<string, unknown>): { ok: true } | { ok: false; message: string } {
  const raw = settings.duration;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return { ok: false, message: "Укажите длительность (сек)." };
  }
  const iv = Math.floor(n);
  if (iv < 3 || iv > 15) {
    return {
      ok: false,
      message: "Длительность должна быть от 3 до 15 секунд.",
    };
  }
  return { ok: true };
}

function validateAspect(settings: Record<string, unknown>): { ok: true } | { ok: false; message: string } {
  const a = String(settings.aspectRatio ?? "").trim();
  if (!ASPECT.has(a)) {
    return { ok: false, message: "Выберите поддерживаемый формат кадра." };
  }
  return { ok: true };
}

/**
 * Проверки до резерва кредитов (дополнение к общему strict payloadMapping-build).
 */
export function validateHappyHorseSettings(
  apiModelId: string,
  settings: Record<string, unknown>,
  promptTrimmed: string,
): { ok: true } | { ok: false; message: string } {
  const id = apiModelId.trim();
  if (!id.startsWith("happyhorse/")) {
    return { ok: true };
  }

  if (!promptTrimmed) {
    return { ok: false, message: "Введите промпт." };
  }

  let res = validateResolution(settings);
  if (!res.ok) return res;
  res = validateSeed(settings);
  if (!res.ok) return res;

  switch (id) {
    case MODEL.TEXT: {
      const d = validateDuration(settings);
      if (!d.ok) return d;
      return validateAspect(settings);
    }
    case MODEL.IMAGE: {
      const checked = stringUrlsRejectNonStrings(settings.imageUrls, "Изображение");
      if (typeof checked === "object" && "ok" in checked) {
        return checked;
      }
      const imgs = checked;
      if (imgs.length !== 1) {
        return {
          ok: false,
          message: "Загрузите ровно одно исходное изображение.",
        };
      }
      return validateDuration(settings);
    }
    case MODEL.REFERENCE: {
      const checked = stringUrlsRejectNonStrings(settings.referenceImage, "Референсы");
      if (typeof checked === "object" && "ok" in checked) {
        return checked;
      }
      const refs = checked;
      if (refs.length < 1 || refs.length > 5) {
        return {
          ok: false,
          message: "Нужно от 1 до 5 референс-изображений.",
        };
      }
      const d = validateDuration(settings);
      if (!d.ok) return d;
      return validateAspect(settings);
    }
    case MODEL.EDIT: {
      const vcheck = stringUrlsRejectNonStrings(settings.videoUrl, "Видео");
      if (typeof vcheck === "object" && "ok" in vcheck) {
        return vcheck;
      }
      const vu = vcheck;
      if (vu.length !== 1) {
        return {
          ok: false,
          message: "Загрузите ровно одно исходное видео.",
        };
      }
      const audio = String(settings.audioSetting ?? "").trim().toLowerCase();
      const as =
        audio === "origin" ? "origin" : audio === "auto" ? "auto" : "";
      if (!AUDIO.has(as)) {
        return {
          ok: false,
          message: "Выберите режим аудио: Auto или Original.",
        };
      }
      if (settings.referenceImage != null) {
        const rcheck = stringUrlsRejectNonStrings(
          settings.referenceImage,
          "Референсы",
        );
        if (typeof rcheck === "object" && "ok" in rcheck) {
          return rcheck;
        }
        const refs = rcheck;
        if (refs.length > 5) {
          return {
            ok: false,
            message: "Не более 5 референс-изображений.",
          };
        }
      }
      return { ok: true };
    }
    default:
      return { ok: false, message: "Неизвестная модель HappyHorse." };
  }
}

/** Публичные http(s) URL из загрузочных полей (вложение / Kie). */
export function collectHappyHorseSettingsHttpUrls(
  apiModelId: string,
  settings: Record<string, unknown>,
): string[] {
  const id = apiModelId.trim().toLowerCase();
  if (id === MODEL.IMAGE.toLowerCase()) {
    return stringUrlsStrict(settings.imageUrls);
  }
  if (id === MODEL.REFERENCE.toLowerCase()) {
    return stringUrlsStrict(settings.referenceImage);
  }
  if (id === MODEL.EDIT.toLowerCase()) {
    const v = stringUrlsStrict(settings.videoUrl);
    const r = stringUrlsStrict(settings.referenceImage);
    return [...v, ...r];
  }
  return [];
}
