import { NextResponse } from "next/server";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { isSuperAdmin } from "@/lib/auth";
import { ensureDefaultLegalPages } from "@/server/services/legalPages";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

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
  const { created, createdSlugs } = await ensureDefaultLegalPages();
  await writeAdminAuditLog({
    adminUserId: current.user.id,
    action: "LEGAL_PAGES_DEFAULTS_SEEDED",
    targetType: "LegalPage",
    targetId: null,
    newValue: { created, slugs: createdSlugs },
  });
  return NextResponse.json({ created, createdSlugs });
}
