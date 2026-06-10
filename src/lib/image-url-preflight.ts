/**
 * Диагностика доступности публичного URL изображения (HEAD/GET, редиректы, magic bytes).
 * Без server-only — используется в verify-скриптах и на сервере.
 */

const IMAGE_MIME_PREFIX = /^image\//i;

const PREFLIGHT_TIMEOUT_MS = Math.min(
  Number.parseInt(process.env.IMAGE_PREFLIGHT_TIMEOUT_MS ?? "15000", 10) || 15_000,
  60_000,
);

const MIN_READABLE_BYTES = 64;
const MAX_PREFLIGHT_BYTES = Math.min(
  Number.parseInt(process.env.IMAGE_PREFLIGHT_MAX_BYTES ?? "5242880", 10) || 5_242_880,
  20_971_520,
);

export type ImageUrlPreflightResult = {
  url: string;
  ok: boolean;
  method: "HEAD" | "GET";
  statusCode: number | null;
  contentType: string | null;
  contentLength: number | null;
  redirectChain: string[];
  readableBytes: number | null;
  imageMagicOk: boolean;
  error?: string;
};

function looksLikeImageBytes(b: Buffer): boolean {
  if (b.length < 3) return false;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") {
    return true;
  }
  if (b.length >= 6) {
    const s = b.subarray(0, 6).toString("ascii");
    if (s === "GIF87a" || s === "GIF89a") return true;
  }
  return false;
}

function parseContentLength(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Хосты, с которых Kie часто не может скачать файл напрямую (S3/CDN приложения). */
export function isDirectUrlTrustedForKieExternalFetch(
  url: string,
  preflight: Pick<ImageUrlPreflightResult, "ok" | "redirectChain" | "contentType" | "imageMagicOk">,
): boolean {
  if (!preflight.ok || !preflight.imageMagicOk) return false;
  const ct = preflight.contentType?.trim().toLowerCase() ?? "";
  if (ct && !IMAGE_MIME_PREFIX.test(ct)) return false;
  if (preflight.redirectChain.length > 3) return false;

  const host = hostnameFromUrl(url);
  if (!host) return false;

  const s3Public = process.env.S3_PUBLIC_URL?.trim();
  if (s3Public) {
    try {
      const s3Host = new URL(s3Public).hostname.toLowerCase();
      if (host === s3Host) return false;
    } catch {
      // ignore
    }
  }

  const appBase = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (appBase) {
    try {
      const appHost = new URL(appBase).hostname.toLowerCase();
      if (host === appHost && url.includes("/uploads/")) return false;
    } catch {
      // ignore
    }
  }

  if (host.includes("pscloud.io") || host.includes("object.storage")) return false;

  return true;
}

async function fetchWithRedirectTrace(
  url: string,
  method: "HEAD" | "GET",
): Promise<{
  response: Response;
  redirectChain: string[];
}> {
  const redirectChain: string[] = [];
  let current = url;
  const maxRedirects = 8;

  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(current, {
      method,
      redirect: "manual",
      headers: { "User-Agent": "qazcard-image-preflight/1.0", Accept: "image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        return { response: res, redirectChain };
      }
      redirectChain.push(current);
      try {
        current = new URL(loc, current).href;
      } catch {
        return { response: res, redirectChain };
      }
      continue;
    }

    return { response: res, redirectChain };
  }

  throw new Error("Слишком длинная цепочка редиректов");
}

export async function preflightImageUrl(url: string): Promise<ImageUrlPreflightResult> {
  const trimmed = url.trim();
  const base: ImageUrlPreflightResult = {
    url: trimmed,
    ok: false,
    method: "HEAD",
    statusCode: null,
    contentType: null,
    contentLength: null,
    redirectChain: [],
    readableBytes: null,
    imageMagicOk: false,
  };

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return { ...base, error: "URL должен быть http(s)" };
  }

  try {
    let headRes: Response;
    let redirectChain: string[] = [];
    try {
      const head = await fetchWithRedirectTrace(trimmed, "HEAD");
      headRes = head.response;
      redirectChain = head.redirectChain;
    } catch (e) {
      return {
        ...base,
        error: e instanceof Error ? e.message : "HEAD failed",
      };
    }

    base.redirectChain = redirectChain;
    base.statusCode = headRes.status;
    base.contentType = headRes.headers.get("content-type")?.split(";")[0]?.trim() ?? null;
    base.contentLength = parseContentLength(headRes.headers.get("content-length"));

    base.method = "GET";
    const get = await fetchWithRedirectTrace(trimmed, "GET");
    const getRes = get.response;
    if (get.redirectChain.length > redirectChain.length) {
      base.redirectChain = get.redirectChain;
    }

    base.statusCode = getRes.status;
    base.contentType = getRes.headers.get("content-type")?.split(";")[0]?.trim() ?? base.contentType;
    base.contentLength = parseContentLength(getRes.headers.get("content-length")) ?? base.contentLength;

    if (!getRes.ok) {
      return {
        ...base,
        error: `HTTP ${getRes.status}`,
      };
    }

    const buf = Buffer.from(await getRes.arrayBuffer());
    const limited = buf.subarray(0, MAX_PREFLIGHT_BYTES);
    base.readableBytes = limited.length;
    base.imageMagicOk = looksLikeImageBytes(limited);

    const mimeOk = !base.contentType || IMAGE_MIME_PREFIX.test(base.contentType);
    base.ok =
      base.readableBytes >= MIN_READABLE_BYTES &&
      base.imageMagicOk &&
      mimeOk;

    if (!base.ok) {
      base.error =
        base.readableBytes < MIN_READABLE_BYTES
          ? "Недостаточно байт изображения"
          : !base.imageMagicOk
            ? "Файл не распознан как изображение"
            : "Некорректный content-type";
    }

    return base;
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : "preflight error",
    };
  }
}

export async function downloadImageUrlBytes(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const get = await fetchWithRedirectTrace(url.trim(), "GET");
  const res = get.response;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} при скачивании изображения`);
  }
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_PREFLIGHT_BYTES) {
    throw new Error("Изображение превышает лимит preflight");
  }
  if (!looksLikeImageBytes(buffer.subarray(0, Math.min(buffer.length, 4096)))) {
    throw new Error("Файл не распознан как изображение");
  }
  return { buffer, contentType };
}
