/**
 * Публичный origin приложения (для доводки /uploads/... до абсолютного URL для провайдеров).
 * Не содержит секретов; безопасен для import из lib.
 */
export function getAppBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.AUTH_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

/**
 * Упрощённо: `/uploads/...` + база приложения → `http(s)://.../uploads/...`
 */
export function toAbsoluteIfAppPath(pathOrUrl: string): string {
  const t = pathOrUrl.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) {
    return `${getAppBaseUrl()}${t}`;
  }
  return `${getAppBaseUrl()}/${t.replace(/^\/+/, "")}`;
}
