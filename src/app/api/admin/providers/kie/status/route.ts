import { NextResponse } from "next/server";

import { getKieMonitorStatusPayload } from "@/server/services/providerMonitor";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  const payload = await getKieMonitorStatusPayload();
  return NextResponse.json(payload);
}
