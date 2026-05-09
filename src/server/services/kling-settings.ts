
export const KLING_30_API_MODEL_ID = "kling-3.0";

/** Kie market ids с тем же профилем, что KLING_30_API_MODEL_ID (payload + validation). */
export const KLING_30_MARKET_VARIANT_API_IDS = [
  KLING_30_API_MODEL_ID,
  "kling-3.0/video",
] as const;

const KLING_30_MARKET_ID_SET = new Set(
  KLING_30_MARKET_VARIANT_API_IDS.map((s) => s.toLowerCase()),
);

export function isKling30Model(
  apiModelId: string | null | undefined,
): boolean {
  return KLING_30_MARKET_ID_SET.has(String(apiModelId ?? "").trim().toLowerCase());
}

const KLING_26_MARKET_VARIANT_API_IDS = [
  "kling-2.6/text-to-video",
  "kling-2.6/image-to-video",
] as const;

const KLING_26_MARKET_ID_SET = new Set(
  KLING_26_MARKET_VARIANT_API_IDS.map((s) => s.toLowerCase()),
);

export function isKling26Model(
  apiModelId: string | null | undefined,
): boolean {
  return KLING_26_MARKET_ID_SET.has(String(apiModelId ?? "").trim().toLowerCase());
}

/** Kling 3.0 / 3.0 video / 2.6 — один контракт Kie createTask для buildKling30MarketCreateTaskPayload. */
export function isKling30StyleMarketModel(
  apiModelId: string | null | undefined,
): boolean {
  return isKling30Model(apiModelId) || isKling26Model(apiModelId);
}

/**
 * Kling 3.0: mode, duration, aspectRatio, sound, multiShots.
 * Multi-shot (MVP) — отключено до отдельного UI.
 */
export function validateKling30Settings(
  settings: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const modeRaw = settings.mode;
  const modeStr =
    typeof modeRaw === "string"
      ? modeRaw.trim()
      : String(modeRaw ?? "").trim();
  if (!modeStr) {
    return { ok: false, message: "Укажите режим (mode): std, pro или 4K." };
  }
  const lower = modeStr.toLowerCase();
  const is4k = lower === "4k" || modeStr === "4K";
  const isStd = lower === "std" || lower === "standard";
  const isPro = lower === "pro" || modeStr === "pro";
  if (!is4k && !isStd && !isPro) {
    return { ok: false, message: "Некорректный mode: допустимы std, pro, 4K." };
  }

  let durationStr = String(settings.duration ?? "").trim();
  if (!["5", "10", "15"].includes(durationStr)) {
    const n = Number(settings.duration);
    if (n === 5 || n === 10 || n === 15) {
      durationStr = String(n);
    } else {
      return {
        ok: false,
        message: "Некорректная длительность: допустимы 5, 10 или 15 секунд.",
      };
    }
  }

  const ar = String(settings.aspectRatio ?? "").trim();
  if (!["16:9", "9:16", "1:1"].includes(ar)) {
    return {
      ok: false,
      message:
        "Некорректное aspectRatio: допустимы 16:9, 9:16, 1:1.",
    };
  }

  if (settings.sound != null && typeof settings.sound !== "boolean") {
    return { ok: false, message: "Поле sound должно быть true или false." };
  }
  if (settings.multiShots != null && typeof settings.multiShots !== "boolean") {
    return {
      ok: false,
      message: "Поле multiShots должно быть true или false.",
    };
  }
  if (settings.multiShots === true) {
    return {
      ok: false,
      message: "Multi-shot mode is not implemented yet",
    };
  }
  return { ok: true };
}

/** Валидация Kling 3.0 + 2.6 (2.6 image-to-video — нужен хотя бы один image URL). */
export function validateKling30StyleSettings(
  apiModelId: string | null | undefined,
  settings: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const base = validateKling30Settings(settings);
  if (!base.ok) return base;

  const id = String(apiModelId ?? "").trim().toLowerCase();
  if (id === "kling-2.6/image-to-video") {
    const urls = Array.isArray(settings.imageUrls)
      ? settings.imageUrls.filter(
          (x): x is string => typeof x === "string" && x.trim() !== "",
        )
      : [];
    if (urls.length === 0) {
      return {
        ok: false,
        message:
          "Kling 2.6 Image→Video: укажите хотя бы один URL изображения (кадры в imageUrls).",
      };
    }
  }
  return { ok: true };
}
