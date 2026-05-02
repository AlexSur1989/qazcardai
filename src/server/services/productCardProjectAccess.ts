
import { prisma } from "@/lib/prisma";
import { getFirstOutputUrlFromJson } from "@/lib/product-card-output";

function metadataRecord(m: unknown): Record<string, unknown> {
  if (m && typeof m === "object" && !Array.isArray(m)) {
    return m as Record<string, unknown>;
  }
  return {};
}

export async function getOwnedProjectOrNull(
  userId: string,
  projectId: string,
) {
  return prisma.productCardProject.findFirst({
    where: { id: projectId, userId },
  });
}

export async function assertUserOwnsFileUrl(
  userId: string,
  url: string,
): Promise<boolean> {
  const u = url.trim();
  if (!u) return false;
  const row = await prisma.uploadedFile.findFirst({
    where: { userId, url: u },
  });
  return Boolean(row);
}

export async function getCompletedGenerationImageUrlForUser(
  userId: string,
  generationId: string,
): Promise<string | null> {
  const g = await prisma.generation.findFirst({
    where: {
      id: generationId,
      userId,
      type: "IMAGE",
      status: "COMPLETED",
    },
    select: { outputFiles: true },
  });
  if (!g) return null;
  return getFirstOutputUrlFromJson(g.outputFiles);
}

/**
 * URL РІС‹С…РѕРґР° concept-РіРµРЅРµСЂР°С†РёРё РґР»СЏ В«РљР°СЂС‚РѕС‡РєР° С‚РѕРІР°СЂР°В»:
 * РІР»Р°РґРµР»РµС†, РїСЂРѕРµРєС‚, РІРєР»Р°РґРєР° concept_photo; РіРѕС‚РѕРІС‹Р№ output.
 */
export async function getConceptGenerationImageUrlForMarketplace(
  userId: string,
  projectId: string,
  sourceGenerationId: string,
): Promise<
  { ok: true; url: string; status: string } | { ok: false; message: string }
> {
  const g = await prisma.generation.findFirst({
    where: { id: sourceGenerationId, userId, type: "IMAGE" },
    select: { id: true, status: true, outputFiles: true, metadata: true },
  });
  if (!g) {
    return { ok: false, message: "Р“РµРЅРµСЂР°С†РёСЏ РЅРµ РЅР°Р№РґРµРЅР°" };
  }
  const meta = metadataRecord(g.metadata);
  if (meta.flow !== "product_card" || meta.projectId !== projectId) {
    return { ok: false, message: "Р“РµРЅРµСЂР°С†РёСЏ РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє СЌС‚РѕРјСѓ РїСЂРѕРµРєС‚Сѓ" };
  }
  if (meta.tab !== "concept_photo") {
    return { ok: false, message: "РњРѕР¶РЅРѕ РІС‹Р±СЂР°С‚СЊ С‚РѕР»СЊРєРѕ С„РѕС‚Рѕ РёР· РІРєР»Р°РґРєРё В«Р¤РѕС‚Рѕ СЃ РєРѕРЅС†РµРїС†РёСЏРјРёВ»" };
  }
  const url = getFirstOutputUrlFromJson(g.outputFiles);
  if (!url) {
    return { ok: false, message: "Р РµР·СѓР»СЊС‚Р°С‚ РµС‰С‘ РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚СЃСЏ РёР»Рё РЅРµРґРѕСЃС‚СѓРїРµРЅ" };
  }
  return { ok: true, url, status: g.status };
}

/**
 * URL РІС‹С…РѕРґР° РіРµРЅРµСЂР°С†РёРё В«РљР°СЂС‚РѕС‡РєР° С‚РѕРІР°СЂР°В» (РІРєР»Р°РґРєР° marketplace) РґР»СЏ image-to-video.
 */
export async function getMarketplaceCardTabGenerationImageUrl(
  userId: string,
  projectId: string,
  sourceGenerationId: string,
): Promise<
  { ok: true; url: string; status: string } | { ok: false; message: string }
> {
  const g = await prisma.generation.findFirst({
    where: { id: sourceGenerationId, userId, type: "IMAGE" },
    select: { id: true, status: true, outputFiles: true, metadata: true },
  });
  if (!g) {
    return { ok: false, message: "Р“РµРЅРµСЂР°С†РёСЏ РЅРµ РЅР°Р№РґРµРЅР°" };
  }
  const meta = metadataRecord(g.metadata);
  if (meta.flow !== "product_card" || meta.projectId !== projectId) {
    return { ok: false, message: "Р“РµРЅРµСЂР°С†РёСЏ РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє СЌС‚РѕРјСѓ РїСЂРѕРµРєС‚Сѓ" };
  }
  if (meta.tab !== "marketplace_card") {
    return { ok: false, message: "РњРѕР¶РЅРѕ РІС‹Р±СЂР°С‚СЊ С‚РѕР»СЊРєРѕ РёР· РІРєР»Р°РґРєРё В«РљР°СЂС‚РѕС‡РєР° С‚РѕРІР°СЂР°В»" };
  }
  const url = getFirstOutputUrlFromJson(g.outputFiles);
  if (!url) {
    return { ok: false, message: "Р РµР·СѓР»СЊС‚Р°С‚ РµС‰С‘ РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚СЃСЏ РёР»Рё РЅРµРґРѕСЃС‚СѓРїРµРЅ" };
  }
  return { ok: true, url, status: g.status };
}

export async function getCompletedGenerationVideoUrlForUser(
  userId: string,
  generationId: string,
): Promise<string | null> {
  const g = await prisma.generation.findFirst({
    where: {
      id: generationId,
      userId,
      type: "VIDEO",
      status: "COMPLETED",
    },
    select: { outputFiles: true },
  });
  if (!g) return null;
  return getFirstOutputUrlFromJson(g.outputFiles);
}
