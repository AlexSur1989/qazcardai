import { NextResponse } from "next/server";

import { getSeoChecklist, getSeoSettings, updateSeoSettings } from "@/server/services/seoSettings";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApiPermission("seo.manage");
  if (!gate.ok) {
    return gate.response;
  }
  const [settings, checklist] = await Promise.all([getSeoSettings(), getSeoChecklist()]);
  return NextResponse.json({ settings, checklist });
}

export async function PATCH(req: Request) {
  const gate = await requireAdminApiPermission("seo.manage");
  if (!gate.ok) {
    return gate.response;
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
    adminUserId: gate.user.id,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error },
      { status: res.status ?? 400 },
    );
  }
  return NextResponse.json({ settings: res.settings });
}
