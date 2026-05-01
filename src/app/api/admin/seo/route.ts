import { NextResponse } from "next/server";

import { isSuperAdmin } from "@/lib/auth";
import { getSeoChecklist, getSeoSettings, updateSeoSettings } from "@/server/services/seoSettings";
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
  const [settings, checklist] = await Promise.all([getSeoSettings(), getSeoChecklist()]);
  return NextResponse.json({ settings, checklist });
}

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
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const res = await updateSeoSettings({
    values: body as Record<string, unknown>,
    adminUserId: current.user.id,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error },
      { status: res.status ?? 400 },
    );
  }
  return NextResponse.json({ settings: res.settings });
}
