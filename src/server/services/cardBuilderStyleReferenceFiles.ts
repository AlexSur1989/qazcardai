import { prisma } from "@/lib/prisma";

/** Публичные URL загруженных изображений-референсов стиля; порядок как у клиента; пропускаем недоступные. */
export async function resolveCardBuilderStyleReferenceUrls(
  userId: string,
  referenceAssetIds: string[],
): Promise<string[]> {
  const ids = [...new Set(referenceAssetIds.map((id) => id.trim()).filter(Boolean))].slice(0, 3);
  if (ids.length === 0) return [];

  const rows = await prisma.uploadedFile.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true, url: true, mimeType: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r] as const));
  const urls: string[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    const u = row?.url?.trim() ?? "";
    const mime = (row?.mimeType ?? "").toLowerCase();
    if (!u || !mime.startsWith("image/")) continue;
    urls.push(u);
  }
  return urls;
}
