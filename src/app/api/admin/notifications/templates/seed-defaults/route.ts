import { NextResponse } from "next/server";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { ensureDefaultEmailTemplates } from "@/server/services/emailTemplates";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

export async function POST() {
  const gate = await requireAdminApiPermission("notifications.manage");
  if (!gate.ok) {
    return gate.response;
  }
  const { upserted } = await ensureDefaultEmailTemplates();
  await writeAdminAuditLog({
    adminUserId: gate.user.id,
    action: "EMAIL_TEMPLATES_SEED_DEFAULTS",
    targetType: "EmailTemplate",
    targetId: "seed",
    newValue: { upserted },
  });
  return NextResponse.json({ ok: true, upserted });
}
