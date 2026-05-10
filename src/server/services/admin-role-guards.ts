import type { UserRole, UserStatus } from "@/generated/prisma/enums";
import { canStaffBlockTargetRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function countActiveSuperAdmins(): Promise<number> {
  return prisma.user.count({
    where: { role: "SUPER_ADMIN", status: "ACTIVE" },
  });
}

/** Блокирует снятие последнего активного SUPER_ADMIN со статуса ACTIVE или блокировку. */
export async function wouldRemoveLastSuperAdmin(args: {
  targetUserId: string;
  targetCurrentRole: UserRole;
  nextStatus?: UserStatus;
  nextRole?: UserRole;
}): Promise<boolean> {
  const { targetUserId, targetCurrentRole, nextStatus, nextRole } = args;
  if (targetCurrentRole !== "SUPER_ADMIN") return false;

  const becomesNonSuper =
    (nextRole != null && nextRole !== "SUPER_ADMIN") ||
    (nextStatus != null && nextStatus !== "ACTIVE");

  if (!becomesNonSuper) return false;

  const other = await prisma.user.count({
    where: {
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      NOT: { id: targetUserId },
    },
  });
  return other === 0;
}

export async function assertActorMayBlockTarget(
  actorRole: UserRole,
  targetRole: UserRole,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!canStaffBlockTargetRole(actorRole, targetRole)) {
    return {
      ok: false,
      message: "Недостаточно прав для блокировки этой учётной записи",
    };
  }
  return { ok: true };
}
