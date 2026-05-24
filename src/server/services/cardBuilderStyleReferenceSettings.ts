import {
  normalizeStyleReferencePlan,
  sanitizeStyleReferenceOnStoredPlan,
  type CardBuilderStyleReferencePlan,
} from "@/lib/card-builder-style-reference";
import {
  readCardBuilderBlock,
  mergeCardBuilderBlock,
  type CardBuilderStoredSettings,
} from "@/server/services/productCardCardBuilderMeta";
import { resolveCardBuilderStyleReferenceUrls } from "@/server/services/cardBuilderStyleReferenceFiles";

export type CardBuilderStyleReferenceAsset = {
  fileId: string;
  url: string;
  fileName?: string;
  size?: number;
};

/** Сохраняет styleReference в metadata.cardBuilder.settings без пересборки galleryPlan. */
export async function saveCardBuilderStyleReference(
  projectId: string,
  raw: CardBuilderStyleReferencePlan | null | undefined,
): Promise<void> {
  const blk = await readCardBuilderBlock(projectId);
  const prev = (blk?.settings ?? {}) as CardBuilderStoredSettings;

  const normalized = raw ? normalizeStyleReferencePlan(raw) : undefined;
  const merged = sanitizeStyleReferenceOnStoredPlan({
    ...prev,
    ...(normalized && normalized.enabled && normalized.referenceAssetIds.length
      ? { styleReference: normalized }
      : {}),
  });

  await mergeCardBuilderBlock(projectId, {
    settings: {
      ...merged,
      updatedAt: new Date().toISOString(),
    },
  });
}

/** URL и метаданные загруженных референсов для UI после reload. */
export async function listCardBuilderStyleReferenceAssets(
  userId: string,
  referenceAssetIds: string[],
): Promise<CardBuilderStyleReferenceAsset[]> {
  const ids = [...new Set(referenceAssetIds.map((id) => id.trim()).filter(Boolean))].slice(0, 3);
  if (ids.length === 0) return [];

  const urls = await resolveCardBuilderStyleReferenceUrls(userId, ids);
  const urlByOrder = new Map<string, string>();
  for (let i = 0; i < ids.length && i < urls.length; i++) {
    urlByOrder.set(ids[i]!, urls[i]!);
  }

  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.uploadedFile.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true, url: true, fileName: true, size: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r] as const));

  const out: CardBuilderStyleReferenceAsset[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    const url = row?.url?.trim() || urlByOrder.get(id) || "";
    if (!url) continue;
    out.push({
      fileId: id,
      url,
      fileName: row?.fileName?.trim() || undefined,
      size: typeof row?.size === "number" ? row.size : undefined,
    });
  }
  return out;
}
