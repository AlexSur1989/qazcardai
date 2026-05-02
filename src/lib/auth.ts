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

/**
 * Куда отправить уже авторизованного пользователя с login/register.
 * Безопасный относительный путь из ?callbackUrl=… или дефолт: /admin (админы) / /dashboard.
 */
export function postAuthLandingPath(
  callbackUrlParam: string | null,
  role: UserRole | undefined
): string {
  if (
    typeof callbackUrlParam === "string" &&
    callbackUrlParam.startsWith("/") &&
    !callbackUrlParam.startsWith("//")
  ) {
    const pathOnly =
      callbackUrlParam.split("?")[0]?.split("#")[0] ?? callbackUrlParam;
    if (!AUTH_FLOW_PATHS.has(pathOnly)) {
      return callbackUrlParam;
    }
  }
  if (role && canAccessAdminPanel(role)) return "/admin";
  return "/dashboard";
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}
