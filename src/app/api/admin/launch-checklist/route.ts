import { NextResponse } from "next/server";

import { buildLaunchChecklist } from "@/server/services/launchChecklist";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApiPermission("launch_checklist.view");
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const data = await buildLaunchChecklist();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "launch_checklist_failed" },
      { status: 500 },
    );
  }
}
