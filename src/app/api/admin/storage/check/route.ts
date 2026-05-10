import { NextResponse } from "next/server";

import { runStorageCheckWithAudit } from "@/server/services/storageMonitor";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

export async function POST() {
  const gate = await requireAdminApiPermission("storage.manage");
  if (!gate.ok) {
    return gate.response;
  }
  const r = await runStorageCheckWithAudit(gate.user.id);
  if (r.ok) {
    return NextResponse.json({
      ok: true,
      message: "Storage connection is OK",
      detail: r.message,
      mode: r.mode,
      checkedAt: r.checkedAt,
    });
  }
  return NextResponse.json({
    ok: false,
    message: r.message,
    mode: r.mode,
    checkedAt: r.checkedAt,
  });
}
