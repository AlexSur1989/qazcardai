import { NextResponse } from "next/server";
import { z } from "zod";

import { defaultsFromSchema } from "@/lib/generation-form-settings-schema";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import {
  resolveActiveModel,
  resolveDefaultMarketplaceCardModel,
  resolveDefaultProductConceptImageModel,
} from "@/server/services/productCardModelResolver";
import { ENV_PRODUCT_VIDEO_SLUG } from "@/server/services/productCardEnv";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";
import {
  modelHasSettingsSchema,
  validateAndNormalizeModelSettings,
} from "@/server/services/model-settings";
import { calculateGenerationCredits } from "@/server/services/pricing";

const bodySchema = z.object({
  tab: z.enum(["concept_photo", "marketplace_card", "video"]),
  durationSec: z.union([z.literal(5), z.literal(10)]).optional(),
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
  const project = await getOwnedProjectOrNull(userId, id);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

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

  if (parsed.data.tab === "concept_photo" || parsed.data.tab === "marketplace_card") {
    const model =
      parsed.data.tab === "concept_photo"
        ? await resolveDefaultProductConceptImageModel()
        : await resolveDefaultMarketplaceCardModel();
    if (!model) {
      return NextResponse.json(
        {
          error:
            "Нет активной модели для генерации фото. Добавьте IMAGE модель в админке.",
        },
        { status: 400 },
      );
    }
    if (!modelHasSettingsSchema(model.settingsSchema)) {
      const credits = calculateGenerationCredits(model, {});
      return NextResponse.json({ credits, modelId: model.id });
    }
    const d = defaultsFromSchema(model.settingsSchema);
    if ("imageUrls" in d) {
      d.imageUrls = [project.sourceImageUrl ?? "https://example.com/placeholder.png"];
    }
    const n = validateAndNormalizeModelSettings(model.settingsSchema, d as Record<string, unknown>);
    if (!n.ok) {
      return NextResponse.json({ error: n.message }, { status: 400 });
    }
    const credits = calculateGenerationCredits(model, n.settings);
    return NextResponse.json({ credits, modelId: model.id });
  }

  const model = await resolveActiveModel("VIDEO", ENV_PRODUCT_VIDEO_SLUG, false);
  if (!model) {
    return NextResponse.json({ error: "Нет video-модели" }, { status: 404 });
  }
  if (!modelHasSettingsSchema(model.settingsSchema)) {
    return NextResponse.json({ error: "Нет схемы" }, { status: 500 });
  }
  const d = defaultsFromSchema(model.settingsSchema);
  const dur = parsed.data.durationSec ?? 5;
  const draft = {
    ...d,
    scenario: "first-frame",
    firstFrameUrl: project.sourceImageUrl ?? "https://example.com/placeholder.png",
    duration: dur,
    resolution: "720p",
    aspectRatio: "16:9",
  } as Record<string, unknown>;
  const n = validateAndNormalizeModelSettings(model.settingsSchema, draft);
  if (!n.ok) {
    return NextResponse.json({ error: n.message }, { status: 400 });
  }
  const credits = calculateGenerationCredits(model, n.settings);
  return NextResponse.json({ credits, modelId: model.id });
}
