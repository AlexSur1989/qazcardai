/**
 * IP клиента за reverse proxy (Nginx, Docker).
 * Не используется для однозначной идентификации, только для rate limit по соседству.
 */
export function getClientIpFromHeaders(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const real = h.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 128);
  return "unknown";
}

export function getClientIpFromRequest(req: Request): string {
  return getClientIpFromHeaders(req.headers);
}
