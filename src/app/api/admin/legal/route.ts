import { NextResponse } from "next/server";

import { getAdminLegalPages } from "@/server/services/legalPages";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApiPermission("legal.manage");
  if (!gate.ok) {
    return gate.response;
  }
  const items = await getAdminLegalPages();
  return NextResponse.json({ items });
}
