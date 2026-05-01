import { NextResponse } from "next/server";

import { isSuperAdmin } from "@/lib/auth";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { updateNotificationAppSettings } from "@/server/services/notificationSettings";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  if (!isSuperAdmin(current.user.role)) {
    return NextResponse.json({ error: "super_admin_only" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const res = await updateNotificationAppSettings({
    values: body as Record<string, unknown>,
    adminUserId: current.user.id,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error },
      { status: res.status ?? 400 },
    );
  }
  return NextResponse.json(res.state);
}
