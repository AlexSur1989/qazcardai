import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ADMIN_PRICING_PINNED_KEY,
  isAdminPricingPinned,
  withAdminPricingPinned,
  withoutAdminPricingPinned,
} from "@/lib/admin-pricing-pinned";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { validateAdminPricingSchema } from "@/lib/admin-pricing-validation";
import { prisma } from "@/lib/prisma";
import { getMaxJsonBodyBytes, rejectOversizedBody } from "@/lib/request-body-limits";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

const bodySchema = z.object({
  pricingSchema: z.unknown(),
  /** Если не указано — сохранить текущее закрепление из БД. */
  adminPricingPinned: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

function prunePinField(schema: Record<string, unknown>): Record<string, unknown> {
  const next = { ...schema };
  delete next[ADMIN_PRICING_PINNED_KEY];
  return next;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAdminApiPermission("models.pricing.manage");
  if (!gate.ok) return gate.response;
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
    select: {
      id: true,
      slug: true,
      pricingSchema: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const mergedCore = prunePinField(validated.pricingSchema as Record<string, unknown>);
  const wasPinned = isAdminPricingPinned(existing.pricingSchema);

  let nextPinned: boolean;
  if (parsed.data.adminPricingPinned === undefined) {
    nextPinned = wasPinned;
  } else {
    nextPinned = parsed.data.adminPricingPinned;
  }

  const newValueRaw = nextPinned
    ? withAdminPricingPinned(mergedCore)
    : withoutAdminPricingPinned(mergedCore);

  await prisma.aiModel.update({
    where: { id: modelId },
    data: { pricingSchema: newValueRaw as object },
  });

  const oldSnap = existing.pricingSchema;
  await writeAdminAuditLog({
    adminUserId: gate.user.id,
    adminRole: gate.user.role,
    action: "model_pricing_schema_changed",
    targetType: "AiModel",
    targetId: modelId,
    oldValue: oldSnap,
    newValue: newValueRaw,
    metadata: {
      modelSlug: existing.slug,
      changedFields: ["pricingSchema", ADMIN_PRICING_PINNED_KEY],
    },
  });
  if (nextPinned !== wasPinned) {
    await writeAdminAuditLog({
      adminUserId: gate.user.id,
      adminRole: gate.user.role,
      action: nextPinned ? "model_pricing_pinned" : "model_pricing_unpinned",
      targetType: "AiModel",
      targetId: modelId,
      oldValue: { adminPricingPinned: wasPinned },
      newValue: { adminPricingPinned: nextPinned },
      metadata: { modelSlug: existing.slug },
    });
  }

  revalidatePath("/admin/pricing");
  revalidatePath("/admin/models");

  return NextResponse.json({ ok: true, modelId });
}
