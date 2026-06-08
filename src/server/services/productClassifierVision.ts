import { prisma } from "@/lib/prisma";
import { toAbsoluteIfAppPath } from "@/lib/app-base-url";
import { readStoredFileByKey } from "@/server/services/storage";

const MAX_CLASSIFIER_IMAGE_BYTES = 4 * 1024 * 1024;

async function readImageForVisionFromUploadRecord(imageUrl: string): Promise<{
  mime: string;
  base64: string;
}> {
  const t = imageUrl.trim();
  const absolute = toAbsoluteIfAppPath(t);
  const row = await prisma.uploadedFile.findFirst({
    where: { OR: [{ url: t }, { url: absolute }] },
    select: { storageKey: true, mimeType: true },
    orderBy: { createdAt: "desc" },
  });
  if (!row?.storageKey?.trim()) {
    throw new Error("upload record not found");
  }
  const { buffer, contentType } = await readStoredFileByKey(row.storageKey.trim());
  if (buffer.length > MAX_CLASSIFIER_IMAGE_BYTES) throw new Error("image too large");
  const mime =
    row.mimeType?.split(";")[0]?.trim() ||
    contentType.split(";")[0]?.trim() ||
    "image/jpeg";
  return { mime, base64: buffer.toString("base64") };
}

export async function readImageForVision(imageUrl: string): Promise<{
  mime: string;
  base64: string;
}> {
  const t = imageUrl.trim();
  if (t.startsWith("data:")) {
    const m = /^data:([^;]+);base64,([\s\S]+)$/i.exec(t);
    if (!m) throw new Error("invalid data url");
    const buf = Buffer.from(m[2]!.replace(/\s/g, ""), "base64");
    if (buf.length > MAX_CLASSIFIER_IMAGE_BYTES) throw new Error("image too large");
    const mime = m[1]!.split(";")[0]!.trim() || "image/jpeg";
    return { mime, base64: buf.toString("base64") };
  }

  const absolute = toAbsoluteIfAppPath(t);
  try {
    const res = await fetch(absolute, { signal: AbortSignal.timeout(30_000) });
    if (res.ok) {
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.length > MAX_CLASSIFIER_IMAGE_BYTES) throw new Error("image too large");
      const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
      return { mime, base64: buf.toString("base64") };
    }
  } catch {
    /* fallback to storage */
  }

  return readImageForVisionFromUploadRecord(imageUrl);
}
