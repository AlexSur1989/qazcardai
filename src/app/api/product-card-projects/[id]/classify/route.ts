import { NextResponse } from "next/server";

import { getProductCategoryById } from "@/config/product-card-categories";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { classifyProductImage } from "@/server/services/productClassifier";
import { persistProductCardClassification } from "@/server/services/productCardClassificationPersist";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";
import { enforceProductClassifyRateLimit } from "@/server/services/rateLimitService";
import type { ProductCategoryId } from "@/config/product-card-categories";

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
  const rate = await enforceProductClassifyRateLimit(userId);
  if (rate) return rate;

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  const { id } = await ctx.params;
  const project = await getOwnedProjectOrNull(userId, id);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }
  const sourceImages = normalizeProductSourceImages(project);
  const main =
    sourceImages.find((s) => s.role === "main") ?? sourceImages[0] ?? null;
  const url = main?.url?.trim() ?? project.sourceImageUrl?.trim();
  if (!url) {
    return NextResponse.json(
      { error: "Сначала загрузите фото товара", code: "NO_SOURCE" },
      { status: 400 },
    );
  }

  const result = await classifyProductImage(url);

  const updated = await persistProductCardClassification(
    project,
    result,
    sourceImages,
  );

  const label =
    getProductCategoryById(result.category)?.label ??
    getProductCategoryById("other")!.label;

  return NextResponse.json({
    category: result.category,
    label,
    confidence: result.confidence,
    reason: result.reason,
    provider: result.provider,
    model: result.model,
    classifierFailed: result.classifierFailed === true,
    detectedCategory: result.category,
    selectedCategory: updated.selectedCategory as ProductCategoryId,
    categorySource: updated.categorySource,
  });
}
