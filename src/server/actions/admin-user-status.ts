"use server";

import { revalidatePath } from "next/cache";

import type { UserStatus } from "@/generated/prisma/enums";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getAdminRateLimitError } from "@/server/services/rateLimitService";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
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
    select: { id: true, status: true },
  });
  if (!existing) return { error: "Пользователь не найден" };
  if (existing.status === next) {
    return { ok: true };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: next },
  });

  await writeAdminAuditLog({
    adminUserId: current.user.id,
    action: "user.status_changed",
    targetType: "User",
    targetId: userId,
    oldValue: { status: existing.status },
    newValue: { status: next },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/audit-logs");
  return { ok: true };
}
