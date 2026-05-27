import { createHash } from "node:crypto";

import type { AiModel } from "@/generated/prisma/client";
import { resolveCardBuilderOutputSize } from "@/lib/card-builder-output-size";
import { SIMPLE_CARD_REFERENCE_UNSUPPORTED_MESSAGE } from "@/lib/simple-product-card-model";
import {
  aspectRatioToSimpleCardSizeId,
  normalizeSimpleCardPayload,
  simpleCardUsesReference,
  simpleProductCardRequestSchema,
  type SimpleProductCardRequest,
} from "@/lib/validations/simple-product-card";
import { assertUserOwnsFileUrl, getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { assertCardBuilderScenarioEnabled } from "@/server/services/productCardCardBuilderGeneration";
import {
  cardBuilderModelProductImageError,
} from "@/server/services/productCardModelResolver";
import {
  assertProductCardPriceAllowed,
  estimateCardBuilderCharge,
  type ProductCardPriceBreakdown,
} from "@/server/services/productCardPricing";
import { getProductCardSettings, PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE } from "@/server/services/productCardSettings";
import { buildImageModelInput, queueProductCardImage } from "@/server/services/productCardQueueGenerations";
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
): { ok: true; merged: Record<string, unknown> } | { ok: false; error: string } {
  const sizeId = aspectRatioToSimpleCardSizeId(aspectRatio);
  const resolved = resolveCardBuilderOutputSize(sizeId);
  try {
    const b = buildImageModelInput(
      { settingsSchema: model.settingsSchema, supportsImageInput: model.supportsImageInput },
      productUrl,
      referenceUrl ? { styleReferenceUrls: [referenceUrl] } : undefined,
    );
    return {
      ok: true,
      merged: {
        ...b.normalizedSettings,
        size: resolved.id,
        aspectRatio: resolved.kieAspectRatio,
        resolution: resolved.kieResolution,
        outputWidth: resolved.width,
        outputHeight: resolved.height,
        cardBuilderOutputSizeId: resolved.id,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Некорректные настройки модели" };
  }
}

export function computeSimpleCardPlanHash(payload: SimpleProductCardRequest): string {
  const norm = normalizeSimpleCardPayload(payload);
  return createHash("sha256").update(JSON.stringify(norm)).digest("hex");
}

function salesStyleForMode(styleMode: SimpleProductCardRequest["styleMode"]): string {
  if (styleMode === "premium") return "premium";
  return "marketplace";
}

export async function estimateSimpleProductCard(
  userId: string,
  projectId: string,
  rawPayload: unknown,
): Promise<EstimateOk | ServiceErr> {
  const gate = await assertCardBuilderScenarioEnabled();
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

  const imgErr = cardBuilderModelProductImageError(modelRes.model);
  if (imgErr) return { ok: false, error: imgErr, status: 400, code: "MODEL_UNSUPPORTED" };

  const settings = await getProductCardSettings();
  const br = await estimateCardBuilderCharge(
    "slide",
    modelRes.model,
    settings.cardBuilderPricing,
    salesStyleForMode(payload.styleMode),
    "medium",
    "main_photo",
    null,
  );

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
): Promise<GenOk | ServiceErr> {
  const gate = await assertCardBuilderScenarioEnabled();
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
  const imgErr = cardBuilderModelProductImageError(model);
  if (imgErr) return { ok: false, error: imgErr, status: 400 };

  const promptBuilt = buildSimpleProductCardPrompt({
    payload,
    prompts: runtime.prompts,
    aspectRatio: payload.aspectRatio,
  });

  const settingsMerge = buildModelSettingsMerge(model, productUrlRes, referenceUrl, payload.aspectRatio);
  if (!settingsMerge.ok) {
    return { ok: false, error: settingsMerge.error, status: 400 };
  }

  const pcSettings = await getProductCardSettings();
  const breakdown: ProductCardPriceBreakdown = await estimateCardBuilderCharge(
    "slide",
    model,
    pcSettings.cardBuilderPricing,
    salesStyleForMode(payload.styleMode),
    "medium",
    "main_photo",
    null,
  );

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
    tab: "card_builder",
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
      productCard: { projectId: project.id, tab: "card_builder", category: "simple_card", sourceType: "original" },
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

  await saveSimpleCardSettings(projectId, payload);
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
