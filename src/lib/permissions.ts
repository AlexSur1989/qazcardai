/**
 * RBAC для админ-панели: роли USER / MODERATOR / ADMIN / SUPER_ADMIN.
 */

import type { AppSettingGroupId } from "@/config/app-settings-registry";
import type { UserRole } from "@/generated/prisma/enums";

export type Permission =
  | "admin.access"
  | "overview.view"
  | "api_logs.view"
  | "launch_checklist.view"
  | "launch_checklist.manage"
  | "users.view"
  | "users.block"
  | "users.change_role"
  | "users.adjust_balance"
  | "models.view"
  | "models.manage"
  | "models.pricing.manage"
  | "models.product_card.manage"
  | "generations.view_all"
  | "generations.moderate"
  | "generations.refund"
  | "payments.view"
  | "payments.manage"
  | "promocodes.manage"
  | "settings.view"
  | "settings.manage"
  | "settings.critical.manage"
  | "legal.manage"
  | "audit.view"
  | "moderation.access"
  | "moderation.logs_view"
  | "webhooks.view"
  | "webhooks.manage"
  | "storage.manage"
  | "notifications.view"
  | "notifications.manage"
  | "providers.view"
  | "providers.manage"
  | "finance.view"
  | "finance.manage"
  | "credit_transactions.view"
  | "seo.manage"
  | "token_packages.view"
  | "token_packages.manage";

const ALL_PERMISSIONS: readonly Permission[] = [
  "admin.access",
  "overview.view",
  "api_logs.view",
  "launch_checklist.view",
  "launch_checklist.manage",
  "users.view",
  "users.block",
  "users.change_role",
  "users.adjust_balance",
  "models.view",
  "models.manage",
  "models.pricing.manage",
  "models.product_card.manage",
  "generations.view_all",
  "generations.moderate",
  "generations.refund",
  "payments.view",
  "payments.manage",
  "promocodes.manage",
  "settings.view",
  "settings.manage",
  "settings.critical.manage",
  "legal.manage",
  "audit.view",
  "moderation.access",
  "moderation.logs_view",
  "webhooks.view",
  "webhooks.manage",
  "storage.manage",
  "notifications.view",
  "notifications.manage",
  "providers.view",
  "providers.manage",
  "finance.view",
  "finance.manage",
  "credit_transactions.view",
  "seo.manage",
  "token_packages.view",
  "token_packages.manage",
];

const SUPER_SET = new Set<Permission>(ALL_PERMISSIONS);

const MODERATOR_SET = new Set<Permission>([
  "admin.access",
  "moderation.access",
  "generations.view_all",
  "generations.moderate",
  "users.view",
  "users.block",
  "moderation.logs_view",
]);

const ADMIN_SET = new Set<Permission>([
  "admin.access",
  "overview.view",
  "users.view",
  "users.block",
  "users.adjust_balance",
  "models.view",
  "models.manage",
  "models.pricing.manage",
  "models.product_card.manage",
  "generations.view_all",
  "generations.moderate",
  "generations.refund",
  "payments.view",
  "payments.manage",
  "promocodes.manage",
  "settings.view",
  "settings.manage",
  "legal.manage",
  "audit.view",
  "moderation.access",
  "moderation.logs_view",
  "webhooks.view",
  "providers.view",
  "finance.view",
  "finance.manage",
  "credit_transactions.view",
  "seo.manage",
  "token_packages.view",
  "token_packages.manage",
]);

const ROLE_MATRIX: Record<UserRole, ReadonlySet<Permission>> = {
  USER: new Set(),
  MODERATOR: MODERATOR_SET,
  ADMIN: ADMIN_SET,
  SUPER_ADMIN: SUPER_SET,
};

/** Проверка права для роли. */
export function hasPermission(role: UserRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_MATRIX[role]?.has(permission) ?? false;
}

export function listPermissions(role: UserRole): readonly Permission[] {
  return [...(ROLE_MATRIX[role] ?? new Set())];
}

type RoleHolder = { role: UserRole };

export function isSuperAdmin(roleOrUser: UserRole | RoleHolder): boolean {
  const r =
    typeof roleOrUser === "object" &&
    roleOrUser !== null &&
    "role" in roleOrUser
      ? roleOrUser.role
      : (roleOrUser as UserRole);
  return r === "SUPER_ADMIN";
}

export function isAdminRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isModeratorRole(role: UserRole): boolean {
  return role === "MODERATOR";
}

/** Доступ в зону `/admin*` (до редиректа модератора и проверки маршрута). */
export function canAccessAdminPanel(
  roleOrUser: UserRole | null | undefined | RoleHolder,
): boolean {
  const role =
    roleOrUser != null &&
    typeof roleOrUser === "object" &&
    "role" in roleOrUser
      ? roleOrUser.role
      : (roleOrUser as UserRole | null | undefined);
  return hasPermission(role ?? "USER", "admin.access");
}

/** Синхронная проверка для server actions / сервисов; при отказе — throw. */
export function requirePermission(
  role: UserRole | null | undefined,
  permission: Permission,
): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}

export function isAdmin(user: RoleHolder): boolean {
  return isAdminRole(user.role);
}

export function isModerator(user: RoleHolder): boolean {
  return isModeratorRole(user.role);
}

/** Куда вести при входе в админку. */
export function defaultAdminLandingPath(role: UserRole): string {
  if (role === "MODERATOR") return "/admin/moderation";
  return "/admin";
}

export function appSettingPatchRequiresCriticalManage(entry: {
  group: AppSettingGroupId;
  sensitive: boolean;
}): boolean {
  return entry.sensitive || entry.group === "maintenance";
}

const MODERATOR_PATH_PREFIXES = [
  "/admin/moderation",
  "/admin/generations",
  "/admin/users",
] as const;

/**
 * Страницы `/admin/**`, которые MODERATOR может посещать.
 * Корень `/admin` — редирект на `/admin/moderation` в middleware.
 */
export function isModeratorAllowedAdminPath(pathname: string): boolean {
  const p = pathname.split("?")[0] ?? pathname;
  for (const prefix of MODERATOR_PATH_PREFIXES) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

/** Роли «персонал» для обхода maintenance (кабинет + админка). */
export function isStaffMaintenanceRole(role: unknown): role is UserRole {
  return role === "MODERATOR" || role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Может ли актор ограничить целевую роль блокировкой. */
export function canStaffBlockTargetRole(
  actorRole: UserRole,
  targetRole: UserRole,
): boolean {
  if (targetRole === "SUPER_ADMIN") {
    return actorRole === "SUPER_ADMIN";
  }
  if (targetRole === "ADMIN") {
    return actorRole === "SUPER_ADMIN";
  }
  if (targetRole === "MODERATOR") {
    return actorRole === "ADMIN" || actorRole === "SUPER_ADMIN";
  }
  return true;
}

