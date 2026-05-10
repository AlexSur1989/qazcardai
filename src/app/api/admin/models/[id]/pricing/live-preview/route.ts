import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getMaxJsonBodyBytes, rejectOversizedBody } from "@/lib/request-body-limits";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import {
  calculateProductCardConceptImageCredits,
  calculateProductCardMarketplaceCardCredits,
  calculateProductCardVideoCredits,
  resolveMarketplaceVariantBundleTotals,
} from "@/server/services/productCardPricing";
import { buildGeneralPriceBreakdownV2 } from "@/server/services/unifiedModelPricing";

const bodySchema = z.object({
  settings: z.record(z.string(), z.unknown()).optional(),
  variantCount: z.number().int().min(1).max(12).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAdminApiPermission("models.pricing.manage");
  if (!gate.ok) return gate.response;
  if (rejectOversizedBody(req, getMaxJsonBodyBytes())) {
    return NextResponse.json({ error: "body_too_large" }, { status: 413 });
  }
  const { id: modelId } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }
  const settings = parsed.data.settings ?? {};
  const model = await prisma.aiModel.findUnique({ where: { id: modelId } });
  if (!model) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const variantCount = parsed.data.variantCount ?? 1;

  if (
    model.scope === "GENERAL" &&
    (model.type === "IMAGE" || model.type === "VIDEO")
  ) {
    const priceBreakdown = buildGeneralPriceBreakdownV2(model, settings);
    return NextResponse.json({
      previewKind: "general" as const,
      credits: priceBreakdown.tokens,
      priceBreakdown,
    });
  }

  if (model.scope === "PRODUCT_CARD" && model.productCardModelType === "PRODUCT_MARKETPLACE_CARD") {
    const perVariant = await calculateProductCardMarketplaceCardCredits(model, settings);
    if (variantCount <= 1) {
      return NextResponse.json({
        previewKind: "product_marketplace" as const,
        credits: perVariant.credits,
        priceBreakdown: perVariant,
      });
    }
    const bundle = resolveMarketplaceVariantBundleTotals(model, variantCount, perVariant);
    return NextResponse.json({
      previewKind: "product_marketplace_bundle" as const,
      credits: bundle.totalCredits,
      perVariantCredits: bundle.singleVariantCredits,
      variantAllocations: bundle.allocations,
      priceBreakdown: bundle.priceBreakdown,
    });
  }

  if (model.scope === "PRODUCT_CARD" && model.type === "IMAGE") {
    const perVariant = await calculateProductCardConceptImageCredits(model, settings);
    return NextResponse.json({
      previewKind: "product_concept_image" as const,
      credits: perVariant.credits,
      priceBreakdown: perVariant,
    });
  }

  if (model.scope === "PRODUCT_CARD" && model.type === "VIDEO") {
    const perVariant = await calculateProductCardVideoCredits(model, settings);
    return NextResponse.json({
      previewKind: "product_video" as const,
      credits: perVariant.credits,
      priceBreakdown: perVariant,
    });
  }

  return NextResponse.json({ error: "unsupported_model_scope_for_preview" }, { status: 400 });
}
