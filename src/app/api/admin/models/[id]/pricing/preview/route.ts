import { NextResponse } from "next/server";
import { z } from "zod";

import type { AiModel } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getMaxJsonBodyBytes, rejectOversizedBody } from "@/lib/request-body-limits";
import {
  buildPerSecondMotionControlPreview,
  buildPricingPreview,
  getFinalCreditsFromPricingSchema,
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

const FORMULA_PREVIEW_SAMPLES: Array<{
  label: string;
  settings: Record<string, unknown>;
}> = [
  { label: "Без настроек (как в estimate без полей)", settings: {} },
  { label: "duration = 5 (строка)", settings: { duration: "5" } },
  { label: "duration = 10", settings: { duration: 10 } },
  { label: "resolution = 1080p, duration = 10", settings: { resolution: "1080p", duration: "10" } },
  { label: "resolution = 2K", settings: { resolution: "2K" } },
  { label: "sound = true", settings: { sound: true } },
];

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

  if (typ === "fixed") {
    const credits =
      typeof ps.credits === "number" && Number.isFinite(ps.credits)
        ? Math.max(0, Math.floor(ps.credits))
        : 0;
    return NextResponse.json({
      rows: [
        {
          label: "Фиксированная цена",
          settings: {},
          credits,
        },
      ],
      summary: {
        minTokens: credits,
        maxTokens: credits,
        avgMarginPercent: 0,
      },
      modelId,
      pricingSchema: ps,
      previewKind: "fixed" as const,
    });
  }

  if (typ === "formula") {
    const modelRow = await prisma.aiModel.findUnique({
      where: { id: modelId },
      select: { costCredits: true },
    });
    const fb = modelRow?.costCredits ?? 0;
    const pseudoModel: Pick<AiModel, "costCredits" | "pricingSchema"> = {
      costCredits: fb,
      pricingSchema: ps as AiModel["pricingSchema"],
    };
    const rows = FORMULA_PREVIEW_SAMPLES.map((s) => ({
      label: s.label,
      settings: s.settings,
      credits: getFinalCreditsFromPricingSchema(pseudoModel, s.settings),
    }));
    const cs = rows.map((r) => r.credits).filter((n) => Number.isFinite(n));
    const minTok = cs.length ? Math.min(...cs) : 0;
    const maxTok = cs.length ? Math.max(...cs) : 0;
    return NextResponse.json({
      rows,
      summary: {
        minTokens: minTok,
        maxTokens: maxTok,
        avgMarginPercent: 0,
      },
      modelId,
      pricingSchema: ps,
      previewKind: "formula" as const,
    });
  }

  return NextResponse.json({
    rows: [],
    summary: { minTokens: 0, maxTokens: 0, avgMarginPercent: 0 },
    modelId,
    pricingSchema: ps,
    previewKind: "raw" as const,
    unsupportedVisualType: typ,
  });
}
