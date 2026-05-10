import { NextResponse } from "next/server";

import { getFinanceSummary } from "@/server/services/financeAdmin";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireAdminApiPermission("finance.view");
  if (!gate.ok) {
    return gate.response;
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const fromD = from ? new Date(from) : undefined;
  const toD = to ? new Date(to) : undefined;
  if (fromD && Number.isNaN(fromD.getTime())) {
    return NextResponse.json({ error: "invalid_from" }, { status: 400 });
  }
  if (toD && Number.isNaN(toD.getTime())) {
    return NextResponse.json({ error: "invalid_to" }, { status: 400 });
  }
  const data = await getFinanceSummary({ from: fromD, to: toD });
  return NextResponse.json(data);
}
