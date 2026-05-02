
import type { ProductCardProject } from "@/generated/prisma/client";
import {
  assertUserOwnsFileUrl,
  getCompletedGenerationImageUrlForUser,
  getConceptGenerationImageUrlForMarketplace,
  getMarketplaceCardTabGenerationImageUrl,
} from "@/server/services/productCardProjectAccess";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";

export type SourceKind = "original" | "generated_concept" | "generated_card";

export type MarketplaceImageSource = "original" | "concept_generation";

export async function resolveProductStillImageUrl(
  userId: string,
  project: ProductCardProject,
  sourceType: SourceKind,
  sourceGenerationId: string | null | undefined,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (sourceType === "original") {
    const u = normalizeProductSourceImages(project)[0]?.url ?? project.sourceImageUrl?.trim();
    if (!u) {
      return { ok: false, message: "Р—Р°РіСЂСѓР·РёС‚Рµ РёСЃС…РѕРґРЅРѕРµ С„РѕС‚Рѕ С‚РѕРІР°СЂР°." };
    }
    const own = await assertUserOwnsFileUrl(userId, u);
    if (!own) {
      return { ok: false, message: "РќРµС‚ РґРѕСЃС‚СѓРїР° Рє РёСЃС…РѕРґРЅРѕРјСѓ РёР·РѕР±СЂР°Р¶РµРЅРёСЋ." };
    }
    return { ok: true, url: u };
  }
  if (!sourceGenerationId?.trim()) {
    return { ok: false, message: "РЈРєР°Р¶РёС‚Рµ СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ." };
  }
  const url = await getCompletedGenerationImageUrlForUser(userId, sourceGenerationId.trim());
  if (!url) {
    return { ok: false, message: "Р“РµРЅРµСЂР°С†РёСЏ РЅРµ РЅР°Р№РґРµРЅР° РёР»Рё РµС‰С‘ РЅРµ РіРѕС‚РѕРІР°." };
  }
  return { ok: true, url };
}

/** РСЃС‚РѕС‡РЅРёРє РјРёРЅРёР°С‚СЋСЂС‹ РґР»СЏ РІРєР»Р°РґРєРё В«РљР°СЂС‚РѕС‡РєР° С‚РѕРІР°СЂР°В» (MVP: original | concept). */
export async function resolveMarketplaceCardSource(
  userId: string,
  project: ProductCardProject,
  sourceType: MarketplaceImageSource,
  sourceGenerationId: string | null | undefined,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (sourceType === "original") {
    const u = normalizeProductSourceImages(project)[0]?.url ?? project.sourceImageUrl?.trim();
    if (!u) {
      return { ok: false, message: "Р—Р°РіСЂСѓР·РёС‚Рµ РёСЃС…РѕРґРЅРѕРµ С„РѕС‚Рѕ" };
    }
    if (!(await assertUserOwnsFileUrl(userId, u))) {
      return { ok: false, message: "РќРµС‚ РґРѕСЃС‚СѓРїР° Рє РёСЃС…РѕРґРЅРѕРјСѓ С„РѕС‚Рѕ" };
    }
    return { ok: true, url: u };
  }
  if (sourceType === "concept_generation") {
    if (!sourceGenerationId?.trim()) {
      return { ok: false, message: "Р’С‹Р±РµСЂРёС‚Рµ СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅРѕРµ С„РѕС‚Рѕ" };
    }
    const r = await getConceptGenerationImageUrlForMarketplace(
      userId,
      project.id,
      sourceGenerationId.trim(),
    );
    if (!r.ok) {
      return { ok: false, message: r.message };
    }
    return { ok: true, url: r.url };
  }
  return { ok: false, message: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє" };
}

export type ProductVideoImageSourceType =
  | "original"
  | "concept_generation"
  | "marketplace_card_generation";

/**
 * РљР°РґСЂ РґР»СЏ product-card video: РёСЃС…РѕРґРЅРёРє, concept IMAGE РёР»Рё marketplace_card IMAGE.
 */
export async function resolveProductVideoImageSource(
  userId: string,
  project: ProductCardProject,
  sourceType: ProductVideoImageSourceType,
  sourceGenerationId: string | null | undefined,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (sourceType === "original") {
    const u = normalizeProductSourceImages(project)[0]?.url ?? project.sourceImageUrl?.trim();
    if (!u) {
      return { ok: false, message: "Р—Р°РіСЂСѓР·РёС‚Рµ РёСЃС…РѕРґРЅРѕРµ С„РѕС‚Рѕ С‚РѕРІР°СЂР°" };
    }
    if (!(await assertUserOwnsFileUrl(userId, u))) {
      return { ok: false, message: "РќРµС‚ РґРѕСЃС‚СѓРїР° Рє РёСЃС…РѕРґРЅРѕРјСѓ С„РѕС‚Рѕ" };
    }
    return { ok: true, url: u };
  }
  if (!sourceGenerationId?.trim()) {
    return { ok: false, message: "РЈРєР°Р¶РёС‚Рµ СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ" };
  }
  if (sourceType === "concept_generation") {
    const r = await getConceptGenerationImageUrlForMarketplace(
      userId,
      project.id,
      sourceGenerationId.trim(),
    );
    if (!r.ok) {
      return { ok: false, message: r.message };
    }
    return { ok: true, url: r.url };
  }
  if (sourceType === "marketplace_card_generation") {
    const r = await getMarketplaceCardTabGenerationImageUrl(
      userId,
      project.id,
      sourceGenerationId.trim(),
    );
    if (!r.ok) {
      return { ok: false, message: r.message };
    }
    return { ok: true, url: r.url };
  }
  return { ok: false, message: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє" };
}
