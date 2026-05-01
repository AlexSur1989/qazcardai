import { NextResponse } from "next/server";

import { buildLaunchChecklist } from "@/server/services/launchChecklist";
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
