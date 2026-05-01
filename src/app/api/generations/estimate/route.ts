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
import { calculateGenerationCredits } from "@/server/services/pricing";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";
import {
  isKlingMotionControlModel,
  normalizeKlingMotionControlSettingsForPricing,
  resolveKlingMotionVideoDurationSeconds,
  validateKlingMotionControlSettingsForEstimate,
} from "@/server/services/kling-motion-control-settings";
import {
  isKling30Model,
  validateKling30Settings,
} from "@/server/services/kling-settings";
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
    if (isSeedanceScenarioModel(model.apiModelId)) {
      const sVal = validateSeedanceScenario(v.settings);
      if (!sVal.ok) {
        return NextResponse.json(
          { error: sVal.message, message: sVal.message },
          { status: 400 },
        );
      }
    }
    if (isKling30Model(model.apiModelId)) {
      const kVal = validateKling30Settings(v.settings);
      if (!kVal.ok) {
        return NextResponse.json(
          { error: kVal.message, message: kVal.message },
          { status: 400 },
        );
      }
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
      const credits = calculateGenerationCredits(model, pricedSettings);
      return NextResponse.json({
        credits,
        billingDurationSeconds: dur.billingDurationSeconds,
        videoDurationSeconds: dur.videoDurationSeconds,
        modelName: model.name,
      });
    }
    const credits = calculateGenerationCredits(model, v.settings);
    return NextResponse.json({ credits });
  }

  const credits = calculateGenerationCredits(model, {});
  return NextResponse.json({ credits });
}
