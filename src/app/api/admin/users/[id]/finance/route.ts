import { NextResponse } from "next/server";

import { getUserFinanceSummary } from "@/server/services/financeAdmin";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: Ctx) {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  const { id } = await ctx.params;
  const data = await getUserFinanceSummary(id);
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
