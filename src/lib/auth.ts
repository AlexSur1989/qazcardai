import type { UserRole } from "@/generated/prisma/enums";

/** Доступ к разделу /admin: только ADMIN и SUPER_ADMIN (см. PROJECT_SPEC.md). */
export function canAccessAdminPanel(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

const AUTH_FLOW_PATHS = new Set([
  "/auth/login",
  "/login",
  "/auth/register",
  "/register",
]);

/** Приоритет: next, затем callbackUrl (совместимость с NextAuth). */
export function pickLoginRedirectParam(
  next: string | null | undefined,
  callbackUrl: string | null | undefined,
): string | null {
  const n =
    typeof next === "string" && next.trim() ? next.trim() : null;
  const c =
    typeof callbackUrl === "string" && callbackUrl.trim()
      ? callbackUrl.trim()
      : null;
  return n ?? c ?? null;
}

/** Безопасный относительный путь для ?next= при редиректе со старых URL. */
export function normalizeNextPath(raw: string | null | undefined): string {
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/dashboard";
}

export function firstSearchParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const v = sp[key];
  if (typeof v === "string" && v) return v;
  if (Array.isArray(v) && typeof v[0] === "string" && v[0]) return v[0];
  return null;
}

export function buildPathQueryString(
  sp: Record<string, string | string[] | undefined>
): string {
  const u = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) u.append(key, item);
    } else {
      u.set(key, value);
    }
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

/**
 * Куда отправить уже авторизованного пользователя с login/register или после signIn.
 * Безопасный относительный путь из ?callbackUrl / ?next; без /admin для ролей без доступа.
 */
export function postAuthLandingPath(
  redirectParam: string | null,
  role: UserRole | undefined
): string {
  if (
    typeof redirectParam === "string" &&
    redirectParam.startsWith("/") &&
    !redirectParam.startsWith("//")
  ) {
    const pathOnly =
      redirectParam.split("?")[0]?.split("#")[0] ?? redirectParam;
    if (!AUTH_FLOW_PATHS.has(pathOnly)) {
      const isAdminPath =
        pathOnly === "/admin" || pathOnly.startsWith("/admin/");
      if (!isAdminPath || (role && canAccessAdminPanel(role))) {
        return redirectParam;
      }
    }
  }
  if (role && canAccessAdminPanel(role)) return "/admin";
  return "/dashboard";
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}
