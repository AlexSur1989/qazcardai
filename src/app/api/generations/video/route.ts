import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";

import { publicHttpUrlsOnly } from "@/lib/generation-input-limits";
import { prisma } from "@/lib/prisma";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { publicApiErrorMessage } from "@/lib/safe-api-error";
import { validateVideoInputFiles } from "@/lib/video-input-limits";
import { videoGenerationBodySchema } from "@/lib/validations/video-generation";
import { CreditServiceError, getBalance, refundCredits, reserveCredits } from "@/server/services/credits";
import { isRedisReachableForQueue } from "@/server/queues/redisConnection";
import { enqueueGenerationJob } from "@/server/queues/generationQueue";
import { getQueueMode } from "@/server/queue-mode";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { processGeneration } from "@/server/services/generationProcessor";
import { MODERATION_USER_MESSAGE, moderateGenerationInput } from "@/server/services/moderation";
import {
  modelHasSettingsSchema,
  validateAndNormalizeModelSettings,
} from "@/server/services/model-settings";
import {
  calculateGenerationCreditsWithBreakdown,
} from "@/server/services/pricing";
import { validateStrictKieMarketPayload } from "@/server/services/kieModelPayloadValidation";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";
import {
  mergeHailuo23SettingsWithInputFiles,
  validateHailuo23ImageToVideoSettings,
} from "@/server/services/hailuo-settings";
import {
  isSora2ProStoryboardModel,
  mergeSoraStoryboardSettingsWithInputFiles,
  validateSora2ProStoryboardSettings,
} from "@/server/services/sora-storyboard-settings";
import {
  isVeo31FamilyApiModelId,
  mergeVeo31GenerateImageUrls,
  validateVeo31ModelSettings,
} from "@/server/services/veo31-settings";
import {
  assertKlingMotionUrlsOwnedByUser,
  collectKlingMotionControlHttpUrls,
  isKlingMotionControlModel,
  normalizeKlingMotionControlSettingsForPricing,
  resolveKlingMotionVideoDurationSeconds,
  validateKlingMotionControlSettings,
} from "@/server/services/kling-motion-control-settings";
import {
  isKling30StyleMarketModel,
  validateKling30StyleSettings,
} from "@/server/services/kling-settings";
import {
  collectGrokImagineSettingsHttpUrls,
  isGrokImagineModel,
  validateGrokImagineSettings,
} from "@/server/services/grok-imagine-settings";
import {
  collectHappyHorseSettingsHttpUrls,
  isHappyHorseModel,
  validateHappyHorseScenario,
} from "@/server/services/happyhorse-settings";
import {
  collectWan27SettingsHttpUrls,
  isWanMarketModel,
  isWanVideoEditDurationModel,
  validateWan27ModelScenario,
} from "@/server/services/wan-settings";
import {
  collectSeedanceSettingsHttpUrls,
  isSeedanceScenarioModel,
  validateSeedanceScenario,
} from "@/server/services/seedance-settings";

export async function POST(req: Request) {
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

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = videoGenerationBodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Некорректные данные";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const body = parsed.data;

  if (!process.env.KIE_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "Видео: настройте KIE_API_KEY" },
      { status: 503 },
    );
  }
  const queueMode = getQueueMode();
  if (queueMode === "redis" && !process.env.REDIS_URL?.trim()) {
    return NextResponse.json(
      {
        error:
          "Видео: укажите REDIS_URL или задайте QUEUE_MODE=inline для работы без Redis (локальная разработка)",
      },
      { status: 503 },
    );
  }

  const model = await prisma.aiModel.findFirst({
    where: {
      id: body.modelId,
      isActive: true,
      type: "VIDEO",
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

  const hasSchema = modelHasSettingsSchema(model.settingsSchema);
  let normalizedSettings: Record<string, unknown> = {};

  if (hasSchema) {
    const v = validateAndNormalizeModelSettings(
      model.settingsSchema,
      body.settings as Record<string, unknown>,
    );
    if (!v.ok) {
      return NextResponse.json({ error: v.message }, { status: 400 });
    }
    normalizedSettings = v.settings;
    normalizedSettings = mergeHailuo23SettingsWithInputFiles(
      model.apiModelId,
      normalizedSettings,
      publicHttpUrlsOnly(body.inputFiles ?? []),
    );
    normalizedSettings = mergeSoraStoryboardSettingsWithInputFiles(
      model.apiModelId,
      normalizedSettings,
      publicHttpUrlsOnly(body.inputFiles ?? []),
    );
    normalizedSettings = mergeVeo31GenerateImageUrls(
      model.apiModelId,
      normalizedSettings,
      publicHttpUrlsOnly(body.inputFiles ?? []),
    );
    if (
      model.maxDuration != null &&
      !isKlingMotionControlModel(model.apiModelId) &&
      !isSora2ProStoryboardModel(model.apiModelId) &&
      !isVeo31FamilyApiModelId(model.apiModelId)
    ) {
      const d = Number.parseInt(String(normalizedSettings.duration ?? ""), 10);
      if (isWanVideoEditDurationModel(model.apiModelId)) {
        if (!Number.isInteger(d) || (d !== 0 && (d < 2 || d > 10))) {
          return NextResponse.json(
            {
              error: "Длительность: для Wan Video Edit укажите 0 или от 2 до 10 с",
            },
            { status: 400 },
          );
        }
      } else if (
        !Number.isInteger(d) ||
        d < 1 ||
        d > model.maxDuration
      ) {
        return NextResponse.json(
          {
            error: `Длительность: укажите значение от 1 до ${model.maxDuration} с`,
          },
          { status: 400 },
        );
      }
    }
    if (isSeedanceScenarioModel(model.apiModelId)) {
      const sVal = validateSeedanceScenario(normalizedSettings);
      if (!sVal.ok) {
        return NextResponse.json(
          { error: sVal.message, message: sVal.message },
          { status: 400 },
        );
      }
    }
    if (isHappyHorseModel(model.apiModelId)) {
      const hVal = validateHappyHorseScenario(
        normalizedSettings,
        body.prompt.trim(),
      );
      if (!hVal.ok) {
        return NextResponse.json(
          { error: hVal.message, message: hVal.message },
          { status: 400 },
        );
      }
    }
    if (isWanMarketModel(model.apiModelId)) {
      const wVal = validateWan27ModelScenario(
        model.apiModelId,
        normalizedSettings,
      );
      if (!wVal.ok) {
        return NextResponse.json(
          { error: wVal.message, message: wVal.message },
          { status: 400 },
        );
      }
    }
    if (isGrokImagineModel(model.apiModelId)) {
      const gVal = validateGrokImagineSettings(model.apiModelId, normalizedSettings);
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
        normalizedSettings,
      );
      if (!hVal.ok) {
        return NextResponse.json(
          { error: hVal.message, message: hVal.message },
          { status: 400 },
        );
      }
    }
    if (isSora2ProStoryboardModel(model.apiModelId)) {
      const sb = validateSora2ProStoryboardSettings(normalizedSettings);
      if (!sb.ok) {
        return NextResponse.json(
          { error: sb.message, message: sb.message },
          { status: 400 },
        );
      }
    }
    {
      const vVeo = validateVeo31ModelSettings(
        model.apiModelId,
        normalizedSettings,
      );
      if (!vVeo.ok) {
        return NextResponse.json(
          { error: vVeo.message, message: vVeo.message },
          { status: 400 },
        );
      }
    }
    if (isKling30StyleMarketModel(model.apiModelId)) {
      const kVal = validateKling30StyleSettings(
        model.apiModelId,
        normalizedSettings,
      );
      if (!kVal.ok) {
        return NextResponse.json(
          { error: kVal.message, message: kVal.message },
          { status: 400 },
        );
      }
    }
    if (isKlingMotionControlModel(model.apiModelId)) {
      const mc = validateKlingMotionControlSettings(normalizedSettings);
      if (!mc.ok) {
        return NextResponse.json(
          { error: mc.message, message: mc.message },
          { status: 400 },
        );
      }
      const iu = Array.isArray(normalizedSettings.inputUrls)
        ? normalizedSettings.inputUrls.filter(
            (x): x is string => typeof x === "string" && x.trim() !== "",
          )
        : [];
      const vu = Array.isArray(normalizedSettings.videoUrls)
        ? normalizedSettings.videoUrls.filter(
            (x): x is string => typeof x === "string" && x.trim() !== "",
          )
        : [];
      const own = await assertKlingMotionUrlsOwnedByUser(userId, iu, vu);
      if (!own.ok) {
        return NextResponse.json(
          { error: own.message, message: own.message },
          { status: 400 },
        );
      }
      const dur = await resolveKlingMotionVideoDurationSeconds(userId, normalizedSettings);
      if (!dur.ok) {
        return NextResponse.json(
          { error: dur.message, message: dur.message },
          { status: 400 },
        );
      }
      normalizedSettings = {
        ...normalizeKlingMotionControlSettingsForPricing(
          normalizedSettings,
          dur.videoDurationSeconds,
          dur.billingDurationSeconds,
        ),
        pricingType: "per_second",
      };
    }
  } else if (body.durationSec != null) {
    if (model.maxDuration == null) {
      return NextResponse.json(
        { error: "Длительность для этой модели не настраивается" },
        { status: 400 },
      );
    }
    if (body.durationSec > model.maxDuration) {
      return NextResponse.json(
        { error: `Максимальная длительность: ${model.maxDuration} с` },
        { status: 400 },
      );
    }
  }

  const negativePromptMerged =
    (hasSchema &&
    typeof normalizedSettings.negativePrompt === "string" &&
    normalizedSettings.negativePrompt.trim() !== ""
      ? normalizedSettings.negativePrompt.trim()
      : null) ?? body.negativePrompt?.trim() ?? null;

  if (negativePromptMerged && !model.supportsNegativePrompt) {
    return NextResponse.json(
      { error: "Эта модель не поддерживает negative prompt" },
      { status: 400 },
    );
  }
  if (body.seed !== undefined && !model.supportsSeed) {
    return NextResponse.json(
      { error: "Эта модель не поддерживает seed" },
      { status: 400 },
    );
  }

  const imageUrlsFromSettings = (() => {
    if (!hasSchema) {
      return [] as string[];
    }
    if (isKlingMotionControlModel(model.apiModelId)) {
      return collectKlingMotionControlHttpUrls(normalizedSettings);
    }
    if (isSeedanceScenarioModel(model.apiModelId)) {
      return collectSeedanceSettingsHttpUrls(normalizedSettings);
    }
    if (isHappyHorseModel(model.apiModelId)) {
      return collectHappyHorseSettingsHttpUrls(normalizedSettings);
    }
    if (isWanMarketModel(model.apiModelId)) {
      return collectWan27SettingsHttpUrls(model.apiModelId, normalizedSettings);
    }
    if (isGrokImagineModel(model.apiModelId)) {
      return collectGrokImagineSettingsHttpUrls(model.apiModelId, normalizedSettings);
    }
    if (Array.isArray(normalizedSettings.imageUrls)) {
      return normalizedSettings.imageUrls.filter(
        (x): x is string => typeof x === "string",
      );
    }
    return [] as string[];
  })();
  const inputFilesCombined = [
    ...(body.inputFiles ?? []),
    ...imageUrlsFromSettings,
  ];

  const filesCheck = validateVideoInputFiles(
    inputFilesCombined.length > 0 ? inputFilesCombined : undefined,
  );
  if (!filesCheck.ok) {
    return NextResponse.json({ error: filesCheck.error }, { status: 400 });
  }

  if (
    inputFilesCombined.length > 0 &&
    !model.supportsImageInput &&
    !model.supportsVideoInput
  ) {
    return NextResponse.json(
      { error: "Эта модель не поддерживает вложения (изображения/видео)" },
      { status: 400 },
    );
  }

  const httpUrls = publicHttpUrlsOnly(inputFilesCombined);
  if (inputFilesCombined.length > 0) {
    const hasData = inputFilesCombined.some((s) => s.trim().startsWith("data:"));
    if (hasData) {
      return NextResponse.json(
        {
          error:
            "Пока укажите публичные http(s) URL; загрузка data URL подключится со storage.",
        },
        { status: 400 },
      );
    }
    if (httpUrls.length === 0) {
      return NextResponse.json(
        { error: "Укажите хотя бы один публичный URL" },
        { status: 400 },
      );
    }
  }

  const strictKiePayload = validateStrictKieMarketPayload(
    model,
    body.prompt,
    normalizedSettings,
    httpUrls,
  );
  if (!strictKiePayload.ok) {
    return NextResponse.json({ error: strictKiePayload.message }, { status: 400 });
  }

  const metadata: Record<string, unknown> = {};
  if (hasSchema) {
    metadata.settings = normalizedSettings;
  } else {
    if (body.aspectRatio) metadata.aspectRatio = body.aspectRatio;
    if (body.resolution) metadata.resolution = body.resolution;
    if (body.seed !== undefined) metadata.seed = body.seed;
    if (body.durationSec != null) metadata.durationSec = body.durationSec;
  }

  const mod = await moderateGenerationInput({
    prompt: body.prompt,
    negativePrompt: negativePromptMerged,
    userId,
    modelId: model.id,
    flow: "video",
  });
  if (!mod.allowed) {
    return NextResponse.json(
      {
        error: MODERATION_USER_MESSAGE,
        reason: mod.reason,
        rule: mod.rule,
        matchedText: mod.matchedText,
      },
      { status: 400 },
    );
  }

  const {
    credits: costCreditsCalculated,
    priceBreakdown,
  } = calculateGenerationCreditsWithBreakdown(model, normalizedSettings);
  metadata.priceBreakdown = priceBreakdown;

  if (
    body.clientEstimateCredits != null &&
    Number.isFinite(body.clientEstimateCredits) &&
    Math.round(body.clientEstimateCredits) !== costCreditsCalculated
  ) {
    return NextResponse.json(
      {
        error: "Цена изменилась. Обновите оценку и повторите отправку.",
        code: "PRICE_CHANGED" as const,
        credits: costCreditsCalculated,
      },
      { status: 409 },
    );
  }

  let balance: number;
  try {
    balance = await getBalance(userId);
  } catch {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  if (balance < costCreditsCalculated) {
    return NextResponse.json(
      { error: "Недостаточно кредитов" },
      { status: 402 },
    );
  }

  const gen = await prisma.generation.create({
    data: {
      userId,
      modelId: model.id,
      type: "VIDEO",
      status: "QUEUED",
      prompt: body.prompt,
      negativePrompt: negativePromptMerged,
      inputFiles: inputFilesCombined.length
        ? (inputFilesCombined as Prisma.InputJsonValue)
        : undefined,
      costCredits: costCreditsCalculated,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  try {
    await reserveCredits(
      userId,
      costCreditsCalculated,
      gen.id,
      "Резерв под видео",
    );
  } catch (e) {
    await prisma.generation.delete({ where: { id: gen.id } });
    if (e instanceof CreditServiceError && e.code === "INSUFFICIENT") {
      return NextResponse.json(
        { error: "Недостаточно кредитов" },
        { status: 402 },
      );
    }
    return NextResponse.json(
      { error: publicApiErrorMessage(e, "Ошибка резерва кредитов") },
      { status: 400 },
    );
  }

  if (queueMode === "inline") {
    await processGeneration(gen.id);
    const out = await prisma.generation.findUnique({ where: { id: gen.id } });
    return NextResponse.json(
      {
        generationId: gen.id,
        status: (out?.status ?? "QUEUED") as
          | "QUEUED"
          | "PROCESSING"
          | "COMPLETED"
          | "FAILED"
          | "REFUNDED"
          | "CANCELLED"
          | "BLOCKED"
          | "CREATED",
        ...(out?.providerTaskId != null && out.providerTaskId !== ""
          ? { providerTaskId: out.providerTaskId }
          : {}),
        ...(out?.errorMessage ? { error: out.errorMessage } : {}),
      },
      { status: 201 },
    );
  }

  const redisUp = await isRedisReachableForQueue();
  if (!redisUp) {
    try {
      await refundCredits(gen.id, "Возврат: Redis недоступен");
    } catch {
      // ignore
    }
    await prisma.generation
      .delete({ where: { id: gen.id } })
      .catch(() => {});
    return NextResponse.json(
      {
        error: "QUEUE_UNAVAILABLE",
        message: "Очередь генерации временно недоступна. Проверьте Redis/worker.",
      },
      { status: 503 },
    );
  }

  try {
    await enqueueGenerationJob(gen.id);
  } catch {
    try {
      await refundCredits(gen.id, "Возврат: очередь недоступна");
    } catch {
      // ignore
    }
    await prisma.generation
      .delete({ where: { id: gen.id } })
      .catch(() => {});
    return NextResponse.json(
      {
        error: "QUEUE_UNAVAILABLE",
        message: "Очередь генерации временно недоступна. Проверьте Redis/worker.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      generationId: gen.id,
      status: "QUEUED" as const,
    },
    { status: 201 },
  );
}
