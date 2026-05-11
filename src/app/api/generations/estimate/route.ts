import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import {
  modelHasSettingsSchema,
  validateAndNormalizeModelSettings,
} from "@/server/services/model-settings";
import { calculateGenerationCreditsWithBreakdown } from "@/server/services/pricing";
import { validateStrictKieMarketPayload } from "@/server/services/kieModelPayloadValidation";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";
import {
  isKlingMotionControlModel,
  normalizeKlingMotionControlSettingsForPricing,
  resolveKlingMotionVideoDurationSeconds,
  validateKlingMotionControlSettingsForEstimate,
} from "@/server/services/kling-motion-control-settings";
import {
  isKling30StyleMarketModel,
  validateKling30StyleSettings,
} from "@/server/services/kling-settings";
import {
  validateHailuo23ImageToVideoSettings,
} from "@/server/services/hailuo-settings";
import {
  isSora2ProStoryboardModel,
  validateSora2ProStoryboardSettings,
} from "@/server/services/sora-storyboard-settings";
import {
  validateVeo31ModelSettings,
} from "@/server/services/veo31-settings";
import {
  isGrokImagineModel,
  validateGrokImagineSettings,
} from "@/server/services/grok-imagine-settings";
import {
  isSeedanceScenarioModel,
  validateSeedanceScenario,
} from "@/server/services/seedance-settings";

const estimateBodySchema = z.object({
  modelId: z.string().trim().min(1, "Укажите модель"),
  settings: z
    .record(z.string(), z.unknown())
    .optional()
    .transform((v) => v ?? {}),
});

export async function POST(req: Request) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const rate = await enforceGenerationRateLimit(current.user.id);
  if (rate) return rate;

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = estimateBodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Некорректные данные";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const model = await prisma.aiModel.findFirst({
    where: {
      id: parsed.data.modelId,
      isActive: true,
      type: { in: ["IMAGE", "VIDEO"] },
      scope: "GENERAL",
      productCardModelType: null,
    },
  });
  if (!model) {
    return NextResponse.json(
      { error: "Модель не найдена или недоступна" },
      { status: 404 },
    );
  }

  if (modelHasSettingsSchema(model.settingsSchema)) {
    const v = validateAndNormalizeModelSettings(
      model.settingsSchema,
      parsed.data.settings as Record<string, unknown>,
    );
    if (!v.ok) {
      return NextResponse.json({ error: v.message }, { status: 400 });
    }
    if (isGrokImagineModel(model.apiModelId)) {
      const gVal = validateGrokImagineSettings(model.apiModelId, v.settings);
      if (!gVal.ok) {
        return NextResponse.json(
          { error: gVal.message, message: gVal.message },
          { status: 400 },
        );
      }
    }
    {
      const hVal = validateHailuo23ImageToVideoSettings(
        model.apiModelId,
        v.settings,
      );
      if (!hVal.ok) {
        return NextResponse.json(
          { error: hVal.message, message: hVal.message },
          { status: 400 },
        );
      }
    }
    if (isSora2ProStoryboardModel(model.apiModelId)) {
      const sb = validateSora2ProStoryboardSettings(v.settings);
      if (!sb.ok) {
        return NextResponse.json(
          { error: sb.message, message: sb.message },
          { status: 400 },
        );
      }
    }
    {
      const vVeo = validateVeo31ModelSettings(model.apiModelId, v.settings);
      if (!vVeo.ok) {
        return NextResponse.json(
          { error: vVeo.message, message: vVeo.message },
          { status: 400 },
        );
      }
    }
    if (isSeedanceScenarioModel(model.apiModelId)) {
      const sVal = validateSeedanceScenario(v.settings);
      if (!sVal.ok) {
        return NextResponse.json(
          { error: sVal.message, message: sVal.message },
          { status: 400 },
        );
      }
    }
    if (isKling30StyleMarketModel(model.apiModelId)) {
      const kVal = validateKling30StyleSettings(model.apiModelId, v.settings);
      if (!kVal.ok) {
        return NextResponse.json(
          { error: kVal.message, message: kVal.message },
          { status: 400 },
        );
      }
    }
    const strictKiePayload = validateStrictKieMarketPayload(
      model,
      "estimate",
      v.settings,
      [],
    );
    if (!strictKiePayload.ok) {
      return NextResponse.json(
        { error: strictKiePayload.message, message: strictKiePayload.message },
        { status: 400 },
      );
    }
    if (isKlingMotionControlModel(model.apiModelId)) {
      const mVal = validateKlingMotionControlSettingsForEstimate(v.settings);
      if (!mVal.ok) {
        return NextResponse.json(
          { error: mVal.message, message: mVal.message },
          { status: 400 },
        );
      }
      const dur = await resolveKlingMotionVideoDurationSeconds(
        current.user.id,
        v.settings,
      );
      if (!dur.ok) {
        return NextResponse.json(
          { error: dur.message, message: dur.message },
          { status: 400 },
        );
      }
      const pricedSettings = normalizeKlingMotionControlSettingsForPricing(
        v.settings,
        dur.videoDurationSeconds,
        dur.billingDurationSeconds,
      );
      const { credits, priceBreakdown } = calculateGenerationCreditsWithBreakdown(
        model,
        pricedSettings,
      );
      return NextResponse.json({
        credits,
        priceBreakdown,
        billingDurationSeconds: dur.billingDurationSeconds,
        videoDurationSeconds: dur.videoDurationSeconds,
        modelName: model.name,
      });
    }
    const { credits, priceBreakdown } = calculateGenerationCreditsWithBreakdown(
      model,
      v.settings,
    );
    return NextResponse.json({ credits, priceBreakdown });
  }

  const { credits, priceBreakdown } = calculateGenerationCreditsWithBreakdown(model, {});
  return NextResponse.json({ credits, priceBreakdown });
}
