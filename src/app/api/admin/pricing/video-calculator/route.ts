import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { prisma } from "@/lib/prisma";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { calculateGenerationCreditsWithBreakdown } from "@/server/services/pricing";
import { calculateProductCardVideoCredits } from "@/server/services/productCardPricing";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  scenario: z.enum(["general", "product"]),
  modelId: z.string().min(1),
  duration: z.union([z.number(), z.string()]).optional(),
  resolution: z.string().optional(),
  mode: z.string().optional(),
  sound: z.boolean().optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdminApiPermission("models.pricing.manage");
  if (!gate.ok) return gate.response;

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const model = await prisma.aiModel.findUnique({ where: { id: parsed.data.modelId } });
  if (!model) {
    return NextResponse.json({ error: "Модель не найдена" }, { status: 404 });
  }

  const settings: Record<string, unknown> = {};
  if (parsed.data.duration != null) settings.duration = parsed.data.duration;
  if (parsed.data.resolution) settings.resolution = parsed.data.resolution;
  if (parsed.data.mode) settings.mode = parsed.data.mode;
  if (parsed.data.sound != null) settings.sound = parsed.data.sound;

  if (parsed.data.scenario === "general") {
    if (model.scope !== "GENERAL" || model.type !== "VIDEO") {
      return NextResponse.json({ error: "Нужна GENERAL VIDEO модель" }, { status: 400 });
    }
    const { credits, priceBreakdown } = calculateGenerationCreditsWithBreakdown(model, settings);
    return NextResponse.json({
      credits,
      formula: priceBreakdown.formula ?? "GENERAL pricingSchema",
      priceSource: priceBreakdown.priceSource,
      providerCostUsd: priceBreakdown.providerCostUsd,
      marginPercent: priceBreakdown.marginPercent,
    });
  }

  if (model.scope !== "PRODUCT_CARD") {
    return NextResponse.json({ error: "Нужна PRODUCT_CARD модель" }, { status: 400 });
  }

  const breakdown = await calculateProductCardVideoCredits(model, {
    duration: typeof parsed.data.duration === "number" ? parsed.data.duration : 5,
    resolution: parsed.data.resolution ?? "720p",
    aspectRatio: "16:9",
    ...settings,
  });

  return NextResponse.json({
    credits: breakdown.credits,
    formula: breakdown.formula,
    priceSource: breakdown.priceSource,
    providerCostUsd: breakdown.providerCostUsd,
    marginPercent: breakdown.marginPercent,
  });
}
