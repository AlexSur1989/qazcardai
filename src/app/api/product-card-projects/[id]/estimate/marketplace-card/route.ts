import { NextResponse } from "next/server";
import { z } from "zod";

import { MARKETPLACE_CARD_STYLES } from "@/config/product-card-categories";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { estimateMarketplaceCardCredits } from "@/server/services/productCardGeneration";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";

const styleSet = new Set(MARKETPLACE_CARD_STYLES.map((s) => s.id));

const bodySchema = z.object({
  sourceType: z.enum(["original", "concept_generation"]),
  sourceGenerationId: z.string().nullable().optional(),
  style: z
    .string()
    .min(1)
    .refine((s) => styleSet.has(s as (typeof MARKETPLACE_CARD_STYLES)[number]["id"]), "Некорректный стиль"),
  cardSize: z.string().trim().min(1).max(64).optional(),
  overlayTemplate: z.string().trim().min(1).max(64).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }
  const userId = current.user.id;
  const rate = await enforceGenerationRateLimit(userId);
  if (rate) return rate;

  const { id } = await ctx.params;

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }
  if (
    parsed.data.sourceType === "concept_generation" &&
    !parsed.data.sourceGenerationId?.trim()
  ) {
    return NextResponse.json(
      { error: "Укажите sourceGenerationId для сгенерированного фото" },
      { status: 400 },
    );
  }

  const result = await estimateMarketplaceCardCredits(userId, id, {
    sourceType: parsed.data.sourceType,
    sourceGenerationId: parsed.data.sourceGenerationId?.trim() ?? null,
    style: parsed.data.style,
    cardSize: parsed.data.cardSize,
    overlayTemplate: parsed.data.overlayTemplate,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    credits: result.credits,
    modelName: result.modelName,
    priceBreakdown: result.priceBreakdown,
    model: {
      id: result.priceBreakdown.modelId,
      slug: result.priceBreakdown.modelSlug,
      name: result.priceBreakdown.modelName,
    },
  });
}
