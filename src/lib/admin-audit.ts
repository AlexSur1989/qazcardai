import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

export async function writeAdminAuditLog(args: {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: args.adminUserId,
      action: args.action.slice(0, 128),
      targetType: args.targetType.slice(0, 64),
      targetId: args.targetId ? args.targetId.slice(0, 64) : null,
      oldValue: toJsonValue(args.oldValue),
      newValue: toJsonValue(args.newValue),
      metadata: toJsonValue(args.metadata),
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
