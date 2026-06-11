import { createHash } from "node:crypto";

import type { AiModel } from "@/generated/prisma/client";
import { SIMPLE_CARD_REFERENCE_UNSUPPORTED_MESSAGE } from "@/lib/simple-product-card-model";
import type { SimpleCardAspectRatio } from "@/config/simple-product-card";
import { coerceProductCardImageResolution } from "@/config/product-card-image-resolution";
import {
  aspectRatioToSimpleCardSizeId,
  normalizeSimpleCardPayload,
  simpleCardUsesReference,
  simpleProductCardRequestSchema,
  type SimpleProductCardRequest,
} from "@/lib/validations/simple-product-card";
import { assertUserOwnsFileUrl, getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { assertMarketplaceCardScenarioEnabled } from "@/server/services/productCardScenarios";
import { marketplaceModelProductImageError } from "@/server/services/productCardModelResolver";
import {
  assertProductCardPriceAllowed,
  calculateProductCardMarketplaceCardCredits,
  type ProductCardPriceBreakdown,
} from "@/server/services/productCardPricing";
import { PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE } from "@/server/services/productCardSettings";
import { buildImageModelInput, queueProductCardImage } from "@/server/services/productCardQueueGenerations";
import { validateStrictKieMarketPayload } from "@/server/services/kieModelPayloadValidation";
import { buildSimpleProductCardPrompt } from "@/server/services/simpleProductCardPromptBuilder";
import {
  appendSimpleCardGeneration,
  saveSimpleCardSettings,
} from "@/server/services/simpleProductCardMeta";
import {
  getSimpleProductCardRuntimeSettings,
  resolveSimpleProductCardImageModel,
} from "@/server/services/simpleProductCardSettings";
import { prisma } from "@/lib/prisma";

type SimpleCardOutputSize = {
  id: string;
  kieAspectRatio: string;
  kieResolution: string;
  width: number;
  height: number;
};

const SIMPLE_CARD_OUTPUT_SIZES: Record<SimpleCardAspectRatio, SimpleCardOutputSize> = {
  "1:1": { id: "1x1", kieAspectRatio: "1:1", kieResolution: "1K", width: 1024, height: 1024 },
  "4:3": { id: "4x3", kieAspectRatio: "4:3", kieResolution: "1K", width: 1200, height: 900 },
  "3:4": { id: "3x4", kieAspectRatio: "3:4", kieResolution: "1K", width: 1200, height: 1600 },
  "16:9": { id: "16x9", kieAspectRatio: "16:9", kieResolution: "1K", width: 1344, height: 768 },
  "9:16": { id: "9x16", kieAspectRatio: "9:16", kieResolution: "1K", width: 768, height: 1344 },
};

function resolveSimpleCardOutputSize(aspectRatio: SimpleCardAspectRatio): SimpleCardOutputSize {
  return SIMPLE_CARD_OUTPUT_SIZES[aspectRatio];
}

type ServiceErr = { ok: false; error: string; status: number; code?: string };
type EstimateOk = { ok: true; credits: number; planHash: string; supportsReference: boolean; modelSlug: string };
type GenOk = { ok: true; generationId: string; status: string; costCredits: number };

async function resolveProductPhotoUrl(userId: string, fileId: string): Promise<string | ServiceErr> {
  const row = await prisma.uploadedFile.findFirst({
    where: { id: fileId, userId },
    select: { url: true },
  });
  const url = row?.url?.trim();
  if (!url) {
    return { ok: false, error: "Фото товара не найдено", status: 404, code: "PRODUCT_PHOTO_NOT_FOUND" };
  }
  if (!(await assertUserOwnsFileUrl(userId, url))) {
    return { ok: false, error: "Нет доступа к фото товара", status: 403 };
  }
  return url;
}

async function resolveReferencePhotoUrl(
  userId: string,
  fileId: string | null | undefined,
): Promise<string | null | ServiceErr> {
  if (!fileId?.trim()) return null;
  const row = await prisma.uploadedFile.findFirst({
    where: { id: fileId.trim(), userId },
    select: { url: true },
  });
  const url = row?.url?.trim();
  if (!url) {
    return { ok: false, error: "Фото-референс не найдено", status: 404, code: "REFERENCE_NOT_FOUND" };
  }
  if (!(await assertUserOwnsFileUrl(userId, url))) {
    return { ok: false, error: "Нет доступа к фото-референсу", status: 403 };
  }
  return url;
}

function buildModelSettingsMerge(
  model: AiModel,
  productUrl: string,
  referenceUrl: string | null,
  aspectRatio: SimpleProductCardRequest["aspectRatio"],
  resolutionOverride?: string,
): { ok: true; merged: Record<string, unknown> } | { ok: false; error: string } {
  const resolved = resolveSimpleCardOutputSize(aspectRatio);
  const resolution = coerceProductCardImageResolution(resolutionOverride);
  try {
    const b = buildImageModelInput(
      { settingsSchema: model.settingsSchema, supportsImageInput: model.supportsImageInput },
      productUrl,
      referenceUrl ? { styleReferenceUrls: [referenceUrl] } : undefined,
    );
    const merged = {
      ...b.normalizedSettings,
      size: resolved.id,
      aspectRatio: resolved.kieAspectRatio,
      resolution,
      outputWidth: resolved.width,
      outputHeight: resolved.height,
      simpleCardOutputSizeId: resolved.id,
    };
    const gptVal = validateStrictKieMarketPayload(
      { apiModelId: model.apiModelId, payloadMapping: model.payloadMapping },
      "simple product card",
      merged,
      [productUrl],
    );
    if (!gptVal.ok) {
      return { ok: false, error: gptVal.message };
    }
    return { ok: true, merged };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Некорректные настройки модели" };
  }
}

export function computeSimpleCardPlanHash(payload: SimpleProductCardRequest): string {
  const norm = normalizeSimpleCardPayload(payload);
  return createHash("sha256").update(JSON.stringify(norm)).digest("hex");
}

export async function estimateSimpleProductCard(
  userId: string,
  projectId: string,
  rawPayload: unknown,
): Promise<EstimateOk | ServiceErr> {
  const gate = await assertMarketplaceCardScenarioEnabled();
  if (!gate.ok) return gate;

  const parsed = simpleProductCardRequestSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      status: 400,
    };
  }

  const payload = normalizeSimpleCardPayload(parsed.data);
  const runtime = await getSimpleProductCardRuntimeSettings();
  if (!runtime.enabled) {
    return { ok: false, error: "Сценарий временно недоступен", status: 503, code: "SIMPLE_CARD_DISABLED" };
  }

  const usesRef = simpleCardUsesReference(payload);
  if (usesRef && !runtime.referenceEnabled) {
    return { ok: false, error: "Режим с референсом отключён администратором", status: 400 };
  }

  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) return { ok: false, error: "Проект не найден", status: 404 };

  const modelRes = await resolveSimpleProductCardImageModel({ needsReference: usesRef, settings: runtime });
  if (!modelRes) {
    return { ok: false, error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE, status: 400 };
  }

  if (usesRef && !modelRes.supportsReference) {
    return {
      ok: false,
      error: SIMPLE_CARD_REFERENCE_UNSUPPORTED_MESSAGE,
      status: 400,
      code: "REFERENCE_UNSUPPORTED",
    };
  }

  const imgErr = marketplaceModelProductImageError(modelRes.model);
  if (imgErr) return { ok: false, error: imgErr, status: 400, code: "MODEL_UNSUPPORTED" };

  const br = await calculateProductCardMarketplaceCardCredits(modelRes.model, {
    cardSize: aspectRatioToSimpleCardSizeId(payload.aspectRatio),
    styleMode: payload.styleMode,
    resolution: coerceProductCardImageResolution(payload.resolution),
  });

  await saveSimpleCardSettings(projectId, payload);

  return {
    ok: true,
    credits: br.credits,
    planHash: computeSimpleCardPlanHash(payload),
    supportsReference: modelRes.supportsReference,
    modelSlug: modelRes.model.slug,
  };
}

export async function generateSimpleProductCard(
  userId: string,
  projectId: string,
  rawPayload: unknown,
  clientEstimateCredits: number | null | undefined,
  productLabel?: string,
): Promise<GenOk | ServiceErr> {
  const gate = await assertMarketplaceCardScenarioEnabled();
  if (!gate.ok) return gate;

  const parsed = simpleProductCardRequestSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      status: 400,
    };
  }

  const payload = normalizeSimpleCardPayload(parsed.data);
  const runtime = await getSimpleProductCardRuntimeSettings();
  if (!runtime.enabled) {
    return { ok: false, error: "Сценарий временно недоступен", status: 503 };
  }

  const usesRef = simpleCardUsesReference(payload);
  if (usesRef && !runtime.referenceEnabled) {
    return { ok: false, error: "Режим с референсом отключён администратором", status: 400 };
  }

  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) return { ok: false, error: "Проект не найден", status: 404 };

  const productUrlRes = await resolveProductPhotoUrl(userId, payload.productPhotoId);
  if (typeof productUrlRes !== "string") return productUrlRes;

  let referenceUrl: string | null = null;
  if (usesRef) {
    const refRes = await resolveReferencePhotoUrl(userId, payload.referenceImageId);
    if (typeof refRes !== "string" && refRes !== null) return refRes;
    referenceUrl = refRes;
    if (!referenceUrl) {
      return {
        ok: false,
        error: "Загрузите фото-референс",
        status: 400,
        code: "REFERENCE_REQUIRED",
      };
    }
  }

  const modelRes = await resolveSimpleProductCardImageModel({ needsReference: usesRef, settings: runtime });
  if (!modelRes) {
    return { ok: false, error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE, status: 400 };
  }
  if (usesRef && !modelRes.supportsReference) {
    return {
      ok: false,
      error: SIMPLE_CARD_REFERENCE_UNSUPPORTED_MESSAGE,
      status: 400,
      code: "REFERENCE_UNSUPPORTED",
    };
  }

  const model = modelRes.model;
  const imgErr = marketplaceModelProductImageError(model);
  if (imgErr) return { ok: false, error: imgErr, status: 400 };

  const promptBuilt = buildSimpleProductCardPrompt({
    payload,
    prompts: runtime.prompts,
    aspectRatio: payload.aspectRatio,
  });

  const settingsMerge = buildModelSettingsMerge(
    model,
    productUrlRes,
    referenceUrl,
    payload.aspectRatio,
    payload.resolution,
  );
  if (!settingsMerge.ok) {
    return { ok: false, error: settingsMerge.error, status: 400 };
  }

  const breakdown: ProductCardPriceBreakdown = await calculateProductCardMarketplaceCardCredits(model, {
    cardSize: aspectRatioToSimpleCardSizeId(payload.aspectRatio),
    styleMode: payload.styleMode,
    resolution: coerceProductCardImageResolution(payload.resolution),
  });

  try {
    assertProductCardPriceAllowed(breakdown);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка цены", status: 400 };
  }

  if (
    clientEstimateCredits != null &&
    Number.isFinite(clientEstimateCredits) &&
    clientEstimateCredits !== breakdown.credits
  ) {
    return {
      ok: false,
      error: "Стоимость изменилась — обновите оценку и попробуйте снова",
      status: 409,
      code: "PRICE_CHANGED",
    };
  }

  const metadataRoot: Record<string, unknown> = {
    flow: "product_card",
    scenarioKey: "simple_card",
    tab: "marketplace_card",
    projectId: project.id,
    simpleCardStyleMode: payload.styleMode,
    simpleCardAspectRatio: payload.aspectRatio,
    simpleCardUsesReference: usesRef,
    simpleCardReferenceCreativity: payload.referenceCreativity,
    modelSlug: model.slug,
    pricingScope: "PRODUCT_CARD",
    productCardModelType: model.productCardModelType,
    fallbackFromMarketplaceCard: modelRes.fallbackFromMarketplaceCard,
    exactTextPhrases: promptBuilt.exactTextPhrases,
    simpleCardSettingsSnapshot: payload,
  };

  const result = await queueProductCardImage(
    userId,
    model,
    promptBuilt.prompt,
    productUrlRes,
    {
      flow: "product_card",
      productCard: { projectId: project.id, tab: "marketplace_card", category: "simple_card", sourceType: "original" },
    },
    promptBuilt.negativePrompt,
    metadataRoot,
    null,
    breakdown,
    payload.userText,
    referenceUrl ? [referenceUrl] : undefined,
    settingsMerge.merged,
  );

  if (!result.ok) {
    return { ok: false, error: result.error, status: result.status };
  }

  await saveSimpleCardSettings(projectId, payload, {
    productLabel: productLabel?.trim() || undefined,
  });
  await appendSimpleCardGeneration(projectId, {
    generationId: result.generationId,
    status: result.status,
  });

  return {
    ok: true,
    generationId: result.generationId,
    status: result.status,
    costCredits: result.costCredits ?? breakdown.credits,
  };
}
