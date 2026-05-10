import { NextResponse } from "next/server";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { ensureDefaultLegalPages } from "@/server/services/legalPages";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

export async function POST() {
  const gate = await requireAdminApiPermission("legal.manage");
  if (!gate.ok) {
    return gate.response;
  }
  const { created, createdSlugs } = await ensureDefaultLegalPages();
  await writeAdminAuditLog({
    adminUserId: gate.user.id,
    action: "LEGAL_PAGES_DEFAULTS_SEEDED",
    targetType: "LegalPage",
    targetId: null,
    newValue: { created, slugs: createdSlugs },
  });
  return NextResponse.json({ created, createdSlugs });
}
