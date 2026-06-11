import { NextResponse } from "next/server";
import { z } from "zod";

import {
  PRODUCT_CARD_IMAGE_RESOLUTIONS,
  PRODUCT_CARD_IMAGE_RESOLUTION_DEFAULT,
} from "@/config/product-card-image-resolution";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { generateConceptPhotoForProductCard } from "@/server/services/productCardGeneration";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";

const bodySchema = z.object({
  categoryId: z.string().min(1, "Укажите категорию"),
  conceptId: z.string().min(1, "Выберите концепцию"),
  userPrompt: z.string().max(1000).optional().default(""),
  size: z.string().trim().min(1).max(64).optional().default("1x1"),
  resolution: z.enum(PRODUCT_CARD_IMAGE_RESOLUTIONS).optional().default(PRODUCT_CARD_IMAGE_RESOLUTION_DEFAULT),
  clientEstimateCredits: z.number().finite().nullable().optional(),
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

  const result = await generateConceptPhotoForProductCard(userId, id, {
    categoryId: parsed.data.categoryId,
    conceptId: parsed.data.conceptId,
    userPrompt: parsed.data.userPrompt.trim(),
    size: parsed.data.size,
    resolution: parsed.data.resolution,
    clientEstimateCredits: parsed.data.clientEstimateCredits ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        ...(result.reason ? { reason: result.reason } : {}),
        ...(result.code ? { code: result.code } : {}),
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
