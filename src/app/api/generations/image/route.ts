import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";

import {
  kieReachableImageUrlsFromInputFiles,
  KIE_REQUIRES_PUBLIC_IMAGE_URLS_RU,
  publicHttpUrlsOnly,
  validateImageInputFiles,
} from "@/lib/generation-input-limits";
import { isMockKie } from "@/lib/kie-mock";
import { prisma } from "@/lib/prisma";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { publicApiErrorMessage } from "@/lib/safe-api-error";
import { imageGenerationBodySchema } from "@/lib/validations/image-generation";
import { enqueueGenerationJob } from "@/server/queues/generationQueue";
import { isRedisReachableForQueue } from "@/server/queues/redisConnection";
import { CreditServiceError, getBalance, refundCredits, reserveCredits } from "@/server/services/credits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { MODERATION_USER_MESSAGE, moderateGenerationInput } from "@/server/services/moderation";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";
import {
  modelHasSettingsSchema,
  validateAndNormalizeModelSettings,
} from "@/server/services/model-settings";
import {
  calculateGenerationCreditsWithBreakdown,
} from "@/server/services/pricing";
import { validateStrictKieMarketPayload } from "@/server/services/kieModelPayloadValidation";
import {
  isGrokImagineModel,
  validateGrokImagineSettings,
} from "@/server/services/grok-imagine-settings";

function redisAndKieReady() {
  return (
    Boolean(process.env.REDIS_URL?.trim()) &&
    Boolean(process.env.KIE_API_KEY?.trim()) &&
    Boolean(process.env.KIE_BASE_URL?.trim())
  );
}

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

  const parsed = imageGenerationBodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Некорректные данные";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const body = parsed.data;

  if (!redisAndKieReady()) {
    return NextResponse.json(
      { error: "Генерация недоступна: настройте REDIS_URL, KIE_API_KEY и KIE_BASE_URL" },
      { status: 503 },
    );
  }

  const model = await prisma.aiModel.findFirst({
    where: {
      id: body.modelId,
      isActive: true,
      type: "IMAGE",
      scope: "GENERAL",
    },
  });
  if (!model) {
    return NextResponse.json(
      { error: "Модель не найдена или недоступна" },
      { status: 404 },
    );
  }

  if (body.negativePrompt && !model.supportsNegativePrompt) {
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
  }
  if (hasSchema && isGrokImagineModel(model.apiModelId)) {
    const gVal = validateGrokImagineSettings(model.apiModelId, normalizedSettings);
    if (!gVal.ok) {
      return NextResponse.json({ error: gVal.message }, { status: 400 });
    }
  }

  const imageUrlsFromSettings =
    hasSchema && Array.isArray(normalizedSettings.imageUrls)
      ? normalizedSettings.imageUrls.filter((x): x is string => typeof x === "string")
      : [];
  const inputFilesCombined = [...(body.inputFiles ?? []), ...imageUrlsFromSettings];

  if (inputFilesCombined.length > 0 && !model.supportsImageInput) {
    return NextResponse.json(
      { error: "Эта модель не поддерживает входные изображения" },
      { status: 400 },
    );
  }

  const filesCheck = validateImageInputFiles(
    inputFilesCombined.length > 0 ? inputFilesCombined : undefined,
  );
  if (!filesCheck.ok) {
    return NextResponse.json({ error: filesCheck.error }, { status: 400 });
  }

  const httpUrls = publicHttpUrlsOnly(inputFilesCombined);
  if (inputFilesCombined.length > 0 && model.supportsImageInput) {
    const hasData = inputFilesCombined.some((s) => s.trim().startsWith("data:"));
    if (hasData) {
      return NextResponse.json(
        {
          error:
            "Референсы в API передаются как публичные https URL. Загрузка base64 с устройства будет в поздней стадии хранилища.",
        },
        { status: 400 },
      );
    }
    if (!isMockKie() && model.provider === "KIE_AI") {
      if (kieReachableImageUrlsFromInputFiles(inputFilesCombined).length === 0) {
        return NextResponse.json({ error: KIE_REQUIRES_PUBLIC_IMAGE_URLS_RU }, { status: 400 });
      }
    } else if (httpUrls.length === 0) {
      return NextResponse.json(
        { error: "Укажите хотя бы один публичный URL изображения" },
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
  }

  const mod = await moderateGenerationInput({
    prompt: body.prompt,
    negativePrompt: body.negativePrompt ?? null,
    userId,
    modelId: model.id,
    flow: "image",
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

  const { credits: costCreditsCalculated, priceBreakdown } =
    calculateGenerationCreditsWithBreakdown(model, normalizedSettings);

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
      type: "IMAGE",
      status: "QUEUED",
      prompt: body.prompt,
      negativePrompt: body.negativePrompt ?? null,
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
      "Резерв под изображение",
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
  } catch (e) {
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
        error: publicApiErrorMessage(
          e,
          "Не удалось поставить задачу в очередь. Повторите позже.",
        ),
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
