
function hasNonEmptyUrl(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function hasNonEmptyUrlList(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((x) => typeof x === "string" && x.trim() !== "");
}

const SCENARIOS = new Set([
  "text-to-video",
  "first-frame",
  "first-last-frame",
  "reference-to-video",
]);

/**
 * Взаимоисключающие сценарии Seedance 2.0 (Kie bytedance/seedance-2 / seedance-2-fast).
 * См. OpenAPI: https://docs.kie.ai/market/bytedance/seedance-2
 * (Text-to-Video, First&Last, Multimodal reference — не смешивать).
 */
export function validateSeedanceScenario(
  settings: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const raw = settings.scenario;
  const scenario =
    typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "text-to-video";
  if (!SCENARIOS.has(scenario)) {
    return { ok: false, message: "Некорректный сценарий генерации (scenario)." };
  }

  const hasFirst = hasNonEmptyUrl(settings.firstFrameUrl);
  const hasLast = hasNonEmptyUrl(settings.lastFrameUrl);
  const hasRefImg = hasNonEmptyUrlList(settings.referenceImageUrls);
  const hasRefVid = hasNonEmptyUrlList(settings.referenceVideoUrls);
  const hasRefAud = hasNonEmptyUrlList(settings.referenceAudioUrls);
  const hasAnyRef = hasRefImg || hasRefVid || hasRefAud;

  if (scenario === "text-to-video") {
    if (hasFirst || hasLast || hasAnyRef) {
      return {
        ok: false,
        message:
          "Для сценария «text-to-video» не указывайте кадры и референсы (URL).",
      };
    }
  }
  if (scenario === "first-frame") {
    if (hasLast || hasAnyRef) {
      return {
        ok: false,
        message:
          "Для сценария «first-frame» нельзя указывать последний кадр и референсы.",
      };
    }
  }
  if (scenario === "first-last-frame") {
    if (hasAnyRef) {
      return {
        ok: false,
        message: "Для сценария «first-last-frame» нельзя указывать референсы.",
      };
    }
  }
  if (scenario === "reference-to-video") {
    if (hasFirst || hasLast) {
      return {
        ok: false,
        message:
          "Для сценария «reference-to-video» нельзя указывать URL первого/последнего кадра.",
      };
    }
  }
  return { ok: true };
}

/** Публичные http(s) URL из полей Seedance (для проверок на этапе API). */
export function collectSeedanceSettingsHttpUrls(
  settings: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  if (hasNonEmptyUrl(settings.firstFrameUrl)) {
    out.push(String(settings.firstFrameUrl).trim());
  }
  if (hasNonEmptyUrl(settings.lastFrameUrl)) {
    out.push(String(settings.lastFrameUrl).trim());
  }
  for (const key of [
    "referenceImageUrls",
    "referenceVideoUrls",
    "referenceAudioUrls",
  ] as const) {
    const arr = settings[key];
    if (!Array.isArray(arr)) continue;
    for (const x of arr) {
      if (typeof x === "string" && x.trim() !== "") out.push(x.trim());
    }
  }
  return out;
}

export const SEEDANCE_API_MODEL_ID = "bytedance/seedance-2";

export const SEEDANCE_FAST_API_MODEL_ID = "bytedance/seedance-2-fast";

/** Сценарии first/last frame / reference — общие для Seedance 2.0 и 2.0 Fast. */
export function isSeedanceScenarioModel(
  apiModelId: string | null | undefined,
): boolean {
  const t = String(apiModelId ?? "").trim();
  return t === SEEDANCE_API_MODEL_ID || t === SEEDANCE_FAST_API_MODEL_ID;
}
