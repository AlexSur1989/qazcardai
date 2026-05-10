import { NextResponse } from "next/server";

import {
  getEmailTemplate,
  isEmailTemplateKey,
  updateEmailTemplate,
} from "@/server/services/emailTemplates";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

type RouteCtx = { params: Promise<{ key: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteCtx) {
  const gate = await requireAdminApiPermission("notifications.manage");
  if (!gate.ok) {
    return gate.response;
  }
  const { key: raw } = await ctx.params;
  if (!isEmailTemplateKey(raw)) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }
  const t = await getEmailTemplate(raw);
  if (!t) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ template: t });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const gate = await requireAdminApiPermission("notifications.manage");
  if (!gate.ok) {
    return gate.response;
  }
  const { key: raw } = await ctx.params;
  if (!isEmailTemplateKey(raw)) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
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
  const b = body as Record<string, unknown>;
  if (typeof b.subject !== "string") {
    return NextResponse.json({ error: "invalid_subject" }, { status: 400 });
  }
  if (b.isActive !== true && b.isActive !== false) {
    return NextResponse.json({ error: "invalid_isActive" }, { status: 400 });
  }
  let bodyText: string | null;
  if (b.bodyText === null) bodyText = null;
  else if (typeof b.bodyText === "string") bodyText = b.bodyText;
  else if (b.bodyText === undefined) bodyText = "";
  else
    return NextResponse.json({ error: "invalid_bodyText" }, { status: 400 });
  let bodyHtml: string | null;
  if (b.bodyHtml === null) bodyHtml = null;
  else if (typeof b.bodyHtml === "string") bodyHtml = b.bodyHtml;
  else if (b.bodyHtml === undefined) bodyHtml = null;
  else
    return NextResponse.json({ error: "invalid_bodyHtml" }, { status: 400 });
  const res = await updateEmailTemplate({
    key: raw,
    subject: b.subject,
    bodyText,
    bodyHtml,
    isActive: b.isActive,
    adminUserId: gate.user.id,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error },
      { status: res.error === "not_seeded" ? 404 : 400 },
    );
  }
  return NextResponse.json({ template: res.template });
}
