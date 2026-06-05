import { NextResponse } from "next/server";

import { getAppName } from "@/lib/app-name";
import { getSupportEmailFromEnv } from "@/lib/smtp-config";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { sendSmtpTestEmail } from "@/server/services/emailService";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
  const b = body as Record<string, unknown>;
  const toRaw = b.to;
  const to = typeof toRaw === "string" ? toRaw.trim() : "";
  if (!to) {
    return NextResponse.json({ error: "invalid_to" }, { status: 400 });
  }

  const appName = getAppName();
  const supportEmail = getSupportEmailFromEnv();
  const result = await sendSmtpTestEmail({
    to,
    subject: `Тест SMTP — ${appName}`,
    text:
      `Это тестовое письмо от ${appName}.\n\n` +
      `Если вы получили это письмо, SMTP настроен корректно.\n\n` +
      `По вопросам: ${supportEmail}\n`,
  });

  if (result.status === "skipped") {
    return NextResponse.json({ ok: true, result: "skipped", reason: result.reason });
  }
  if (result.status === "error") {
    return NextResponse.json(
      { ok: false, result: "error", message: result.message },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, result: "sent" });
}
