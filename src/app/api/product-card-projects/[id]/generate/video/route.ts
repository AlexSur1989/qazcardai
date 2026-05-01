import { NextResponse } from "next/server";
import { z } from "zod";

import { PRODUCT_VIDEO_MOTION_STYLES } from "@/config/product-card-categories";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { generateProductVideoForProductCard } from "@/server/services/productCardGeneration";
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
  duration: z.union([z.literal(5), z.literal(10)]),
  resolution: z.string().trim().min(1).max(32).optional().default("720p"),
  aspectRatio: z.string().trim().min(1).max(32).optional().default("16:9"),
  motionStyle: z
    .string()
    .min(1)
    .refine((s) => styleSet.has(s as (typeof PRODUCT_VIDEO_MOTION_STYLES)[number]["id"]), "Некорректный стиль движения"),
  userPrompt: z.string().max(1000).optional().default(""),
  clientEstimateCredits: z.number().int().nonnegative().optional().nullable(),
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

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  const { id } = await ctx.params;

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
      { error: "Укажите sourceGenerationId для сгенерированного изображения" },
      { status: 400 },
    );
  }

  const result = await generateProductVideoForProductCard({
    userId,
    projectId: id,
    sourceType: parsed.data.sourceType,
    sourceGenerationId: parsed.data.sourceGenerationId?.trim() ?? null,
    duration: parsed.data.duration,
    resolution: parsed.data.resolution,
    aspectRatio: parsed.data.aspectRatio,
    motionStyle: parsed.data.motionStyle,
    userPrompt: parsed.data.userPrompt.trim(),
    clientEstimateCredits: parsed.data.clientEstimateCredits ?? null,
  });

  if (!result.ok) {
    if (result.code === "PRICE_CHANGED") {
      return NextResponse.json(
        { error: result.error, code: "PRICE_CHANGED" },
        { status: result.status },
      );
    }
    return NextResponse.json(
      {
        error: result.error,
        ...(result.reason ? { reason: result.reason } : {}),
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    generationId: result.generationId,
    status: result.status,
    costCredits: result.costCredits,
  });
}
