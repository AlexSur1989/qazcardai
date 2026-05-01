import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { validateAdminPricingSchema } from "@/lib/admin-pricing-validation";
import { prisma } from "@/lib/prisma";
import { getMaxJsonBodyBytes, rejectOversizedBody } from "@/lib/request-body-limits";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

const bodySchema = z.object({
  pricingSchema: z.unknown(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
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
  if (rejectOversizedBody(req, getMaxJsonBodyBytes())) {
    return NextResponse.json({ error: "body_too_large" }, { status: 413 });
  }
  const { id: modelId } = await ctx.params;
  if (!modelId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const validated = validateAdminPricingSchema(parsed.data.pricingSchema);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const existing = await prisma.aiModel.findUnique({
    where: { id: modelId },
    select: { id: true, pricingSchema: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const oldValue = existing.pricingSchema;
  const newValue = validated.pricingSchema;
  await prisma.aiModel.update({
    where: { id: modelId },
    data: { pricingSchema: newValue as object },
  });
  await writeAdminAuditLog({
    adminUserId: current.user.id,
    action: "AI_MODEL_PRICING_UPDATED",
    targetType: "AiModel",
    targetId: modelId,
    oldValue,
    newValue,
  });
  return NextResponse.json({ ok: true, modelId });
}
