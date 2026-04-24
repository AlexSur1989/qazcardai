import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { auth } from "@/auth";
import { getRateUploadSettings } from "@/lib/rate-upload-settings";
import {
  getUploadSizeLimitBytes,
  validateUploadBuffer,
  type UploadKind,
} from "@/lib/upload-file-validation";
import { enforceUploadRateLimit } from "@/server/services/rateLimitService";
import { isStorageConfigured, uploadFile } from "@/server/services/storage";
import { prisma } from "@/lib/prisma";

function sanitizeBaseName(name: string): string {
  const base = name.replace(/[\\/]+/g, "_").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return (base || "file").slice(0, 120);
}

function storageFileType(kind: UploadKind): string {
  return kind === "image" ? "image" : "video";
}

/**
 * Загрузка в S3-совместимое хранилище (только в памяти, без /tmp).
 * Требуется: аутентификация, валидный тип и размер, rate limit.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }
  const userId = session.user.id;

  const rate = await enforceUploadRateLimit(userId);
  if (rate) return rate;

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Загрузка недоступна: настройте S3 (см. .env.example)" },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ожидается multipart/form-data" }, { status: 400 });
  }

  const kindRaw = String(form.get("kind") ?? "").toLowerCase();
  const kind: UploadKind = kindRaw === "video" ? "video" : "image";
  const file = form.get("file");

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Передайте поле file (файл)" }, { status: 400 });
  }

  const settings = await getRateUploadSettings();
  const limits = await getUploadSizeLimitBytes(kind, settings);
  const buf = Buffer.from(await file.arrayBuffer());

  const v = validateUploadBuffer(
    kind,
    file.name,
    file.type,
    file.size,
    buf,
    limits,
  );
  if (!v.ok) {
    return NextResponse.json(
      { error: v.message, code: v.code },
      { status: v.code === "FILE_TOO_LARGE" ? 413 : 400 },
    );
  }

  const safeName = sanitizeBaseName(file.name);
  const idPart = randomBytes(8).toString("hex");
  const key = `uploads/${userId}/${idPart}-${safeName}`;

  let uploaded: { key: string; url: string; size: number };
  try {
    uploaded = await uploadFile(buf, key, v.mime);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка загрузки в хранилище";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const row = await prisma.uploadedFile.create({
    data: {
      userId,
      fileName: file.name.slice(0, 512),
      fileType: storageFileType(kind),
      mimeType: v.mime,
      size: uploaded.size,
      storageKey: uploaded.key,
      url: uploaded.url,
      metadata: { source: "api_upload" },
    },
  });

  return NextResponse.json(
    {
      id: row.id,
      url: row.url,
      key: row.storageKey,
      mimeType: v.mime,
      size: row.size,
    },
    { status: 201 },
  );
}
