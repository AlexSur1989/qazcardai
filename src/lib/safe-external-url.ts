/**
 * Проверка URL перед серверным fetch (HEAD/GET) — снижение риска SSRF.
 * Не полная защита от DNS-rebinding, но блокирует localhost и частные сети в явном виде.
 */

function ipv4ToInt(ip: string): number | null {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  const a = p.map((x) => Number.parseInt(x, 10));
  if (a.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((a[0]! << 24) | (a[1]! << 16) | (a[2]! << 8) | a[3]!) >>> 0;
}

function isPrivateOrBlockedIpv4(n: number): boolean {
  const b0 = (n >>> 24) & 255;
  const b1 = (n >>> 16) & 255;
  if (b0 === 0 || b0 === 10 || b0 === 127) return true;
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
  if (b0 === 192 && b1 === 168) return true;
  if (b0 === 169 && b1 === 254) return true;
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "::1",
  "0000:0000:0000:0000:0000:0000:0000:0001",
]);

export function isUrlSafeForServerRequest(urlStr: string): { ok: true; url: URL } | { ok: false; error: string } {
  const t = urlStr?.trim() ?? "";
  if (!t) return { ok: false, error: "Empty URL" };
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "Only http/https" };
  }
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]") {
    return { ok: false, error: "Blocked hostname" };
  }
  if (BLOCKED_HOSTNAMES.has(h) || h.endsWith(".local") || h.endsWith(".internal")) {
    return { ok: false, error: "Blocked hostname" };
  }
  if (h.includes(":") && !h.includes(".")) {
    const low = h.toLowerCase();
    if (low === "::1" || low === "0:0:0:0:0:0:0:1") {
      return { ok: false, error: "Blocked IPv6" };
    }
    if (
      low.startsWith("fe80:") ||
      low.startsWith("fc") ||
      low.startsWith("fd") ||
      (low.length >= 2 && low[0] === "f" && low[1] === "f")
    ) {
      return { ok: false, error: "Blocked IPv6 range" };
    }
  }
  const v4 = ipv4ToInt(h);
  if (v4 != null) {
    if (isPrivateOrBlockedIpv4(v4)) {
      return { ok: false, error: "Blocked IPv4" };
    }
  }
  return { ok: true, url: u };
}
