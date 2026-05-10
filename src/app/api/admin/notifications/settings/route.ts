import { NextResponse } from "next/server";

import { updateNotificationAppSettings } from "@/server/services/notificationSettings";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const gate = await requireAdminApiPermission("notifications.manage");
  if (!gate.ok) {
    return gate.response;
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
    adminUserId: gate.user.id,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error },
      { status: res.status ?? 400 },
    );
  }
  return NextResponse.json(res.state);
}
