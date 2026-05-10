"use server";

import { revalidatePath } from "next/cache";

import type { UserRole, UserStatus } from "@/generated/prisma/enums";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { hasPermission } from "@/lib/permissions";
import { getAdminRateLimitError } from "@/server/services/rateLimitService";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import {
  assertActorMayBlockTarget,
  wouldRemoveLastSuperAdmin,
} from "@/server/services/admin-role-guards";
import { prisma } from "@/lib/prisma";

export type AdminUserStatusState = { error?: string; ok?: boolean } | null;

const ALLOWED: UserStatus[] = ["ACTIVE", "INACTIVE", "BLOCKED", "PENDING_VERIFICATION"];

export async function updateUserStatusAction(
  _prev: AdminUserStatusState,
  formData: FormData,
): Promise<AdminUserStatusState> {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return { error: "Нет доступа" };
  }
  if (!hasPermission(current.user.role, "users.block")) {
    return { error: "Нет права менять статус пользователя" };
  }
  const rateErr = await getAdminRateLimitError(current.user.id);
  if (rateErr) return { error: rateErr };

  const userId = String(formData.get("userId") ?? "").trim();
  const next = String(formData.get("status") ?? "").trim() as UserStatus;

  if (!userId) return { error: "Нет userId" };
  if (!ALLOWED.includes(next)) {
    return { error: "Некорректный статус" };
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, role: true },
  });
  if (!existing) return { error: "Пользователь не найден" };
  if (existing.status === next) {
    return { ok: true };
  }

  const may = await assertActorMayBlockTarget(current.user.role, existing.role);
  if (!may.ok) return { error: may.message };

  const removingLastSuper = await wouldRemoveLastSuperAdmin({
    targetUserId: userId,
    targetCurrentRole: existing.role,
    nextStatus: next,
  });
  if (removingLastSuper) {
    return {
      error: "Нельзя заблокировать или деактивировать последнего SUPER_ADMIN.",
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: next },
  });

  const actionTag =
    next === "ACTIVE" ? "user_unblocked" : next === "BLOCKED" ? "user_blocked" : "user.status_changed";

  await writeAdminAuditLog({
    adminUserId: current.user.id,
    adminRole: current.user.role,
    action: actionTag,
    targetType: "User",
    targetId: userId,
    oldValue: { status: existing.status, role: existing.role },
    newValue: { status: next },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/audit-logs");
  return { ok: true };
}
