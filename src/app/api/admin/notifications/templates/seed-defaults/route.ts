import { NextResponse } from "next/server";

import { isSuperAdmin } from "@/lib/auth";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { ensureDefaultEmailTemplates } from "@/server/services/emailTemplates";

export const dynamic = "force-dynamic";

export async function POST() {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  if (!isSuperAdmin(current.user.role)) {
    return NextResponse.json({ error: "super_admin_only" }, { status: 403 });
  }
  const { upserted } = await ensureDefaultEmailTemplates();
  await writeAdminAuditLog({
    adminUserId: current.user.id,
    action: "EMAIL_TEMPLATES_SEED_DEFAULTS",
    targetType: "EmailTemplate",
    targetId: "seed",
    newValue: { upserted },
  });
  return NextResponse.json({ ok: true, upserted });
}
