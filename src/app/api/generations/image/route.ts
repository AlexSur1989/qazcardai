import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";

import { auth } from "@/auth";
import { createApiLog } from "@/server/services/api-log";
import {
  CreditServiceError,
  confirmCredits,
  getBalance,
  refundCredits,
  reserveCredits,
} from "@/server/services/credits";
import {
  buildKieRequestBodyForLog,
  generateImage,
  getKieGenerateRequestUrl,
  redactKieLogPayload,
} from "@/server/services/provider/kie";
import {
  publicHttpUrlsOnly,
  validateImageInputFiles,
} from "@/lib/generation-input-limits";
import { prisma } from "@/lib/prisma";
import { imageGenerationBodySchema } from "@/lib/validations/image-generation";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }
  const userId = session.user.id;

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

  const kieReady =
    Boolean(process.env.KIE_API_KEY?.trim()) &&
    Boolean(process.env.KIE_BASE_URL?.trim());
  if (!kieReady) {
    return NextResponse.json(
      { error: "Генерация недоступна: не настроены KIE_API_KEY и KIE_BASE_URL" },
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

  const gen = await prisma.generation.create({
    data: {
      userId,
      modelId: model.id,
      type: "IMAGE",
      status: "CREATED",
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
    await reserveCredits(userId, model.costCredits, gen.id);
  } catch (e) {
    await prisma.generation.delete({ where: { id: gen.id } });
    if (e instanceof CreditServiceError && e.code === "INSUFFICIENT") {
      return NextResponse.json(
        { error: "Недостаточно кредитов" },
        { status: 402 },
      );
    }
    const msg = e instanceof Error ? e.message : "Ошибка резерва кредитов";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await prisma.generation.update({
    where: { id: gen.id },
    data: { status: "PROCESSING" },
  });

  const kieInput = {
    apiModelId: model.apiModelId,
    endpoint: model.endpoint,
    prompt: body.prompt,
    negativePrompt: model.supportsNegativePrompt ? body.negativePrompt ?? null : null,
    aspectRatio: body.aspectRatio ?? null,
    resolution: body.resolution ?? null,
    seed: model.supportsSeed ? body.seed ?? null : null,
    inputFileUrls: model.supportsImageInput ? httpUrls : undefined,
  };

  let result: Awaited<ReturnType<typeof generateImage>>;
  try {
    result = await generateImage(kieInput);
  } catch (e) {
    const err = e instanceof Error ? e.message : "Ошибка провайдера";
    result = {
      success: false,
      httpStatus: 0,
      rawResponse: null,
      errorMessage: err,
    };
  }

  const requestUrl = getKieGenerateRequestUrl(kieInput);
  const requestLog = {
    requestUrl,
    body: redactKieLogPayload(buildKieRequestBodyForLog(kieInput)),
  };

  const errText =
    result.errorMessage ??
    (!result.success ? "Провайдер не подтвердил успех" : null);

  await createApiLog({
    generationId: gen.id,
    provider: "KIE_AI",
    endpoint: requestUrl.slice(0, 2048),
    requestPayload: requestLog,
    responsePayload: redactKieLogPayload(result.rawResponse),
    statusCode: result.httpStatus,
    errorMessage: result.success ? null : errText,
  });

  if (!result.success) {
    try {
      await refundCredits(gen.id, "Возврат: ошибка Kie.ai");
    } catch {
      // best effort
    }
    await prisma.generation.update({
      where: { id: gen.id },
      data: {
        status: "FAILED",
        errorMessage: errText?.slice(0, 8000) ?? "Ошибка провайдера",
        completedAt: new Date(),
      },
    });
    return NextResponse.json(
      {
        generationId: gen.id,
        status: "FAILED",
        error: errText ?? "Ошибка генерации",
      },
      { status: 201 },
    );
  }

  const imageUrls = result.imageUrls ?? [];
  const hasImages = imageUrls.length > 0;
  const nextStatus = hasImages ? "COMPLETED" : "PROCESSING";

  const outputFiles = hasImages
    ? (imageUrls.map((url) => ({ url })) as Prisma.InputJsonValue)
    : undefined;

  await prisma.generation.update({
    where: { id: gen.id },
    data: {
      status: nextStatus,
      providerTaskId: result.taskId ?? null,
      outputFiles: outputFiles ?? undefined,
      completedAt: hasImages ? new Date() : null,
    },
  });

  try {
    await confirmCredits(gen.id);
  } catch {
    // оставляем PROCESSING/COMPLETED; CAPTURE можно догнать вручную при сбое
  }

  return NextResponse.json(
    {
      generationId: gen.id,
      status: nextStatus,
      providerTaskId: result.taskId ?? null,
      outputUrls: hasImages ? imageUrls : undefined,
    },
    { status: 201 },
  );
}
