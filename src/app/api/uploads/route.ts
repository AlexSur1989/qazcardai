import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { getRateUploadSettings } from "@/lib/rate-upload-settings";
import {
  getUploadSizeLimitBytes,
  validateKlingMotionReferenceImageBuffer,
  validateKlingMotionVideoBuffer,
  validateProductCardSourceImageBuffer,
  validateSeedanceReferenceAudioBuffer,
  validateUploadBuffer,
  MAX_KLING_MOTION_VIDEO_DURATION_SECONDS,
  type UploadKind,
} from "@/lib/upload-file-validation";
import { enforceUploadRateLimit } from "@/server/services/rateLimitService";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { isStorageConfigured, uploadFile } from "@/server/services/storage";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type UploadPurpose =
  | "kling_motion_reference_image"
  | "kling_motion_video"
  | "product_card_source"
  /** Алиас для исходника «карточка товара» (то же поведение, что product_card_source) */
  | "product_card_source_image"
  /** Исходник только для сценария «Создать карточку» */
  | "product_card_card_builder_source"
  /** Референс стиля для мастера «Создать карточку» */
  | "product_card_style_reference"
  | "generation_input"
  | "seedance_reference_image"
  | "seedance_reference_video"
  | "seedance_reference_audio"
  | "kaspi_manual_receipt";

const ALLOWED_PURPOSES = new Set<string>([
  "kling_motion_reference_image",
  "kling_motion_video",
  "product_card_source",
  "product_card_source_image",
  "product_card_card_builder_source",
  "product_card_style_reference",
  "generation_input",
  "seedance_reference_image",
  "seedance_reference_video",
  "seedance_reference_audio",
  "kaspi_manual_receipt",
]);

function extForMime(mime: string): string {
  const m = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (m === "image/jpeg" || m === "image/jpg") return ".jpg";
  if (m === "image/png") return ".png";
  if (m === "video/mp4") return ".mp4";
  if (m === "video/quicktime") return ".mov";
  if (m === "video/webm") return ".webm";
  if (m === "image/webp") return ".webp";
  if (m === "image/gif") return ".gif";
  if (m === "audio/mpeg" || m === "audio/mp3") return ".mp3";
  if (m === "audio/wav" || m === "audio/x-wav") return ".wav";
  if (m === "audio/mp4" || m === "audio/x-m4a") return ".m4a";
  if (m === "audio/aac") return ".aac";
  if (m === "audio/ogg") return ".ogg";
  return ".bin";
}

function storageFileType(kind: UploadKind): string {
  return kind === "image" ? "image" : "video";
}

/**
 * Загрузка: в dev по умолчанию `public/uploads/...`; или S3 (`UPLOAD_STORAGE=s3` + S3_*).
 *
 * FormData: file, optional purpose
 * (kling_motion_reference_image | kling_motion_video | generation_input), для generation_input: kind=image|video
 */
export async function POST(req: Request) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }
  const userId = current.user.id;

  const rate = await enforceUploadRateLimit(userId);
  if (rate) return rate;

  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        error:
          "Хранилище не настроено: в development по умолчанию используется public/uploads; при UPLOAD_STORAGE=s3 задайте все S3_*. См. .env.example.",
        code: "STORAGE_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ожидается multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Передайте поле file (файл)" }, { status: 400 });
  }

  const purposeRaw = String(form.get("purpose") ?? "").trim();
  const purposeKey = purposeRaw === "" ? "generation_input" : purposeRaw;
  if (!ALLOWED_PURPOSES.has(purposeKey)) {
    return NextResponse.json(
      {
        error: "Неподдерживаемый purpose",
        code: "UNSUPPORTED_PURPOSE" as const,
      },
      { status: 400 },
    );
  }
  const purpose = purposeKey as UploadPurpose;

  const buf = Buffer.from(await file.arrayBuffer());
  const idPart = randomBytes(8).toString("hex");
  const ts = Date.now();

  let vMime: string;
  let fileType: string;
  let storageKey: string;
  let metaPurpose: string;

  if (purpose === "kling_motion_reference_image") {
    const v = validateKlingMotionReferenceImageBuffer(
      file.name,
      file.type,
      file.size,
      buf,
    );
    if (!v.ok) {
      return NextResponse.json(
        { error: v.message, code: v.code },
        { status: v.code === "FILE_TOO_LARGE" ? 413 : 400 },
      );
    }
    vMime = v.mime;
    fileType = "image";
    storageKey = `uploads/${userId}/${ts}-${idPart}-kling-ref${extForMime(v.mime)}`;
    metaPurpose = "kling_motion_reference_image";
  } else if (purpose === "kling_motion_video") {
    const v = validateKlingMotionVideoBuffer(file.name, file.type, file.size, buf);
    if (!v.ok) {
      return NextResponse.json(
        { error: v.message, code: v.code },
        { status: v.code === "FILE_TOO_LARGE" ? 413 : 400 },
      );
    }
    vMime = v.mime;
    fileType = "video";
    storageKey = `uploads/${userId}/${ts}-${idPart}-kling-motion${extForMime(v.mime)}`;
    metaPurpose = "kling_motion_video";
  } else if (purpose === "seedance_reference_image") {
    const settings = await getRateUploadSettings();
    const limits = await getUploadSizeLimitBytes("image", settings);
    const v = validateUploadBuffer(
      "image",
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
    vMime = v.mime;
    fileType = "image";
    storageKey = `uploads/${userId}/${ts}-${idPart}-seedance-refimg${extForMime(v.mime)}`;
    metaPurpose = "seedance_reference_image";
  } else if (purpose === "seedance_reference_video") {
    const settings = await getRateUploadSettings();
    const limits = await getUploadSizeLimitBytes("video", settings);
    const cap50 = {
      maxBytes: Math.min(limits.maxBytes, 50 * 1024 * 1024),
      maxMb: Math.min(limits.maxMb, 50),
    };
    const v = validateUploadBuffer(
      "video",
      file.name,
      file.type,
      file.size,
      buf,
      cap50,
    );
    if (!v.ok) {
      return NextResponse.json(
        { error: v.message, code: v.code },
        { status: v.code === "FILE_TOO_LARGE" ? 413 : 400 },
      );
    }
    vMime = v.mime;
    fileType = "video";
    storageKey = `uploads/${userId}/${ts}-${idPart}-seedance-refvid${extForMime(v.mime)}`;
    metaPurpose = "seedance_reference_video";
  } else if (purpose === "seedance_reference_audio") {
    const v = validateSeedanceReferenceAudioBuffer(file.name, file.type, file.size, buf);
    if (!v.ok) {
      return NextResponse.json(
        { error: v.message, code: v.code },
        { status: v.code === "FILE_TOO_LARGE" ? 413 : 400 },
      );
    }
    vMime = v.mime;
    fileType = "audio";
    storageKey = `uploads/${userId}/${ts}-${idPart}-seedance-refaud${extForMime(v.mime)}`;
    metaPurpose = "seedance_reference_audio";
  } else if (
    purpose === "product_card_source" ||
    purpose === "product_card_source_image" ||
    purpose === "product_card_card_builder_source"
  ) {
    const v = validateProductCardSourceImageBuffer(
      file.name,
      file.type,
      file.size,
      buf,
    );
    if (!v.ok) {
      return NextResponse.json(
        { error: v.message, code: v.code },
        { status: v.code === "FILE_TOO_LARGE" ? 413 : 400 },
      );
    }
    vMime = v.mime;
    fileType = "image";
    const suffix =
      purpose === "product_card_card_builder_source"
        ? "-card-builder-src"
        : "-product-card";
    storageKey = `uploads/${userId}/${ts}-${idPart}${suffix}${extForMime(v.mime)}`;
    metaPurpose =
      purpose === "product_card_source_image"
        ? "product_card_source_image"
        : purpose === "product_card_card_builder_source"
          ? "product_card_card_builder_source"
          : "product_card_source";
  } else if (purpose === "product_card_style_reference") {
    const v = validateProductCardSourceImageBuffer(file.name, file.type, file.size, buf);
    if (!v.ok) {
      return NextResponse.json(
        { error: v.message, code: v.code },
        { status: v.code === "FILE_TOO_LARGE" ? 413 : 400 },
      );
    }
    vMime = v.mime;
    fileType = "image";
    storageKey = `uploads/${userId}/${ts}-${idPart}-card-builder-style-ref${extForMime(v.mime)}`;
    metaPurpose = "product_card_style_reference";
  } else if (purpose === "kaspi_manual_receipt") {
    const settings = await getRateUploadSettings();
    const limits = await getUploadSizeLimitBytes("image", settings);
    const v = validateUploadBuffer(
      "image",
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
    vMime = v.mime;
    fileType = "image";
    storageKey = `uploads/${userId}/${ts}-${idPart}-kaspi-receipt${extForMime(v.mime)}`;
    metaPurpose = "kaspi_manual_receipt";
  } else {
    const kindRaw = String(form.get("kind") ?? "").toLowerCase();
    const kind: UploadKind = kindRaw === "video" ? "video" : "image";
    const settings = await getRateUploadSettings();
    const limits = await getUploadSizeLimitBytes(kind, settings);
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
    vMime = v.mime;
    fileType = storageFileType(kind);
    storageKey = `uploads/${userId}/${ts}-${idPart}-gen${extForMime(v.mime)}`;
    metaPurpose = "generation_input";
  }

  let uploaded: { key: string; url: string; size: number };
  try {
    uploaded = await uploadFile(buf, storageKey, vMime);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка загрузки в хранилище";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let fileMetadata: Record<string, unknown> = {
    source: "api_upload",
    purpose: metaPurpose,
  };
  if (metaPurpose === "kling_motion_video") {
    const durRaw = form.get("durationSeconds");
    if (durRaw != null && String(durRaw).trim() !== "") {
      const d = Number.parseFloat(String(durRaw).replace(",", "."));
      if (!Number.isFinite(d) || d <= 0) {
        return NextResponse.json(
          {
            error: "durationSeconds: укажите число больше 0",
            code: "INVALID_DURATION",
          },
          { status: 400 },
        );
      }
      if (d > MAX_KLING_MOTION_VIDEO_DURATION_SECONDS) {
        return NextResponse.json(
          {
            error: `durationSeconds: не больше ${MAX_KLING_MOTION_VIDEO_DURATION_SECONDS} с`,
            code: "DURATION_TOO_LONG",
          },
          { status: 400 },
        );
      }
      fileMetadata = { ...fileMetadata, durationSeconds: d };
    }
  }

  const row = await prisma.uploadedFile.create({
    data: {
      userId,
      fileName: file.name.slice(0, 512),
      fileType,
      mimeType: vMime,
      size: uploaded.size,
      storageKey: uploaded.key,
      url: uploaded.url,
      metadata: fileMetadata as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(
    {
      fileId: row.id,
      id: row.id,
      url: row.url,
      storageKey: row.storageKey,
      mimeType: vMime,
      size: row.size,
      fileName: row.fileName,
      ...(typeof fileMetadata.durationSeconds === "number"
        ? { durationSeconds: fileMetadata.durationSeconds }
        : {}),
    },
    { status: 201 },
  );
}
