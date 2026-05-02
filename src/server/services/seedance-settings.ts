
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
 * Р’Р·Р°РёРјРѕРёСЃРєР»СЋС‡Р°СЋС‰РёРµ СЃС†РµРЅР°СЂРёРё Seedance 2.0 (Kie bytedance/seedance-2 / seedance-2-fast).
 * РЎРј. OpenAPI: https://docs.kie.ai/market/bytedance/seedance-2
 * (Text-to-Video, First&Last, Multimodal reference вЂ” РЅРµ СЃРјРµС€РёРІР°С‚СЊ).
 */
export function validateSeedanceScenario(
  settings: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const raw = settings.scenario;
  const scenario =
    typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "text-to-video";
  if (!SCENARIOS.has(scenario)) {
    return { ok: false, message: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ СЃС†РµРЅР°СЂРёР№ РіРµРЅРµСЂР°С†РёРё (scenario)." };
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
          "Р”Р»СЏ СЃС†РµРЅР°СЂРёСЏ В«text-to-videoВ» РЅРµ СѓРєР°Р·С‹РІР°Р№С‚Рµ РєР°РґСЂС‹ Рё СЂРµС„РµСЂРµРЅСЃС‹ (URL).",
      };
    }
  }
  if (scenario === "first-frame") {
    if (hasLast || hasAnyRef) {
      return {
        ok: false,
        message:
          "Р”Р»СЏ СЃС†РµРЅР°СЂРёСЏ В«first-frameВ» РЅРµР»СЊР·СЏ СѓРєР°Р·С‹РІР°С‚СЊ РїРѕСЃР»РµРґРЅРёР№ РєР°РґСЂ Рё СЂРµС„РµСЂРµРЅСЃС‹.",
      };
    }
  }
  if (scenario === "first-last-frame") {
    if (hasAnyRef) {
      return {
        ok: false,
        message: "Р”Р»СЏ СЃС†РµРЅР°СЂРёСЏ В«first-last-frameВ» РЅРµР»СЊР·СЏ СѓРєР°Р·С‹РІР°С‚СЊ СЂРµС„РµСЂРµРЅСЃС‹.",
      };
    }
  }
  if (scenario === "reference-to-video") {
    if (hasFirst || hasLast) {
      return {
        ok: false,
        message:
          "Р”Р»СЏ СЃС†РµРЅР°СЂРёСЏ В«reference-to-videoВ» РЅРµР»СЊР·СЏ СѓРєР°Р·С‹РІР°С‚СЊ URL РїРµСЂРІРѕРіРѕ/РїРѕСЃР»РµРґРЅРµРіРѕ РєР°РґСЂР°.",
      };
    }
  }
  return { ok: true };
}

/** РџСѓР±Р»РёС‡РЅС‹Рµ http(s) URL РёР· РїРѕР»РµР№ Seedance (РґР»СЏ РїСЂРѕРІРµСЂРѕРє РЅР° СЌС‚Р°РїРµ API). */
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

/** РЎС†РµРЅР°СЂРёРё first/last frame / reference вЂ” РѕР±С‰РёРµ РґР»СЏ Seedance 2.0 Рё 2.0 Fast. */
export function isSeedanceScenarioModel(
  apiModelId: string | null | undefined,
): boolean {
  const t = String(apiModelId ?? "").trim();
  return t === SEEDANCE_API_MODEL_ID || t === SEEDANCE_FAST_API_MODEL_ID;
}
