
import { Prisma } from "@/generated/prisma/client";
import type { AiModel, Generation } from "@/generated/prisma/client";
import { publicHttpUrlsOnly } from "@/lib/generation-input-limits";
import { isRecord } from "@/lib/model-pricing-shared";
import { validateVideoInputFiles } from "@/lib/video-input-limits";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { buildImageKieInput, buildVideoKieInput } from "@/server/services/generationProcessor";
import {
  modelHasSettingsSchema,
  validateAndNormalizeModelSettings,
} from "@/server/services/model-settings";
import { createApiLog } from "@/server/services/api-log";
import { calculateGenerationCredits } from "@/server/services/pricing";
import { assertKlingMotionUrlsOwnedByUser } from "@/server/services/kling-motion-control-settings";
import {
  collectKlingMotionControlHttpUrls,
  isKlingMotionControlModel,
  validateKlingMotionControlSettings,
} from "@/server/services/kling-motion-control-settings";
import {
  isKling30Model,
  validateKling30Settings,
} from "@/server/services/kling-settings";
import {
  collectSeedanceSettingsHttpUrls,
  isSeedanceScenarioModel,
  validateSeedanceScenario,
} from "@/server/services/seedance-settings";
import {
  assertKieModelIdSet,
  buildKieRequestBodyForLog,
  buildKieVideoRequestBodyForLog,
  generateImage,
  generateVideo,
  getKieGenerateRequestUrl,
  getKieVideoGenerateRequestUrl,
  type NormalizedKieImageResult,
  redactKieLogPayload,
  type KieImageGenerateInput,
  type KieVideoGenerateInput,
} from "@/server/services/provider/kie";

export type AdminModelTestInput = {
  prompt: string;
  settings: Record<string, unknown>;
  inputFiles?: string[];
  negativePrompt?: string | null;
  aspectRatio?: string;
  resolution?: string;
  seed?: number;
  durationSec?: number;
};

export type AdminTestPricingInfo = {
  costCredits: number;
  pricingSource: string;
  note?: string;
};

function pricingNote(model: AiModel): string {
  const ps = model.pricingSchema;
  if (!isRecord(ps) || ps.type !== "matrix") {
    return "Без matrix — используется costCredits модели.";
  }
  if (isRecord(ps.manualOverrides)) {
    return "Проверьте manualOverrides в Pricing Studio (приоритет над auto).";
  }
  return "Оценка по pricingSchema и настройкам.";
}

type VideoBuildOk = {
  kind: "video";
  kieIn: KieVideoGenerateInput;
  costCredits: number;
  payload: unknown;
  pricing: AdminTestPricingInfo;
  warnings: string[];
};

type ImageBuildOk = {
  kind: "image";
  kieIn: KieImageGenerateInput;
  costCredits: number;
  payload: unknown;
  pricing: AdminTestPricingInfo;
  warnings: string[];
};

type BuildErr = { ok: false; error: string; statusCode: number };

type BuildAll = (VideoBuildOk | ImageBuildOk) | BuildErr;

/**
 * Сбор KIE-ввода и JSON payload; совпадает с /api/generations (video|image) без queue/moderation/credits.
 */
export async function buildAdminModelKieInput(args: {
  model: AiModel;
  input: AdminModelTestInput;
  checkMotionUrlOwnership: boolean;
  userIdForOwnership?: string;
}): Promise<BuildAll> {
  const { model, input: body, checkMotionUrlOwnership, userIdForOwnership } = args;
  const warnings: string[] = [];

  if (!body.prompt?.trim()) {
    return { ok: false, error: "Укажите prompt", statusCode: 400 };
  }

  if (model.type === "IMAGE") {
    return buildImageTest(model, body, warnings);
  }
  if (model.type === "VIDEO") {
    return buildVideoTest(
      model,
      body,
      warnings,
      checkMotionUrlOwnership,
      userIdForOwnership,
    );
  }
  return { ok: false, error: "Поддерживаются IMAGE и VIDEO", statusCode: 400 };
}

function buildImageTest(
  model: AiModel,
  body: AdminModelTestInput,
  warnings: string[],
): BuildAll {
  const hasSchema = modelHasSettingsSchema(model.settingsSchema);
  let normalizedSettings: Record<string, unknown> = {};
  if (hasSchema) {
    const v = validateAndNormalizeModelSettings(
      model.settingsSchema,
      body.settings ?? {},
    );
    if (!v.ok) {
      return { ok: false, error: v.message, statusCode: 400 };
    }
    normalizedSettings = v.settings;
  }
  if (body.negativePrompt && !model.supportsNegativePrompt) {
    return { ok: false, error: "Модель не поддерживает negative prompt", statusCode: 400 };
  }
  if (body.seed !== undefined && !model.supportsSeed) {
    return { ok: false, error: "Модель не поддерживает seed", statusCode: 400 };
  }
  const imageUrlsFromSettings =
    hasSchema && Array.isArray(normalizedSettings.imageUrls)
      ? normalizedSettings.imageUrls.filter((x): x is string => typeof x === "string")
      : [];
  const inputFilesCombined = [...(body.inputFiles ?? []), ...imageUrlsFromSettings];
  if (inputFilesCombined.length > 0 && !model.supportsImageInput) {
    return { ok: false, error: "Модель не поддерживает входные изображения", statusCode: 400 };
  }
  if (inputFilesCombined.length > 0) {
    if (publicHttpUrlsOnly(inputFilesCombined).length === 0) {
      return { ok: false, error: "Нужен публичный http(s) URL", statusCode: 400 };
    }
  }

  const costCredits = calculateGenerationCredits(model, normalizedSettings);
  const metadata: Record<string, unknown> = {};
  if (hasSchema) {
    metadata.settings = normalizedSettings;
  } else {
    if (body.aspectRatio) metadata.aspectRatio = body.aspectRatio;
    if (body.resolution) metadata.resolution = body.resolution;
    if (body.seed !== undefined) metadata.seed = body.seed;
  }
  const gen = {
    id: "admin_test",
    prompt: body.prompt,
    negativePrompt: body.negativePrompt?.trim() ?? null,
    metadata:
      (Object.keys(metadata).length > 0
        ? metadata
        : undefined) as Prisma.JsonValue,
    inputFiles:
      inputFilesCombined.length > 0
        ? (inputFilesCombined as Prisma.JsonValue)
        : undefined,
  } as unknown as Generation;

  const kieIn = buildImageKieInput(gen, model);
  const payload = redactKieLogPayload(buildKieRequestBodyForLog(kieIn));
  return {
    kind: "image",
    kieIn,
    costCredits,
    payload,
    pricing: {
      costCredits,
      pricingSource: isRecord(model.pricingSchema) && model.pricingSchema.pricingSource
        ? String(model.pricingSchema.pricingSource)
        : "модель / costCredits",
      note: pricingNote(model),
    },
    warnings,
  };
}

async function buildVideoTest(
  model: AiModel,
  body: AdminModelTestInput,
  warnings: string[],
  checkMotionUrlOwnership: boolean,
  userIdForOwnership: string | undefined,
): Promise<BuildAll> {
  const hasSchema = modelHasSettingsSchema(model.settingsSchema);
  let normalizedSettings: Record<string, unknown> = {};
  if (hasSchema) {
    const v = validateAndNormalizeModelSettings(
      model.settingsSchema,
      body.settings ?? {},
    );
    if (!v.ok) {
      return { ok: false, error: v.message, statusCode: 400 };
    }
    normalizedSettings = v.settings;
    if (model.maxDuration != null && !isKlingMotionControlModel(model.apiModelId)) {
      const d = Number.parseInt(String(normalizedSettings.duration ?? ""), 10);
      if (!Number.isInteger(d) || d < 1 || d > model.maxDuration) {
        return {
          ok: false,
          error: `Длительность: от 1 до ${model.maxDuration} с`,
          statusCode: 400,
        };
      }
    }
    if (isSeedanceScenarioModel(model.apiModelId)) {
      const sVal = validateSeedanceScenario(normalizedSettings);
      if (!sVal.ok) {
        return { ok: false, error: sVal.message, statusCode: 400 };
      }
    }
    if (isKling30Model(model.apiModelId)) {
      const kVal = validateKling30Settings(normalizedSettings);
      if (!kVal.ok) {
        return { ok: false, error: kVal.message, statusCode: 400 };
      }
    }
    if (isKlingMotionControlModel(model.apiModelId)) {
      const mc = validateKlingMotionControlSettings(normalizedSettings);
      if (!mc.ok) {
        return { ok: false, error: mc.message, statusCode: 400 };
      }
      if (checkMotionUrlOwnership && userIdForOwnership) {
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
        const own = await assertKlingMotionUrlsOwnedByUser(
          userIdForOwnership,
          iu,
          vu,
        );
        if (!own.ok) {
          return { ok: false, error: own.message, statusCode: 400 };
        }
      } else {
        warnings.push(
          "Админ-тест: владельцев URL для Motion Control не проверяем.",
        );
      }
    }
  } else if (body.durationSec != null) {
    if (model.maxDuration == null) {
      return {
        ok: false,
        error: "Длительность для этой модели не настраивается",
        statusCode: 400,
      };
    }
    if (body.durationSec > model.maxDuration) {
      return {
        ok: false,
        error: `Максимальная длительность: ${model.maxDuration} с`,
        statusCode: 400,
      };
    }
  }

  const negativePromptMerged =
    (hasSchema &&
    typeof normalizedSettings.negativePrompt === "string" &&
    normalizedSettings.negativePrompt.trim() !== ""
      ? normalizedSettings.negativePrompt.trim()
      : null) ?? body.negativePrompt?.trim() ?? null;

  if (negativePromptMerged && !model.supportsNegativePrompt) {
    return { ok: false, error: "Модель не поддерживает negative prompt", statusCode: 400 };
  }
  if (body.seed !== undefined && !model.supportsSeed) {
    return { ok: false, error: "Модель не поддерживает seed", statusCode: 400 };
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
    if (Array.isArray(normalizedSettings.imageUrls)) {
      return normalizedSettings.imageUrls.filter(
        (x): x is string => typeof x === "string",
      );
    }
    return [] as string[];
  })();
  const inputFilesCombined = [...(body.inputFiles ?? []), ...imageUrlsFromSettings];
  const filesCheck = validateVideoInputFiles(
    inputFilesCombined.length > 0 ? inputFilesCombined : undefined,
  );
  if (!filesCheck.ok) {
    return { ok: false, error: filesCheck.error, statusCode: 400 };
  }
  if (
    inputFilesCombined.length > 0 &&
    !model.supportsImageInput &&
    !model.supportsVideoInput
  ) {
    return { ok: false, error: "Модель не поддерживает вложения", statusCode: 400 };
  }
  if (inputFilesCombined.length > 0) {
    const hasData = inputFilesCombined.some((s) => s.trim().startsWith("data:"));
    if (hasData) {
      return {
        ok: false,
        error: "Используйте публичные http(s) URL (не data:)",
        statusCode: 400,
      };
    }
    if (publicHttpUrlsOnly(inputFilesCombined).length === 0) {
      return { ok: false, error: "Нужен публичный http(s) URL", statusCode: 400 };
    }
  }

  const costCredits = calculateGenerationCredits(model, normalizedSettings);
  const metadata: Record<string, unknown> = {};
  if (hasSchema) {
    metadata.settings = normalizedSettings;
  } else {
    if (body.aspectRatio) metadata.aspectRatio = body.aspectRatio;
    if (body.resolution) metadata.resolution = body.resolution;
    if (body.seed !== undefined) metadata.seed = body.seed;
    if (body.durationSec != null) metadata.durationSec = body.durationSec;
  }
  const gen = {
    id: "admin_test",
    prompt: body.prompt,
    negativePrompt: negativePromptMerged,
    metadata:
      (Object.keys(metadata).length > 0
        ? metadata
        : undefined) as Prisma.JsonValue,
    inputFiles:
      inputFilesCombined.length > 0
        ? (inputFilesCombined as Prisma.JsonValue)
        : undefined,
  } as unknown as Generation;

  const kieIn = buildVideoKieInput(gen, model);
  const payload = redactKieLogPayload(buildKieVideoRequestBodyForLog(kieIn));
  return {
    kind: "video",
    kieIn,
    costCredits,
    payload,
    pricing: {
      costCredits,
      pricingSource: isRecord(model.pricingSchema) && model.pricingSchema.pricingSource
        ? String(model.pricingSchema.pricingSource)
        : "модель / matrix / costCredits",
      note: pricingNote(model),
    },
    warnings,
  };
}

const MOCK_ID_PREFIX = "mock_admin_test_";

export function buildMockProviderTaskId(): string {
  return `${MOCK_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function mockTestMessage(): string {
  return "Mock test completed successfully";
}

export async function runAdminModelRealKieTest(args: {
  model: AiModel;
  input: AdminModelTestInput;
  adminUserId: string;
}): Promise<
  | {
      ok: true;
      providerTaskId: string | null;
      status: string;
      httpStatus: number;
      payload: unknown;
      providerResponse: unknown;
    }
  | {
      ok: false;
      error: string;
      statusCode: number;
      httpStatus: number;
      payload?: unknown;
      providerResponse?: unknown;
    }
> {
  const { model, input, adminUserId } = args;
  const built = await buildAdminModelKieInput({
    model,
    input,
    checkMotionUrlOwnership: false,
  });
  if (!("kind" in built)) {
    return {
      ok: false,
      error: built.error,
      statusCode: built.statusCode,
      httpStatus: 0,
    };
  }
  if (built.kind === "image") {
    return runKieImageAndLog(built.kieIn, model, adminUserId, built.payload);
  }
  return runKieVideoAndLog(built.kieIn, model, adminUserId, built.payload);
}

async function runKieVideoAndLog(
  kieIn: KieVideoGenerateInput,
  model: AiModel,
  adminUserId: string,
  requestPayloadForLog: unknown,
): Promise<
  | {
      ok: true;
      providerTaskId: string | null;
      status: string;
      httpStatus: number;
      payload: unknown;
      providerResponse: unknown;
    }
  | {
      ok: false;
      error: string;
      statusCode: number;
      httpStatus: number;
      payload?: unknown;
      providerResponse?: unknown;
    }
> {
  const url = getKieVideoGenerateRequestUrl(kieIn);
  const result = await generateVideo(kieIn);
  return finalizeRealTest(
    result,
    url,
    requestPayloadForLog,
    model,
    adminUserId,
  );
}

async function runKieImageAndLog(
  kieIn: KieImageGenerateInput,
  model: AiModel,
  adminUserId: string,
  requestPayloadForLog: unknown,
): Promise<
  | {
      ok: true;
      providerTaskId: string | null;
      status: string;
      httpStatus: number;
      payload: unknown;
      providerResponse: unknown;
    }
  | {
      ok: false;
      error: string;
      statusCode: number;
      httpStatus: number;
      payload?: unknown;
      providerResponse?: unknown;
    }
> {
  const url = getKieGenerateRequestUrl(kieIn);
  const result = await generateImage(kieIn);
  return finalizeRealTest(
    result,
    url,
    requestPayloadForLog,
    model,
    adminUserId,
  );
}

function finalizeRealTest(
  result: NormalizedKieImageResult,
  url: string,
  requestPayloadForLog: unknown,
  model: AiModel,
  adminUserId: string,
) {
  const providerResponse = redactKieLogPayload(result.rawResponse);
  const errMsg = result.success
    ? null
    : (result.errorMessage ?? "Ошибка провайдера").slice(0, 10_000);

  void createApiLog({
    generationId: null,
    provider: "KIE_AI",
    endpoint: url.slice(0, 2048),
    requestPayload: {
      adminTest: true,
      modelId: model.id,
      body: requestPayloadForLog,
    } as object,
    responsePayload: {
      adminTest: true,
      modelId: model.id,
      data: providerResponse,
      success: result.success,
      taskId: result.taskId,
    } as object,
    statusCode: result.httpStatus,
    errorMessage: errMsg,
  }).catch(() => {});

  const apiId = assertKieModelIdSet(model.apiModelId);
  void writeAdminAuditLog({
    adminUserId,
    action: "AI_MODEL_REAL_TEST_RUN",
    targetType: "AiModel",
    targetId: model.id,
    metadata: {
      apiModelId: apiId,
      endpoint: String(model.endpoint ?? "").slice(0, 500),
      statusCode: result.httpStatus,
      ok: result.success,
    },
  });

  if (!result.success) {
    return {
      ok: false as const,
      error: result.errorMessage ?? "Ошибка Kie",
      statusCode: result.httpStatus >= 400 && result.httpStatus < 600
        ? result.httpStatus
        : 502,
      httpStatus: result.httpStatus,
      payload: requestPayloadForLog,
      providerResponse,
    };
  }
  return {
    ok: true as const,
    providerTaskId: result.taskId ?? null,
    status: "submitted",
    httpStatus: result.httpStatus,
    payload: requestPayloadForLog,
    providerResponse,
  };
}
