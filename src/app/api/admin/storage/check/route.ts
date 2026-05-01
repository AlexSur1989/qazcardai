import { NextResponse } from "next/server";

import { runStorageCheckWithAudit } from "@/server/services/storageMonitor";
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
  const r = await runStorageCheckWithAudit(current.user.id);
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
