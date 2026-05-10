import { NextResponse } from "next/server";

import { getUserFinanceSummary } from "@/server/services/financeAdmin";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAdminApiPermission("finance.view");
  if (!gate.ok) {
    return gate.response;
  }
  const { id } = await ctx.params;
  const data = await getUserFinanceSummary(id);
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
