import { NextResponse } from "next/server";

import { getFinanceSummary } from "@/server/services/financeAdmin";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
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
