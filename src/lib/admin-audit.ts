import type { UserRole } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

export async function writeAdminAuditLog(args: {
  adminUserId: string;
  /** Попадает в metadata.actorRole (иммутабельный снимок роли на момент действия). */
  adminRole?: UserRole;
  action: string;
  targetType: string;
  targetId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}): Promise<void> {
  const mergedMeta =
    args.metadata !== undefined || args.adminRole !== undefined
      ? {
          ...(typeof args.metadata === "object" &&
          args.metadata !== null &&
          !Array.isArray(args.metadata)
            ? (args.metadata as Record<string, unknown>)
            : {}),
          ...(args.adminRole ? { actorRole: args.adminRole } : {}),
        }
      : undefined;

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: args.adminUserId,
      action: args.action.slice(0, 128),
      targetType: args.targetType.slice(0, 64),
      targetId: args.targetId ? args.targetId.slice(0, 64) : null,
      oldValue: toJsonValue(args.oldValue),
      newValue: toJsonValue(args.newValue),
      metadata: toJsonValue(mergedMeta),
    },
  });
}

function toJsonValue(
  v: unknown,
):
  | Prisma.InputJsonValue
  | typeof Prisma.JsonNull
  | undefined {
  if (v === undefined) return undefined;
  if (v === null) return Prisma.JsonNull;
  return v as Prisma.InputJsonValue;
}
