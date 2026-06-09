import { readSimpleCardBlock } from "@/server/services/simpleProductCardMeta";
import { prisma } from "@/lib/prisma";

export type SimpleCardReferencePreview = {
  fileId: string;
  url: string;
  fileName: string;
  size: number;
};

/** Owner-safe preview для UI hydration (source of truth = referenceImageId → UploadedFile). */
export async function resolveSimpleCardReferencePreview(
  userId: string,
  projectId: string,
): Promise<SimpleCardReferencePreview | null> {
  const block = await readSimpleCardBlock(projectId);
  const fileId = block?.settings?.referenceImageId?.trim();
  if (!fileId) return null;

  const row = await prisma.uploadedFile.findFirst({
    where: { id: fileId, userId },
    select: { id: true, url: true, fileName: true, size: true },
  });
  const url = row?.url?.trim();
  if (!row || !url) return null;

  return {
    fileId: row.id,
    url,
    fileName: row.fileName,
    size: row.size,
  };
}
