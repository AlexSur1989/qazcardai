import { NextResponse } from "next/server";

import { runKieProviderCheckWithAudit } from "@/server/services/providerMonitor";
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
  if (current.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "super_admin_only" }, { status: 403 });
  }
  const { checkedAt, result } = await runKieProviderCheckWithAudit(current.user.id);
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      statusCode: result.statusCode,
      balance: result.balance,
      raw: result.raw,
      checkedAt,
    });
  }
  if (result.statusCode === 0) {
    return NextResponse.json(
      {
        ok: false,
        statusCode: 0,
        error: result.error,
        raw: result.raw,
        checkedAt,
      },
      { status: 200 },
    );
  }
  return NextResponse.json({
    ok: false,
    statusCode: result.statusCode,
    error: result.error,
    raw: result.raw,
    checkedAt,
  });
}
