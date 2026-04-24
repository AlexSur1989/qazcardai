import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";

export class StorageError extends Error {
  code: "NOT_CONFIGURED" | "UPLOAD" | "DOWNLOAD" | "DELETE" | "UNKNOWN";
  constructor(
    code: StorageError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.code = code;
    this.name = "StorageError";
  }
}

let s3Client: S3Client | null = null;

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new StorageError("NOT_CONFIGURED", `Отсутствует ${name}`);
  }
  return v;
}

function inferForcePathStyle(): boolean {
  const raw = process.env.S3_FORCE_PATH_STYLE?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  const ep = process.env.S3_ENDPOINT?.trim() ?? "";
  if (!ep) return true;
  if (/amazonaws\.com$/i.test(new URL(ep).hostname)) return false;
  return true;
}

function getClient(): S3Client {
  if (s3Client) {
    return s3Client;
  }
  const endpoint = requireEnv("S3_ENDPOINT");
  const region = requireEnv("S3_REGION");
  const accessKeyId = requireEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("S3_SECRET_ACCESS_KEY");

  s3Client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: inferForcePathStyle(),
  });
  return s3Client;
}

const REQUIRED = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET",
  "S3_PUBLIC_URL",
] as const;

export function isStorageConfigured(): boolean {
  return REQUIRED.every((n) => Boolean(process.env[n]?.trim()));
}

function bucket(): string {
  return requireEnv("S3_BUCKET");
}

/**
 * Публичный URL объекта (CDN / R2 public). Сегменты key кодируются.
 */
export function publicObjectUrl(key: string): string {
  const base = requireEnv("S3_PUBLIC_URL").replace(/\/$/, "");
  const path = key
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${base}/${path}`;
}

/**
 * Загрузка буфера в бакет. Не пишет на диск VPS.
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<{ key: string; url: string; size: number }> {
  let client: S3Client;
  try {
    client = getClient();
  } catch (e) {
    if (e instanceof StorageError) throw e;
    throw new StorageError("UNKNOWN", "S3: не удалось инициализировать клиент", {
      cause: e,
    });
  }
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  } catch (e) {
    throw new StorageError("UPLOAD", "S3: ошибка PutObject", { cause: e });
  }
  return { key, url: publicObjectUrl(key), size: buffer.length };
}

const FETCH_TIMEOUT_MS = Math.min(
  Number.parseInt(process.env.STORAGE_FETCH_TIMEOUT_MS ?? "300000", 10) || 300_000,
  600_000,
);

/**
 * Скачивает URL в память и грузит в бакет (без временных файлов на диске).
 */
export async function uploadFromUrl(
  sourceUrl: string,
  key: string,
): Promise<{
  key: string;
  url: string;
  size: number;
  contentType: string;
  sourceUrl: string;
}> {
  let res: Response;
  try {
    res = await fetch(sourceUrl, {
      redirect: "follow",
      headers: { "User-Agent": "ai-media-saas-storage/1.0" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    throw new StorageError("DOWNLOAD", "Не удалось скачать URL провайдера", {
      cause: e,
    });
  }
  if (!res.ok) {
    throw new StorageError(
      "DOWNLOAD",
      `HTTP ${res.status} при скачивании результата`,
    );
  }
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const buf = Buffer.from(await res.arrayBuffer());
  const up = await uploadFile(buf, key, contentType);
  return {
    ...up,
    contentType,
    sourceUrl: sourceUrl,
  };
}

/**
 * Presigned GET (для приватных бакетов). Срок — по умолчанию 1 ч.
 */
export async function getSignedUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const client = getClient();
  const cmd = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
  });
  try {
    return await awsGetSignedUrl(client, cmd, { expiresIn: expiresInSeconds });
  } catch (e) {
    throw new StorageError("UNKNOWN", "S3: presign GetObject", { cause: e });
  }
}

export async function deleteFile(key: string): Promise<void> {
  const client = getClient();
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket(),
        Key: key,
      }),
    );
  } catch (e) {
    throw new StorageError("DELETE", "S3: DeleteObject", { cause: e });
  }
}
