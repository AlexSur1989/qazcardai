import { NextResponse } from "next/server";

import { getStorageStatusPayload } from "@/server/services/storageMonitor";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApiPermission("storage.manage");
  if (!gate.ok) {
    return gate.response;
  }
  return NextResponse.json(await getStorageStatusPayload());
}
