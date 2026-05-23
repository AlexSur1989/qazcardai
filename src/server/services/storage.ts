
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import * as http from "node:http";
import * as https from "node:https";
import path from "node:path";

import { toAbsoluteIfAppPath } from "@/lib/app-base-url";
import { isLocalUploadStorageEffective } from "@/lib/upload-storage-mode";

export class StorageError extends Error {
  code: "NOT_CONFIGURED" | "UPLOAD" | "DOWNLOAD" | "DELETE" | "UNKNOWN" | "NOT_ALLOWED";
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

/**
 * `true` — файлы в `public/uploads` (в development по умолчанию, без S3).
 * См. `src/lib/upload-storage-mode.ts`; для MinIO в dev: `UPLOAD_STORAGE=s3`.
 */
export { isLocalUploadStorageEffective as isLocalUploadStorageMode };

function assertLocalStorageAllowedInThisEnv(): void {
  if (process.env.NODE_ENV === "production") {
    throw new StorageError(
      "NOT_ALLOWED",
      "UPLOAD_STORAGE=local запрещён в production. Настройте S3-совместимое хранилище.",
    );
  }
}

/**
 * S3: все обязательные переменные заданы.
 * Локально: см. `isLocalUploadStorageEffective` (в dev по умолчанию).
 */
export function isStorageConfigured(): boolean {
  if (isLocalUploadStorageEffective()) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return true;
  }
  return REQUIRED.every((n) => Boolean(process.env[n]?.trim()));
}

/** Полный URL S3 API (не имя бакета). Без схемы подставляется https://. */
function parseS3EndpointUrl(raw: string): URL {
  const trimmed = raw.trim();
  const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new StorageError(
      "NOT_CONFIGURED",
      "S3_ENDPOINT: укажите корректный URL API S3 (например https://object.pscloud.io для PS Cloud), а не только имя контейнера.",
    );
  }
  if (!url.hostname) {
    throw new StorageError("NOT_CONFIGURED", "S3_ENDPOINT: в URL отсутствует хост.");
  }
  return url;
}

function inferForcePathStyleForHost(hostname: string): boolean {
  const raw = process.env.S3_FORCE_PATH_STYLE?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  if (/amazonaws\.com$/i.test(hostname)) return false;
  return true;
}

function createS3RequestHandler(): NodeHttpHandler {
  const insecure = process.env.S3_TLS_INSECURE?.trim() === "1";
  const minRaw = process.env.S3_TLS_MIN_VERSION?.trim();
  const minVersion =
    minRaw === "TLSv1.3" || minRaw === "TLSv1.2" ? minRaw : ("TLSv1.2" as const);

  const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 64,
    rejectUnauthorized: !insecure,
    minVersion,
  });

  if (insecure) {
    console.warn(
      "[storage] S3_TLS_INSECURE=1: TLS certificate verification disabled (dev/self-signed only).",
    );
  }

  return new NodeHttpHandler({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent,
  });
}

function getClient(): S3Client {
  if (s3Client) {
    return s3Client;
  }
  const endpointRaw = requireEnv("S3_ENDPOINT");
  const endpointUrl = parseS3EndpointUrl(endpointRaw);
  const endpoint = endpointUrl.toString().replace(/\/$/, "");
  const region = requireEnv("S3_REGION");
  const accessKeyId = requireEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("S3_SECRET_ACCESS_KEY");

  try {
    s3Client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: inferForcePathStyleForHost(endpointUrl.hostname),
      requestHandler: createS3RequestHandler(),
    });
  } catch (e) {
    throw new StorageError(
      "NOT_CONFIGURED",
      `S3: не удалось инициализировать клиент: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    );
  }
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

function describeS3Error(e: unknown): string {
  if (e == null) return "неизвестная ошибка";
  if (typeof e === "object" && e !== null) {
    const x = e as {
      name?: string;
      message?: string;
      Code?: string;
      $fault?: string;
    };
    const name = (x.name ?? x.Code) || "";
    const message = (x.message ?? "").trim();
    if (name && message) return `${name} — ${message}`.slice(0, 500);
    if (message) return message.slice(0, 500);
    if (name) return name;
  }
  if (e instanceof Error && e.message) return e.message.slice(0, 500);
  return String(e).slice(0, 500);
}

function hintForTlsMessage(detail: string): string {
  const d = detail.toLowerCase();
  if (
    !d.includes("handshake") &&
    !d.includes("eproto") &&
    !d.includes("ssl") &&
    !d.includes("tls") &&
    !d.includes("alert number 40")
  ) {
    return detail;
  }
  if (process.env.S3_TLS_INSECURE?.trim() === "1") {
    return `${detail} (S3_TLS_INSECURE уже включён — проверьте endpoint/порт и доверие к CA.)`;
  }
  if (process.env.NODE_ENV === "development") {
    return `${detail} — варианты: S3_TLS_INSECURE=1 (MinIO/self-signed, только dev) или уберите UPLOAD_STORAGE=s3, чтобы по умолчанию использовать файлы в public/uploads (без S3).`;
  }
  return `${detail} — для MinIO/self-signed: S3_TLS_INSECURE=1 (только разработка).`;
}

function bucket(): string {
  return requireEnv("S3_BUCKET");
}

export function publicObjectUrl(key: string): string {
  const base = requireEnv("S3_PUBLIC_URL").replace(/\/$/, "");
  const pathSeg = key
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${base}/${pathSeg}`;
}

function assertSafeLocalKey(key: string): void {
  const k = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!k.startsWith("uploads/") || k.includes("..") || k.includes("\0")) {
    throw new StorageError("UPLOAD", "Некорректный storage key");
  }
}

function localDiskPathFromKey(key: string): string {
  assertSafeLocalKey(key);
  return path.join(process.cwd(), "public", ...key.split("/"));
}

/**
 * Публичный path для URL в БД: `/uploads/...` (только local storage).
 */
function localPublicPath(key: string): string {
  assertSafeLocalKey(key);
  return (
    "/" +
    key
      .split("/")
      .map((s) => encodeURIComponent(s))
      .join("/")
  );
}

/**
 * Загрузка: S3 или `public/uploads/...` при `UPLOAD_STORAGE=local` (только dev).
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<{ key: string; url: string; size: number }> {
  if (isLocalUploadStorageEffective()) {
    assertLocalStorageAllowedInThisEnv();
    assertSafeLocalKey(key);
    const diskPath = localDiskPathFromKey(key);
    await mkdir(path.dirname(diskPath), { recursive: true });
    await writeFile(diskPath, buffer, { mode: 0o644 });
    if (process.env.NODE_ENV === "development") {
      console.info("[storage] local upload", localPublicPath(key));
    }
    return { key, url: localPublicPath(key), size: buffer.length };
  }

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
    const detail = hintForTlsMessage(describeS3Error(e));
    if (process.env.NODE_ENV === "development") {
      console.error("[storage] PutObject failed", detail);
    }
    throw new StorageError("UPLOAD", `S3: ${detail}`, { cause: e });
  }
  return { key, url: publicObjectUrl(key), size: buffer.length };
}

const FETCH_TIMEOUT_MS = Math.min(
  Number.parseInt(process.env.STORAGE_FETCH_TIMEOUT_MS ?? "300000", 10) || 300_000,
  600_000,
);

export async function fetchUrlToBuffer(sourceUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
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
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

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
  const { buffer, contentType } = await fetchUrlToBuffer(sourceUrl);
  const up = await uploadFile(buffer, key, contentType);
  return {
    ...up,
    contentType,
    sourceUrl: sourceUrl,
  };
}

/**
 * S3: presigned GET. Local: абсолютный URL (файл отдаётся Next как static из /public).
 */
export async function getSignedUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  void expiresInSeconds;
  if (isLocalUploadStorageEffective()) {
    assertLocalStorageAllowedInThisEnv();
    assertSafeLocalKey(key);
    return toAbsoluteIfAppPath(localPublicPath(key));
  }
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

/** Чтение файла из local uploads или S3 по storageKey (для vision/classifier на сервере). */
export async function readStoredFileByKey(key: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  if (isLocalUploadStorageEffective()) {
    assertLocalStorageAllowedInThisEnv();
    const diskPath = localDiskPathFromKey(key);
    const buffer = await readFile(diskPath);
    const ext = path.extname(diskPath).toLowerCase();
    const byExt: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };
    return { buffer, contentType: byExt[ext] ?? "image/jpeg" };
  }

  const client = getClient();
  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
      }),
    );
    const bytes = await res.Body?.transformToByteArray();
    const buffer = Buffer.from(bytes ?? []);
    const contentType =
      res.ContentType?.split(";")[0]?.trim() || "application/octet-stream";
    return { buffer, contentType };
  } catch (e) {
    throw new StorageError("DOWNLOAD", `S3: ${describeS3Error(e)}`, { cause: e });
  }
}

export async function deleteFile(key: string): Promise<void> {
  if (isLocalUploadStorageEffective()) {
    assertLocalStorageAllowedInThisEnv();
    try {
      await unlink(localDiskPathFromKey(key));
    } catch (e) {
      const err = e as { code?: string };
      if (err?.code === "ENOENT") return;
      throw new StorageError("DELETE", "Локальное хранилище: не удалось удалить файл", {
        cause: e,
      });
    }
    return;
  }
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

/**
 * Безопасная проверка чтения бакета (ListObjects, max 1) — для монитора, без Put/Delete.
 */
export async function probeS3BucketListAccess(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (isLocalUploadStorageEffective()) {
    return { ok: true, message: "Local storage: S3 not used" };
  }
  let client: S3Client;
  try {
    client = getClient();
  } catch (e) {
    const m =
      e instanceof StorageError
        ? e.message
        : e instanceof Error
          ? e.message
        : "S3 client error";
    return { ok: false, message: m };
  }
  try {
    await client.send(
      new ListObjectsV2Command({ Bucket: bucket(), MaxKeys: 1 }),
    );
    return { ok: true, message: "S3: bucket list (read) OK" };
  } catch (e) {
    return { ok: false, message: describeS3Error(e) };
  }
}
