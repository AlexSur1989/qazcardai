import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";

import { auth } from "@/auth";
import { publicHttpUrlsOnly, validateImageInputFiles } from "@/lib/generation-input-limits";
import { prisma } from "@/lib/prisma";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { publicApiErrorMessage } from "@/lib/safe-api-error";
import { imageGenerationBodySchema } from "@/lib/validations/image-generation";
import { CreditServiceError, getBalance, refundCredits, reserveCredits } from "@/server/services/credits";
import { enqueueGenerationJob } from "@/server/queues/generationQueue";
import {
  createBlockedByModeration,
  moderateGenerationInput,
} from "@/server/services/moderation";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";

function redisAndKieReady() {
  return (
    Boolean(process.env.REDIS_URL?.trim()) &&
    Boolean(process.env.KIE_API_KEY?.trim()) &&
    Boolean(process.env.KIE_BASE_URL?.trim())
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }
  const userId = session.user.id;

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

  const filesCheck = validateImageInputFiles(body.inputFiles);
  if (!filesCheck.ok) {
    return NextResponse.json({ error: filesCheck.error }, { status: 400 });
  }

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
  if (body.inputFiles?.length && !model.supportsImageInput) {
    return NextResponse.json(
      { error: "Эта модель не поддерживает входные изображения" },
      { status: 400 },
    );
  }

  const httpUrls = publicHttpUrlsOnly(body.inputFiles);
  if (body.inputFiles?.length && model.supportsImageInput) {
    const hasData = body.inputFiles.some((s) => s.trim().startsWith("data:"));
    if (hasData) {
      return NextResponse.json(
        {
          error:
            "Референсы в API передаются как публичные https URL. Загрузка base64 с устройства будет в поздней стадии хранилища.",
        },
        { status: 400 },
      );
    }
    if (httpUrls.length === 0) {
      return NextResponse.json(
        { error: "Укажите хотя бы один публичный URL изображения" },
        { status: 400 },
      );
    }
  }

  let balance: number;
  try {
    balance = await getBalance(userId);
  } catch {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  if (balance < model.costCredits) {
    return NextResponse.json(
      { error: "Недостаточно кредитов" },
      { status: 402 },
    );
  }

  const metadata: Record<string, unknown> = {};
  if (body.aspectRatio) metadata.aspectRatio = body.aspectRatio;
  if (body.resolution) metadata.resolution = body.resolution;
  if (body.seed !== undefined) metadata.seed = body.seed;

  const mod = await moderateGenerationInput({
    prompt: body.prompt,
    negativePrompt: body.negativePrompt ?? null,
  });
  if (!mod.allowed) {
    const blocked = await createBlockedByModeration({
      userId,
      model,
      type: "IMAGE",
      prompt: body.prompt,
      negativePrompt: body.negativePrompt ?? null,
      inputFiles: body.inputFiles
        ? (body.inputFiles as Prisma.InputJsonValue)
        : undefined,
      metadata:
        Object.keys(metadata).length > 0
          ? (metadata as Prisma.InputJsonValue)
          : undefined,
      mod,
    });
    return NextResponse.json(
      {
        generationId: blocked.id,
        status: "BLOCKED" as const,
        error: mod.reason,
      },
      { status: 201 },
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
      inputFiles: body.inputFiles
        ? (body.inputFiles as Prisma.InputJsonValue)
        : undefined,
      costCredits: model.costCredits,
      metadata:
        Object.keys(metadata).length > 0
          ? (metadata as Prisma.InputJsonValue)
          : undefined,
    },
  });

  try {
    await reserveCredits(userId, model.costCredits, gen.id, "Резерв под изображение");
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
