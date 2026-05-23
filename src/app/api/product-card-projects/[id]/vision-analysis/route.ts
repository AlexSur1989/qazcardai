import { NextResponse } from "next/server";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { mergeCardBuilderBlock, readCardBuilderBlock } from "@/server/services/productCardCardBuilderMeta";
import { assertUserOwnsFileUrl, getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { resolveCardBuilderSourceImage } from "@/server/services/cardBuilderSourceImage";
import { enforceProductClassifyRateLimit } from "@/server/services/rateLimitService";
import {
  analyzeProductImageForCardBuilder,
  toPublicVisionAnalysisPayload,
  visionAnalysisToProductFacts,
} from "@/server/services/productCardVisionAnalysis";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }
  const userId = current.user.id;
  const rate = await enforceProductClassifyRateLimit(userId);
  if (rate) return rate;

  const tooLarge = rejectOversizedBody(_req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  const { id } = await ctx.params;
  const project = await getOwnedProjectOrNull(userId, id);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const src = await resolveCardBuilderSourceImage(userId, id);
  if (!src.ok) {
    return NextResponse.json({ error: src.error, code: "NO_SOURCE" }, { status: src.status });
  }
  const url = src.url;

  const analysis = await analyzeProductImageForCardBuilder({
    imageUrl: url,
    projectId: id,
    userId,
  });

  const publicPayload = toPublicVisionAnalysisPayload(analysis);
  const productFacts = visionAnalysisToProductFacts(analysis);

  const prev = await readCardBuilderBlock(id);
  const prevSettings =
    prev?.settings && typeof prev.settings === "object" ? { ...prev.settings } : {};

  await mergeCardBuilderBlock(id, {
    settings: {
      ...prevSettings,
      visionAnalysis: {
        ...publicPayload,
        analyzedAt: new Date().toISOString(),
      },
      productFacts,
      cardBuilderCategoryKey: analysis.categoryKey,
      productType: analysis.productType,
      productNameGuess: analysis.productNameGuess,
      targetPlatform: "universal",
      updatedAt: new Date().toISOString(),
    } as unknown as import("@/server/services/productCardCardBuilderMeta").CardBuilderStoredSettings,
  });

  return NextResponse.json(publicPayload);
}
