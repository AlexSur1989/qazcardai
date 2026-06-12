import { NextResponse } from "next/server";
import { z } from "zod";

import { PRODUCT_VIDEO_MOTION_STYLES } from "@/config/product-card-categories";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { estimateProductVideoCredits } from "@/server/services/productCardGeneration";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";

const styleSet = new Set(PRODUCT_VIDEO_MOTION_STYLES.map((s) => s.id));

const bodySchema = z.object({
  sourceType: z.enum([
    "original",
    "concept_generation",
    "marketplace_card_generation",
  ]),
  sourceGenerationId: z.string().nullable().optional(),
  sourceImageUrl: z.string().trim().url().max(2048).optional().nullable(),
  duration: z.union([z.literal(5), z.literal(10)]),
  resolution: z.string().trim().min(1).max(32).optional(),
  aspectRatio: z.string().trim().min(1).max(32).optional(),
  motionStyle: z
    .string()
    .min(1)
    .refine((s) => styleSet.has(s as (typeof PRODUCT_VIDEO_MOTION_STYLES)[number]["id"]), "Некорректный стиль движения"),
  lastFrameUrl: z.string().trim().url().max(2048).optional().nullable(),
  productCardMode: z.boolean().optional().default(false),
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
    (parsed.data.sourceType === "concept_generation" ||
      parsed.data.sourceType === "marketplace_card_generation") &&
    !parsed.data.sourceGenerationId?.trim()
  ) {
    return NextResponse.json(
      { error: "Укажите sourceGenerationId" },
      { status: 400 },
    );
  }

  const result = await estimateProductVideoCredits(userId, id, {
    sourceType: parsed.data.sourceType,
    sourceGenerationId: parsed.data.sourceGenerationId?.trim() ?? null,
    sourceImageUrl: parsed.data.sourceImageUrl?.trim() ?? null,
    duration: parsed.data.duration,
    resolution: parsed.data.resolution,
    aspectRatio: parsed.data.aspectRatio,
    motionStyle: parsed.data.motionStyle,
    lastFrameUrl: parsed.data.lastFrameUrl?.trim() ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    credits: result.credits,
    priceBreakdown: result.priceBreakdown,
  });
}
