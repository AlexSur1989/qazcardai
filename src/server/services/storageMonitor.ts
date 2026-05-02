
import { Prisma } from "@/generated/prisma/client";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { parseOutputFilesList } from "@/lib/generation-output-utils";
import { prisma } from "@/lib/prisma";
import { isLocalUploadStorageEffective, isUploadStorageLocalExplicitInProduction } from "@/lib/upload-storage-mode";
import { isUrlSafeForServerRequest } from "@/lib/safe-external-url";
import {
  isStorageConfigured,
  probeS3BucketListAccess,
} from "@/server/services/storage";

const REQUIRED = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET",
  "S3_PUBLIC_URL",
] as const;

function envTrim(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export type StorageConfigStatus = {
  mode: "s3" | "local" | "not_configured";
  s3EndpointConfigured: boolean;
  s3BucketConfigured: boolean;
  s3PublicUrlConfigured: boolean;
  s3RegionConfigured: boolean;
  accessKeyConfigured: boolean;
  secretKeyConfigured: boolean;
  endpoint: string;
  bucket: string;
  publicUrl: string;
  region: string;
};

export function getStorageConfigStatus(): StorageConfigStatus {
  const endpoint = envTrim("S3_ENDPOINT");
  const bucket = envTrim("S3_BUCKET");
  const publicUrl = envTrim("S3_PUBLIC_URL");
  const region = envTrim("S3_REGION");
  const hasAccess = envTrim("S3_ACCESS_KEY_ID").length > 0;
  const hasSecret = envTrim("S3_SECRET_ACCESS_KEY").length > 0;

  const s3EndpointConfigured = endpoint.length > 0;
  const s3BucketConfigured = bucket.length > 0;
  const s3PublicUrlConfigured = publicUrl.length > 0;
  const s3RegionConfigured = region.length > 0;

  let mode: StorageConfigStatus["mode"];
  if (isLocalUploadStorageEffective()) {
    mode = "local";
  } else if (
    REQUIRED.every((n) => envTrim(n).length > 0) &&
    isStorageConfigured()
  ) {
    mode = "s3";
  } else {
    mode = "not_configured";
  }

  return {
    mode,
    s3EndpointConfigured,
    s3BucketConfigured,
    s3PublicUrlConfigured,
    s3RegionConfigured,
    accessKeyConfigured: hasAccess,
    secretKeyConfigured: hasSecret,
    endpoint: endpoint || "вЂ”",
    bucket: bucket || "вЂ”",
    publicUrl: publicUrl || "вЂ”",
    region: region || "вЂ”",
  };
}

export type StorageStats = {
  uploadedFilesCount: number;
  uploadedFilesSize: number;
  generatedFilesCount: number;
  generatedFilesSize: number | null;
  filesMissingStorageKeyCount: number;
};

export async function getStorageStats(): Promise<StorageStats> {
  const [agg, missingKey, generations] = await Promise.all([
    prisma.uploadedFile.aggregate({
      _count: { id: true },
      _sum: { size: true },
    }),
    prisma.uploadedFile.count({ where: { storageKey: "" } }),
    prisma.generation.findMany({
      where: { outputFiles: { not: Prisma.JsonNull } },
      select: { outputFiles: true },
    }),
  ]);

  let gCount = 0;
  let gSizeSum = 0;
  let hasAnySize = false;
  for (const g of generations) {
    const list = parseOutputFilesList(g.outputFiles);
    gCount += list.length;
    for (const f of list) {
      if (typeof f.size === "number" && Number.isFinite(f.size)) {
        gSizeSum += f.size;
        hasAnySize = true;
      }
    }
  }
  const generatedFilesSize: number | null =
    gCount > 0 && !hasAnySize ? null : gSizeSum;

  return {
    uploadedFilesCount: agg._count.id,
    uploadedFilesSize: agg._sum.size ?? 0,
    generatedFilesCount: gCount,
    generatedFilesSize,
    filesMissingStorageKeyCount: missingKey,
  };
}

const FILE_SELECT = {
  id: true,
  fileName: true,
  fileType: true,
  mimeType: true,
  size: true,
  url: true,
  createdAt: true,
  userId: true,
  generationId: true,
  storageKey: true,
  metadata: true,
} as const;

type FileRow = {
  id: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  size: number;
  url: string | null;
  createdAt: Date;
  userId: string;
  generationId: string | null;
  storageKey: string;
  metadata: unknown;
};

function purposeFromMetadata(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== "object") return null;
  const p = (metadata as { purpose?: unknown }).purpose;
  return typeof p === "string" ? p : null;
}

function serializeFile(
  f: FileRow,
  userEmail: string | null,
): Record<string, unknown> {
  return {
    id: f.id,
    fileName: f.fileName,
    fileType: f.fileType,
    mimeType: f.mimeType,
    size: f.size,
    url: f.url,
    createdAt: f.createdAt.toISOString(),
    userId: f.userId,
    userEmail,
    generationId: f.generationId,
    storageKey: f.storageKey,
    purpose: purposeFromMetadata(f.metadata),
  };
}

export async function getRecentUploadedFiles(limit = 20) {
  const rows = await prisma.uploadedFile.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { ...FILE_SELECT, user: { select: { email: true } } },
  });
  return rows.map((r) => serializeFile(r, r.user?.email ?? null));
}

export async function getLargestUploadedFiles(limit = 20) {
  const rows = await prisma.uploadedFile.findMany({
    orderBy: { size: "desc" },
    take: limit,
    select: { ...FILE_SELECT, user: { select: { email: true } } },
  });
  return rows.map((r) => serializeFile(r, r.user?.email ?? null));
}

export function buildStorageWarnings(
  config: StorageConfigStatus,
  stats: StorageStats,
): string[] {
  const w: string[] = [];
  if (process.env.NODE_ENV === "production" && config.mode !== "s3") {
    w.push(
      "Production РґРѕР»Р¶РµРЅ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ S3/R2. Р›РѕРєР°Р»СЊРЅРѕРµ С…СЂР°РЅРµРЅРёРµ РЅР° VPS РЅРµР±РµР·РѕРїР°СЃРЅРѕ.",
    );
  }
  if (!isLocalUploadStorageEffective() && !envTrim("S3_PUBLIC_URL")) {
    w.push(
      "Kie.ai РјРѕР¶РµС‚ РЅРµ РѕС‚РєСЂС‹С‚СЊ Р·Р°РіСЂСѓР¶РµРЅРЅС‹Рµ С„Р°Р№Р»С‹ Р±РµР· РїСѓР±Р»РёС‡РЅРѕРіРѕ URL (S3_PUBLIC_URL).",
    );
  }
  if (stats.filesMissingStorageKeyCount > 0) {
    w.push(
      "РќРµРєРѕС‚РѕСЂС‹Рµ С„Р°Р№Р»С‹ РЅРµ РёРјРµСЋС‚ storageKey вЂ” РїСЂРѕРІРµСЂСЊС‚Рµ РґР°РЅРЅС‹Рµ.",
    );
  }
  if (isUploadStorageLocalExplicitInProduction()) {
    w.push("UPLOAD_STORAGE=local РІ production Р·Р°РїСЂРµС‰С‘РЅ (СЃРј. storage).");
  }
  return w;
}

export async function checkStorageConnectionForMonitor(): Promise<{
  ok: boolean;
  message: string;
  mode: StorageConfigStatus["mode"];
}> {
  const cfg = getStorageConfigStatus();
  if (cfg.mode === "local") {
    return {
      ok: true,
      message: "Local storage: OK (S3 not required in this mode).",
      mode: "local",
    };
  }
  if (cfg.mode === "not_configured") {
    return {
      ok: false,
      message:
        "S3/R2 is not fully configured. Set UPLOAD_STORAGE=s3 and all S3_* in .env.",
      mode: "not_configured",
    };
  }
  const p = await probeS3BucketListAccess();
  return {
    ok: p.ok,
    message: p.message,
    mode: "s3",
  };
}

const HEAD_TIMEOUT_MS = 15_000;

export async function checkPublicUrlAccess(
  urlStr: string,
): Promise<
  | {
      ok: true;
      statusCode: number;
      contentType: string;
      contentLength: string;
    }
  | { ok: false; error: string }
> {
  const safe = isUrlSafeForServerRequest(urlStr);
  if (!safe.ok) {
    return { ok: false, error: safe.error };
  }
  const u = safe.url;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS);
  try {
    const res = await fetch(u, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "QazCardAI-storage-monitor/1.0" },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const ct = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "вЂ”";
    const cl = res.headers.get("content-length") ?? "вЂ”";
    return {
      ok: true,
      statusCode: res.status,
      contentType: ct,
      contentLength: cl,
    };
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? "Timeout"
        : e instanceof Error
          ? e.message
        : "fetch failed";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}

export async function getStorageStatusPayload() {
  const [config, stats, recentFiles, largestFiles] = await Promise.all([
    Promise.resolve(getStorageConfigStatus()),
    getStorageStats(),
    getRecentUploadedFiles(20),
    getLargestUploadedFiles(20),
  ]);
  return {
    config,
    stats,
    recentFiles,
    largestFiles,
    warnings: buildStorageWarnings(config, stats),
  };
}

export async function runStorageCheckWithAudit(adminUserId: string) {
  const checkedAt = new Date().toISOString();
  const result = await checkStorageConnectionForMonitor();
  const metadata: Record<string, unknown> = {
    ok: result.ok,
    mode: result.mode,
    checkedAt,
  };
  void writeAdminAuditLog({
    adminUserId,
    action: "STORAGE_CHECK_RUN",
    targetType: "Storage",
    targetId: "S3",
    metadata,
  });
  return { ...result, message: result.message, checkedAt };
}
