import { NextResponse } from "next/server";

import { getAllAppSettingsForAdminResponse } from "@/server/services/appSettings";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApiPermission("settings.view");
  if (!gate.ok) {
    return gate.response;
  }
  const data = await getAllAppSettingsForAdminResponse();
  return NextResponse.json(data);
}
