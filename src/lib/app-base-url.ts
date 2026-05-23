import { getPublicAppUrl } from "@/lib/auth-public-url";

/**
 * Публичный origin приложения (для доводки /uploads/... до абсолютного URL для провайдеров).
 * Не содержит секретов; безопасен для import из lib.
 */
export function getAppBaseUrl(): string {
  return getPublicAppUrl();
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
