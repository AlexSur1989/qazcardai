import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendTemplateEmail, getEmailFlowUrls } from "@/server/services/emailService";
import {
  isEmailTemplateKey,
  type EmailTemplateKey,
} from "@/server/services/emailTemplates";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

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
  if (typeof b.to !== "string" || !b.to.trim()) {
    return NextResponse.json({ error: "invalid_to" }, { status: 400 });
  }
  if (typeof b.templateKey !== "string" || !isEmailTemplateKey(b.templateKey)) {
    return NextResponse.json({ error: "invalid_templateKey" }, { status: 400 });
  }
  const templateKey = b.templateKey as EmailTemplateKey;
  const { appName, dashboardUrl, billingUrl } = getEmailFlowUrls();
  const u = await prisma.user.findUnique({
    where: { id: gate.user.id },
    select: { name: true, email: true },
  });
  const userName = u?.name ?? "Admin";
  const userEmail = u?.email ?? gate.user.email;

  const result = await sendTemplateEmail({
    to: b.to.trim(),
    templateKey,
    variables: {
      appName,
      userName,
      userEmail,
      balanceCredits: 100,
      packageName: "Test package",
      credits: 100,
      amount: "0",
      currency: "KZT",
      generationId: "test-generation-id",
      generationType: "IMAGE",
      modelName: "Test model",
      errorMessage: "Test error (preview)",
      dashboardUrl,
      billingUrl,
      createdAt: new Date(),
    },
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
