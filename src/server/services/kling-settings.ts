import "server-only";

export const KLING_30_API_MODEL_ID = "kling-3.0";

export function isKling30Model(
  apiModelId: string | null | undefined,
): boolean {
  return String(apiModelId ?? "").trim() === KLING_30_API_MODEL_ID;
}

/**
 * Kling 3.0: mode, duration, aspectRatio, sound, multiShots.
 * Multi-shot (MVP) — запрещён до отдельного UI.
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
