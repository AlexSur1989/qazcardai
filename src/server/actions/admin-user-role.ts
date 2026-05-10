"use server";

import { revalidatePath } from "next/cache";

import type { UserRole } from "@/generated/prisma/enums";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getAdminRateLimitError } from "@/server/services/rateLimitService";
import { wouldRemoveLastSuperAdmin } from "@/server/services/admin-role-guards";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export type AdminUserRoleState = { error?: string; ok?: boolean } | null;

const ASSIGNABLE_ROLES = new Set<UserRole>([
  "USER",
  "MODERATOR",
  "ADMIN",
  "SUPER_ADMIN",
]);

export async function updateAdminUserRoleAction(
  _prev: AdminUserRoleState,
  formData: FormData,
): Promise<AdminUserRoleState> {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return { error: "Нет доступа" };
  }
  if (!hasPermission(current.user.role, "users.change_role")) {
    return { error: "Только SUPER_ADMIN может менять роли" };
  }
  const rateErr = await getAdminRateLimitError(current.user.id);
  if (rateErr) return { error: rateErr };

  const userId = String(formData.get("userId") ?? "").trim();
  const nextRoleRaw = String(formData.get("role") ?? "").trim();
  if (!userId) return { error: "Нет userId" };
  const nextRole = nextRoleRaw as UserRole;

  if (!ASSIGNABLE_ROLES.has(nextRole)) {
    return { error: "Некорректная роль" };
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!existing) return { error: "Пользователь не найден" };

  if (existing.role === nextRole) return { ok: true };

  const orphanSuper = await wouldRemoveLastSuperAdmin({
    targetUserId: userId,
    targetCurrentRole: existing.role,
    nextRole,
  });
  if (orphanSuper) {
    return {
      error:
        "Нельзя изменить последнего SUPER_ADMIN: нужен хотя бы один активный суперадмин.",
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: nextRole },
  });

  await writeAdminAuditLog({
    adminUserId: current.user.id,
    adminRole: current.user.role,
    action: "role_changed",
    targetType: "User",
    targetId: userId,
    oldValue: { role: existing.role },
    newValue: { role: nextRole },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/audit-logs");

  return { ok: true };
}
