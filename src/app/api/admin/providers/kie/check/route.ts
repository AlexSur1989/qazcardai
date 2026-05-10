import { NextResponse } from "next/server";

import { runKieProviderCheckWithAudit } from "@/server/services/providerMonitor";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

export async function POST() {
  const gate = await requireAdminApiPermission("providers.manage");
  if (!gate.ok) {
    return gate.response;
  }
  const { checkedAt, result } = await runKieProviderCheckWithAudit(gate.user.id);
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
