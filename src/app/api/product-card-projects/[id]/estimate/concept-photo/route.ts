import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { resolveDefaultProductConceptImageModel } from "@/server/services/productCardModelResolver";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";
import { buildImageModelInput } from "@/server/services/productCardQueueGenerations";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";
import { modelHasSettingsSchema } from "@/server/services/model-settings";
import { calculateProductCardConceptImageCredits } from "@/server/services/productCardPricing";
import { PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE } from "@/server/services/productCardSettings";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  size: z.string().trim().min(1).max(64).optional().default("1x1"),
});

/**
 * Оценка стоимости concept photo без вызова провайдера.
 */
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
  const project = await getOwnedProjectOrNull(userId, id);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }
  const sourceImages = normalizeProductSourceImages(project);
  const sourceImageUrls = sourceImages.map((img) => img.url).filter(Boolean);
  const sourceUrl = sourceImageUrls[0] ?? project.sourceImageUrl?.trim();
  if (!sourceUrl) {
    return NextResponse.json({ error: "Загрузите исходное фото" }, { status: 400 });
  }

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;
  let body = { size: "1x1" };
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success) body = parsed.data;
  } catch {
    body = { size: "1x1" };
  }

  const model = await resolveDefaultProductConceptImageModel();
  if (!model) {
    return NextResponse.json(
      {
        error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
      },
      { status: 400 },
    );
  }

  if (!modelHasSettingsSchema(model.settingsSchema)) {
    const price = await calculateProductCardConceptImageCredits(model, { size: body.size });
    return NextResponse.json({
      credits: price.credits,
      modelName: model.name,
      model: { id: model.id, slug: model.slug, name: model.name },
      priceBreakdown: price,
    });
  }

  let settings: Record<string, unknown>;
  try {
    settings = buildImageModelInput(
      { settingsSchema: model.settingsSchema, supportsImageInput: model.supportsImageInput },
      sourceImageUrls.length > 0 ? sourceImageUrls : sourceUrl,
    ).normalizedSettings;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Некорректные настройки модели" },
      { status: 400 },
    );
  }
  const price = await calculateProductCardConceptImageCredits(model, {
    ...settings,
    size: body.size,
  });
  return NextResponse.json({
    credits: price.credits,
    modelName: model.name,
    model: { id: model.id, slug: model.slug, name: model.name },
    priceBreakdown: price,
  });
}
