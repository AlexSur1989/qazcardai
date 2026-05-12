import { NextResponse } from "next/server";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { cardBuilderGenerateGalleryBodySchema } from "@/server/api/product-card-card-builder-validation";
import { generateCardBuilderFullGallery } from "@/server/services/productCardCardBuilder";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";

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
  const parsed = cardBuilderGenerateGalleryBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const result = await generateCardBuilderFullGallery({
    userId,
    projectId: id,
    clientEstimateCredits: parsed.data.clientEstimateCredits ?? null,
  });
  if (!result.ok) {
    if (result.code === "PRICE_CHANGED") {
      return NextResponse.json({ error: result.error, code: "PRICE_CHANGED" }, { status: result.status });
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    generationIds: result.generationIds,
    costCredits: result.costCredits,
  });
}
