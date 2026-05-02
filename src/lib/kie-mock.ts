
/** Р­РјСѓР»СЏС†РёСЏ РїСЂРѕРІР°Р№РґРµСЂР° Kie Р±РµР· СЃРµС‚РµРІС‹С… РІС‹Р·РѕРІРѕРІ (MOCK_KIE=true). */
export function isMockKie(): boolean {
  return process.env.MOCK_KIE?.trim().toLowerCase() === "true";
}

export function isMockProviderTaskId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith("mock_task_"));
}

/** Р’ mock-СЂРµР¶РёРјРµ Р·Р°СЃС‚Р°РІРёС‚СЊ РІСЃРµ mock-Р·Р°РїСЂРѕСЃС‹ Рє РїСЂРѕРІР°Р№РґРµСЂСѓ В«РїР°РґР°С‚СЊВ» (MOCK_KIE_FAIL=true). */
export function isMockKieFail(): boolean {
  return process.env.MOCK_KIE_FAIL?.trim().toLowerCase() === "true";
}

export function createMockProviderTaskId(): string {
  return `mock_task_${Date.now()}`;
}

const DEFAULT_MOCK_IMAGE =
  "https://placehold.co/1024x1024.png/2a2a2a/eeeeee?text=MOCK+KIE";
const DEFAULT_MOCK_VIDEO =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

/** РџСѓР±Р»РёС‡РЅС‹Рµ URL РґР»СЏ completeWithOutput (СЃРєР°С‡РёРІР°РЅРёРµ РІ S3 РїСЂРё РЅР°СЃС‚СЂРѕРµРЅРЅРѕРј storage). */
export function getMockOutputUrls(type: "IMAGE" | "VIDEO"): string[] {
  if (type === "IMAGE") {
    const u = process.env.MOCK_KIE_IMAGE_URL?.trim();
    return [u && u.length > 0 ? u : DEFAULT_MOCK_IMAGE];
  }
  const u = process.env.MOCK_KIE_VIDEO_URL?.trim();
  return [u && u.length > 0 ? u : DEFAULT_MOCK_VIDEO];
}
