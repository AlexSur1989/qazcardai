import { NextResponse } from "next/server";
import { z } from "zod";

import { getMaxJsonBodyBytes, rejectOversizedBody } from "@/lib/request-body-limits";
import {
  buildPerSecondMotionControlPreview,
  buildPricingPreview,
  isRecord,
  normalizeMatrixProviderCostBranches,
  recalculatePricingSchema,
} from "@/server/services/modelPricingCalculator";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

const bodySchema = z.object({
  pricingSchema: z.unknown(),
  recalculate: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAdminApiPermission("models.pricing.manage");
  if (!gate.ok) {
    return gate.response;
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
  const ps = parsed.data.pricingSchema;
  if (!isRecord(ps)) {
    return NextResponse.json({ error: "invalid_pricingSchema" }, { status: 400 });
  }

  const typ = String(ps.type);

  if (typ === "matrix") {
    let pm = normalizeMatrixProviderCostBranches(ps as Record<string, unknown>);
    if (parsed.data.recalculate) {
      pm = recalculatePricingSchema(pm);
    }
    const { rows, summary } = buildPricingPreview(pm);
    return NextResponse.json({
      rows,
      summary,
      modelId,
      pricingSchema: pm,
      previewKind: "matrix" as const,
    });
  }

  if (typ === "per_second") {
    const { rows, summary } = buildPerSecondMotionControlPreview(
      ps as Record<string, unknown>,
    );
    return NextResponse.json({
      rows,
      summary,
      modelId,
      pricingSchema: ps,
      previewKind: "per_second" as const,
    });
  }

  return NextResponse.json(
    { error: "unsupported_pricingSchema_type", type: typ },
    { status: 400 },
  );
}
