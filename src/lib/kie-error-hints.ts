
/**
 * РўРµРєСЃС‚ РїСЂРѕ В«Credits insufficientвЂ¦В» РІ РѕС‚РІРµС‚Рµ Kie вЂ” СЌС‚Рѕ Р±Р°Р»Р°РЅСЃ РЅР° СЃС‚РѕСЂРѕРЅРµ Kie.ai,
 * РЅРµ РІРЅСѓС‚СЂРёРёРіСЂРѕРІС‹Рµ С‚РѕРєРµРЅС‹ РїСЂРёР»РѕР¶РµРЅРёСЏ.
 */
export function isLikelyKieAccountInsufficientMessage(msg: string | null | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("credits insufficient") ||
    m.includes("isn't enough to run this request") ||
    m.includes("is not enough to run") ||
    m.includes("top up to continue") ||
    m.includes("please top up") ||
    m.includes("insufficient balance")
  );
}

function isLikelyKieImageUrlError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("image download failed") ||
    m.includes("image url") ||
    m.includes("failed to download") ||
    m.includes("cannot download") ||
    (m.includes("http 403") && (m.includes("forbidden") || m.includes("image"))) ||
    m.includes("403: forbidden") ||
    m.includes("url not accessible") ||
    m.includes("invalid image url")
  );
}

function isLikelyKieAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    /\b401\b/.test(m) ||
    m.includes("unauthorized") ||
    m.includes("invalid api key") ||
    m.includes("invalid apikey") ||
    m.includes("authentication failed") ||
    m.includes("access denied")
  );
}

function isLikelyKieModelError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("model not found") ||
    m.includes("model not supported") ||
    m.includes("unsupported model") ||
    m.includes("invalid model") ||
    m.includes("unknown model")
  );
}

function isLikelyKiePayloadError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("invalid payload") ||
    m.includes("validation failed") ||
    m.includes("invalid parameter") ||
    m.includes("malformed json") ||
    m.includes("invalid field")
  );
}

/**
 * РЎРѕРѕР±С‰РµРЅРёРµ РґР»СЏ Р‘Р”/РёСЃС‚РѕСЂРёРё/UI: Р±РµР·РѕРїР°СЃРЅРѕРµ РїРѕСЏСЃРЅРµРЅРёРµ РїРѕ С‚РёРїРёС‡РЅС‹Рј РѕС‚РІРµС‚Р°Рј Kie.
 */
export function explainKieErrorForUser(
  providerMessage: string | null | undefined,
  fallback: string,
): string {
  const raw = (providerMessage ?? "").trim() || fallback;
  if (isLikelyKieAccountInsufficientMessage(raw)) {
    return [
      "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ credits РЅР° СЃС‚РѕСЂРѕРЅРµ Kie.ai (СЌС‚Рѕ РЅРµ Р±Р°Р»Р°РЅСЃ С‚РѕРєРµРЅРѕРІ РІ РїСЂРёР»РѕР¶РµРЅРёРё).",
      "РџРѕРїРѕР»РЅРёС‚Рµ Р±Р°Р»Р°РЅСЃ Kie РёР»Рё РїСЂРѕРІРµСЂСЊС‚Рµ API-РєР»СЋС‡.",
      `Р”РµС‚Р°Р»Рё: ${raw}`,
    ]
      .join(" ")
      .slice(0, 8000);
  }
  if (isLikelyKieImageUrlError(raw)) {
    return [
      "Kie РЅРµ РјРѕР¶РµС‚ РѕС‚РєСЂС‹С‚СЊ РёР»Рё СЃРєР°С‡Р°С‚СЊ РёСЃС…РѕРґРЅРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РїРѕ РїРµСЂРµРґР°РЅРЅРѕРјСѓ URL.",
      "РќСѓР¶РµРЅ РїСѓР±Р»РёС‡РЅС‹Р№ https-Р°РґСЂРµСЃ (S3/R2/CDN). Р›РѕРєР°Р»СЊРЅС‹Р№ СЃРµСЂРІРµСЂ Kie РёР· РёРЅС‚РµСЂРЅРµС‚Р° РЅРµ РґРѕСЃС‚Р°РЅРµС‚.",
      `Р”РµС‚Р°Р»Рё: ${raw}`,
    ]
      .join(" ")
      .slice(0, 8000);
  }
  if (isLikelyKieAuthError(raw)) {
    return `Kie API key invalid РёР»Рё Р·Р°РїСЂРѕСЃ РЅРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ. РџСЂРѕРІРµСЂСЊС‚Рµ KIE_API_KEY. Р”РµС‚Р°Р»Рё: ${raw}`.slice(
      0,
      8000,
    );
  }
  if (isLikelyKieModelError(raw)) {
    return `РќРµРІРµСЂРЅС‹Р№ apiModelId РёР»Рё РјРѕРґРµР»СЊ РЅРµРґРѕСЃС‚СѓРїРЅР° Сѓ Kie. РџСЂРѕРІРµСЂСЊС‚Рµ РєР°СЂС‚РѕС‡РєСѓ РјРѕРґРµР»Рё РІ Р°РґРјРёРЅРєРµ. Р”РµС‚Р°Р»Рё: ${raw}`.slice(
      0,
      8000,
    );
  }
  if (isLikelyKiePayloadError(raw) && !isLikelyKieImageUrlError(raw)) {
    return `РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ payload РґР»СЏ РјРѕРґРµР»Рё Kie. РџСЂРѕРІРµСЂСЊС‚Рµ payloadMapping Рё РїРѕР»СЏ input РІ Р°РґРјРёРЅРєРµ. Р”РµС‚Р°Р»Рё: ${raw}`.slice(
      0,
      8000,
    );
  }
  return raw.slice(0, 8000);
}
