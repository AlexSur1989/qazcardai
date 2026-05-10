import { NextResponse } from "next/server";

import { getKieMonitorStatusPayload } from "@/server/services/providerMonitor";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApiPermission("providers.view");
  if (!gate.ok) {
    return gate.response;
  }
  const payload = await getKieMonitorStatusPayload();
  return NextResponse.json(payload);
}
