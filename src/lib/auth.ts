import type { UserRole } from "@/generated/prisma/enums";

/** Доступ к разделу /admin: только ADMIN и SUPER_ADMIN (см. PROJECT_SPEC.md). */
export function canAccessAdminPanel(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}
