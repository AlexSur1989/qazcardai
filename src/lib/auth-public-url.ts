const PUBLIC_URL_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "APP_URL",
  "AUTH_URL",
  "NEXTAUTH_URL",
] as const;

function isProductionNodeEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

function readFirstPublicUrlEnv(): string | undefined {
  for (const key of PUBLIC_URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function parsePublicUrlInput(raw: string): URL {
  const trimmed = raw.trim();
  const withScheme =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  return new URL(withScheme);
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

function isUnusableBrowserHostname(hostname: string): boolean {
  return hostname === "0.0.0.0" || hostname === "[::]" || hostname === "::";
}

/**
 * Нормализует публичный URL приложения для browser-facing redirect/callback.
 * 0.0.0.0 в development → localhost; в production — ошибка конфигурации.
 */
export function normalizePublicAppUrlRaw(
  raw: string,
  options?: { production?: boolean },
): string {
  const production = options?.production ?? isProductionNodeEnv();
  const url = parsePublicUrlInput(raw);

  if (isUnusableBrowserHostname(url.hostname)) {
    if (production) {
      throw new Error("Публичный URL приложения не может использовать 0.0.0.0");
    }
    url.hostname = "localhost";
  }

  if (production && isLoopbackHostname(url.hostname)) {
    throw new Error(
      "Публичный URL приложения не может использовать localhost в production",
    );
  }

  return `${url.protocol}//${url.host}`;
}

/** Безопасный origin для ссылок в письмах (reset password и т.д.). */
export function resolvePublicOriginFromRequest(req: Request): string {
  if (isProductionNodeEnv()) {
    return getPublicAppUrl();
  }

  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  if (forwardedHost) {
    const hostname = forwardedHost.split(":")[0] ?? forwardedHost;
    if (!isUnusableBrowserHostname(hostname)) {
      return `${forwardedProto}://${forwardedHost}`;
    }
  }

  const host = req.headers.get("host")?.trim();
  if (host) {
    const hostname = host.split(":")[0] ?? host;
    if (!isUnusableBrowserHostname(hostname)) {
      const proto =
        req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
      return `${proto}://${host}`;
    }
  }

  try {
    const origin = new URL(req.url).origin;
    const hostname = new URL(origin).hostname;
    if (!isUnusableBrowserHostname(hostname)) {
      return origin;
    }
  } catch {
    /* ignore */
  }

  return getPublicAppUrl();
}

/** Отбрасывает 0.0.0.0 / localhost в production для ссылок из писем. */
export function sanitizePublicLinkBaseUrl(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const url = parsePublicUrlInput(trimmed);
    if (isUnusableBrowserHostname(url.hostname)) return null;
    if (isProductionNodeEnv() && isLoopbackHostname(url.hostname)) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** Публичный origin приложения (browser-facing). Без trailing slash. */
export function getPublicAppUrl(): string {
  const raw = readFirstPublicUrlEnv();
  if (raw) {
    return normalizePublicAppUrlRaw(raw);
  }

  if (isProductionNodeEnv()) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL или APP_URL должны быть заданы в production",
    );
  }

  return "http://localhost:3000";
}

/** Абсолютный URL для redirect пользователя (path начинается с /). */
export function buildPublicAppRedirect(path: string): string {
  const base = getPublicAppUrl();
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${safePath}`;
}

/** @deprecated Используйте getPublicAppUrl */
export function getAuthPublicOrigin(): string {
  return getPublicAppUrl();
}

export function authUsesSecureCookies(): boolean {
  try {
    return getPublicAppUrl().startsWith("https:");
  } catch {
    const raw = readFirstPublicUrlEnv();
    return raw?.startsWith("https:") ?? false;
  }
}
