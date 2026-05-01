/**
 * Если публичный URL не задан, подставляем с Vercel (VERCEL_URL).
 * Срабатывает в Node (instrumentation, API routes) — тогда process.env обычно можно менять.
 * Кастомный домен: задайте AUTH_URL / NEXTAUTH_URL в панели хостинга.
 *
 * Development + телефон в LAN: в next-auth запрос к /api/auth/* подменяется на origin из
 * AUTH_URL (`reqWithEnvURL`). Если в .env указан http://localhost:3000, а открываете
 * http://192.168.x.x:3000 — сессия и вход с телефона ломаются. В development сбрасываем
 * AUTH_URL/NEXTAUTH_URL, если они указывают на loopback; дальше работает trustHost + реальный Host.
 * Удержать старое поведение: KEEP_DEV_LOCALHOST_AUTH_URL=1
 */
function authUrlHostIsLoopback(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function devStripLocalhostAuthUrl(): void {
  if (process.env.NODE_ENV !== "development") return;
  if (
    process.env.KEEP_DEV_LOCALHOST_AUTH_URL === "1" ||
    process.env.KEEP_DEV_LOCALHOST_AUTH_URL === "true"
  ) {
    return;
  }
  for (const key of ["AUTH_URL", "NEXTAUTH_URL"] as const) {
    const v = process.env[key]?.trim();
    if (!v || !authUrlHostIsLoopback(v)) continue;
    try {
      delete process.env[key];
    } catch {
      process.env[key] = "";
    }
  }
}

function apply(): void {
  if (typeof process === "undefined" || !process.env) return;
  devStripLocalhostAuthUrl();
  if (process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim()) {
    return;
  }
  const v = process.env.VERCEL_URL?.trim();
  if (!v) return;
  const base =
    v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`;
  try {
    process.env.AUTH_URL = base;
    process.env.NEXTAUTH_URL = base;
  } catch {
    /* Edge / замороженный env — задайте AUTH_URL в панели хостинга */
  }
}

apply();
