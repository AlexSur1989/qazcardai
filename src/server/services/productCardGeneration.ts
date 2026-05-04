
import type { AiModel } from "@/generated/prisma/client";
import {
  buildConceptPhotoPrompt,
  buildMarketplaceCardPrompt,
  buildProductVideoPrompt,
} from "@/config/product-card-prompts";
import {
  getProductCategoryById,
  MARKETPLACE_CARD_STYLES,
  PRODUCT_CATEGORY_IDS,
  PRODUCT_VIDEO_MOTION_STYLES,
  type MarketplaceCardStyle,
  type ProductCategoryId,
} from "@/config/product-card-categories";
import { getSchemaFields, defaultsFromSchema } from "@/lib/generation-form-settings-schema";
import {
  modelHasSettingsSchema,
  validateAndNormalizeModelSettings,
} from "@/server/services/model-settings";
import { assertUserOwnsFileUrl, getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";
import {
  resolveDefaultMarketplaceCardModel,
  resolveDefaultProductConceptImageModel,
  resolveDefaultProductVideoModel,
} from "@/server/services/productCardModelResolver";
import {
  resolveMarketplaceCardSource,
  type MarketplaceImageSource,
  type ProductVideoImageSourceType,
  resolveProductVideoImageSource,
} from "@/server/services/productCardResolveSource";
import {
  buildImageModelInput,
  type ProductCardGenMeta,
  queueProductCardImage,
  queueProductCardVideo,
} from "@/server/services/productCardQueueGenerations";
import {
  buildMarketplaceCardOverlaySpec,
  renderMarketplaceCardOverlaySvg,
} from "@/server/services/productCardOverlayRenderer";
import {
  appendConceptGenerationEntry,
  appendMarketplaceCardGeneration,
  appendVideoGenerationEntry,
} from "@/server/services/productCardUpdateMeta";
import {
  calculateProductCardConceptImageCredits,
  calculateProductCardMarketplaceCardCredits,
  calculateProductCardVideoCredits,
} from "@/server/services/productCardPricing";
import {
  getProductCardSettings,
  PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
} from "@/server/services/productCardSettings";
import {
  resolveMarketplaceCardSize,
  type MarketplaceCardResolvedSize,
} from "@/server/services/marketplaceCardSizing";

export function isValidProductCategoryId(id: string): id is ProductCategoryId {
  return (PRODUCT_CATEGORY_IDS as readonly string[]).includes(id);
}

export function isConceptInCategory(
  categoryId: ProductCategoryId,
  conceptId: string,
): boolean {
  const c = getProductCategoryById(categoryId);
  return Boolean(c?.concepts.some((x) => x.id === conceptId));
}

export type GenerateConceptPhotoOk = {
  ok: true;
  generationId: string;
  status: string;
  costCredits: number;
};

export type GenerateConceptPhotoErr = {
  ok: false;
  error: string;
  status: number;
  reason?: string;
};

export type GenerateConceptPhotoResult = GenerateConceptPhotoOk | GenerateConceptPhotoErr;

/**
 * Генерация «Фото с концепциями» через общий pipeline (queue + processGeneration).
 */
export async function generateConceptPhotoForProductCard(
  userId: string,
  projectId: string,
  input: { categoryId: string; conceptId: string; userPrompt: string; size?: string },
): Promise<GenerateConceptPhotoResult> {
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }

  const sourceImages = normalizeProductSourceImages(project);
  const sourceUrl = sourceImages[0]?.url ?? project.sourceImageUrl?.trim();
  if (!sourceUrl) {
    return { ok: false, error: "Загрузите исходное фото", status: 400 };
  }
  if (!(await assertUserOwnsFileUrl(userId, sourceUrl))) {
    return { ok: false, error: "Нет доступа к файлу", status: 403 };
  }
  for (const img of sourceImages.slice(1)) {
    if (!(await assertUserOwnsFileUrl(userId, img.url))) {
      return { ok: false, error: "Нет доступа к одному из исходных фото", status: 403 };
    }
  }
  const sourceImageUrls = sourceImages.map((img) => img.url);

  if (!isValidProductCategoryId(input.categoryId)) {
    return { ok: false, error: "Некорректная категория", status: 400 };
  }
  if (!isConceptInCategory(input.categoryId, input.conceptId)) {
    return {
      ok: false,
      error: "Концепция не относится к выбранной категории",
      status: 400,
    };
  }

  const model = await resolveDefaultProductConceptImageModel();
  if (!model) {
    return {
      ok: false,
      error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
      status: 400,
    };
  }

  const finalPrompt = buildConceptPhotoPrompt({
    categoryId: input.categoryId,
    conceptId: input.conceptId,
    userPrompt: input.userPrompt,
  });

  const productMeta: ProductCardGenMeta = {
    flow: "product_card",
    productCard: {
      projectId: project.id,
      tab: "concept_photo",
      category: input.categoryId,
      conceptId: input.conceptId,
      sourceType: "original",
    },
  };

  const metadataRoot: Record<string, unknown> = {
    flow: "product_card",
    projectId: project.id,
    tab: "concept_photo",
    categoryId: input.categoryId,
    conceptId: input.conceptId,
    userPrompt: input.userPrompt,
    size: input.size ?? "1x1",
    sourceImageUrl: sourceUrl,
    sourceImages,
    sourceImagesCount: sourceImages.length,
    modelSlug: model.slug,
    pricingScope: "PRODUCT_CARD",
    productCardModelType: model.productCardModelType,
  };

  let conceptPricing;
  try {
    const built = buildImageModelInput(
      { settingsSchema: model.settingsSchema, supportsImageInput: model.supportsImageInput },
      sourceImageUrls.length > 0 ? sourceImageUrls : sourceUrl,
    );
    conceptPricing = await calculateProductCardConceptImageCredits(
      model,
      { ...built.normalizedSettings, size: input.size ?? "1x1" },
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Некорректные настройки модели",
      status: 400,
    };
  }

  const result = await queueProductCardImage(
    userId,
    model,
    finalPrompt,
    sourceImageUrls.length > 0 ? sourceImageUrls : sourceUrl,
    productMeta,
    null,
    metadataRoot,
    null,
    conceptPricing,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      status: result.status,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  }

  const costCredits = result.costCredits ?? 0;

  await appendConceptGenerationEntry(project.id, {
    generationId: result.generationId,
    categoryId: input.categoryId,
    conceptId: input.conceptId,
  });

  return {
    ok: true,
    generationId: result.generationId,
    status: result.status,
    costCredits,
  };
}

const MARKETPLACE_STYLE_IDS = new Set<string>(
  MARKETPLACE_CARD_STYLES.map((s) => s.id),
);

export function isValidMarketplaceCardStyle(id: string): boolean {
  return MARKETPLACE_STYLE_IDS.has(id);
}

function normalizeBenefits(
  b: string | string[] | undefined,
): string {
  if (b == null) return "";
  if (Array.isArray(b)) {
    return b.map((x) => x.trim()).filter(Boolean).join("\n");
  }
  return b.trim();
}

export type GenerateMarketplaceCardOk = {
  ok: true;
  generationId: string;
  status: string;
  costCredits: number;
};

export type GenerateMarketplaceCardErr = {
  ok: false;
  error: string;
  status: number;
  code?: "PRICE_CHANGED";
  reason?: string;
};

export type GenerateMarketplaceCardResult = GenerateMarketplaceCardOk | GenerateMarketplaceCardErr;

export type EstimateMarketplaceCardOk = {
  ok: true;
  credits: number;
  modelName: string;
  priceBreakdown: Awaited<ReturnType<typeof calculateProductCardMarketplaceCardCredits>>;
};

export type EstimateMarketplaceCardErr = { ok: false; error: string; status: number };

export type EstimateMarketplaceCardResult = EstimateMarketplaceCardOk | EstimateMarketplaceCardErr;

/**
 * Оценка токенов: тот же Product Card pricing, что и при создании Generation.
 * Провайдер не вызывается.
 */
export async function estimateMarketplaceCardCredits(
  userId: string,
  projectId: string,
  input: {
    sourceType: MarketplaceImageSource;
    sourceGenerationId: string | null;
    style: string;
    cardSize?: string;
    overlayTemplate?: string;
  },
): Promise<EstimateMarketplaceCardResult> {
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }
  if (!isValidMarketplaceCardStyle(input.style)) {
    return { ok: false, error: "Некорректный стиль карточки", status: 400 };
  }
  const style = input.style as MarketplaceCardStyle;
  const productCardSettings = await getProductCardSettings();
  const resolvedSize = resolveMarketplaceCardSize(
    productCardSettings.marketplaceCardSizes,
    input.cardSize,
  );
  if (!resolvedSize.ok) {
    return { ok: false, error: resolvedSize.error, status: 400 };
  }
  const src = await resolveMarketplaceCardSource(
    userId,
    project,
    input.sourceType,
    input.sourceGenerationId,
  );
  if (!src.ok) {
    return { ok: false, error: src.message, status: 400 };
  }
  const sourceImages =
    input.sourceType === "original" ? normalizeProductSourceImages(project) : [];
  const sourceImageUrls =
    sourceImages.length > 0 ? sourceImages.map((img) => img.url) : [src.url];
  const model = await resolveDefaultMarketplaceCardModel();
  if (!model) {
    return {
      ok: false,
      error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
      status: 400,
    };
  }

  const merged = buildMarketplaceCardMergedModelSettings(
    model,
    sourceImageUrls,
    style,
    resolvedSize.size,
  );
  if (!merged.ok) {
    return { ok: false, error: merged.error, status: 400 };
  }
  const price = await calculateProductCardMarketplaceCardCredits(model, merged.merged);
  return { ok: true, credits: price.credits, modelName: model.name, priceBreakdown: price };
}

function buildMarketplaceCardMergedModelSettings(
  model: AiModel,
  sourceImageUrl: string | string[],
  style: MarketplaceCardStyle,
  cardSize: MarketplaceCardResolvedSize,
):
  | { ok: true; merged: Record<string, unknown> }
  | { ok: false; error: string } {
  try {
    const sourceImageUrls = (Array.isArray(sourceImageUrl) ? sourceImageUrl : [sourceImageUrl])
      .map((url) => url.trim())
      .filter(Boolean);
    const mainSourceImageUrl = sourceImageUrls[0] ?? "";
    const b = buildImageModelInput(
      { settingsSchema: model.settingsSchema, supportsImageInput: model.supportsImageInput },
      sourceImageUrl,
    );
    return {
      ok: true,
      merged: {
        ...b.normalizedSettings,
        sourceImageUrl: mainSourceImageUrl,
        sourceImageUrls,
        generationMode: "marketplace_card" as const,
        style,
        cardSize: cardSize.id,
        aspectRatio: cardSize.kieAspectRatio,
        resolution: cardSize.kieResolution,
        outputWidth: cardSize.width,
        outputHeight: cardSize.height,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Некорректные настройки модели",
    };
  }
}

/**
 * Маркетплейс-карточка: hidden prompt только на сервере; pipeline — общий product-card image.
 *
 * TODO: Marketplace card v1 uses image generation prompt. For production-quality text, later implement overlay rendering with HTML/SVG/canvas to avoid AI text mistakes.
 */
export async function generateMarketplaceCardForProductCard(
  p: {
    userId: string;
    projectId: string;
    sourceType: MarketplaceImageSource;
    sourceGenerationId: string | null;
    productTitle: string;
    benefits: string | string[];
    extraText: string;
    style: string;
    cardSize?: string;
    overlayTemplate?: string;
    userInstructions: string;
    /** Не доверяйте цене с фронта: при расхождении с пересчётом — 409 PRICE_CHANGED */
    clientEstimateCredits?: number | null;
  },
): Promise<GenerateMarketplaceCardResult> {
  const { userId, projectId, clientEstimateCredits, ...input } = p;
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }

  if (!isValidMarketplaceCardStyle(input.style)) {
    return { ok: false, error: "Некорректный стиль карточки", status: 400 };
  }
  const style = input.style as MarketplaceCardStyle;
  const productCardSettings = await getProductCardSettings();
  const resolvedSize = resolveMarketplaceCardSize(
    productCardSettings.marketplaceCardSizes,
    input.cardSize,
  );
  if (!resolvedSize.ok) {
    return { ok: false, error: resolvedSize.error, status: 400 };
  }

  const src = await resolveMarketplaceCardSource(
    userId,
    project,
    input.sourceType,
    input.sourceGenerationId,
  );
  if (!src.ok) {
    return { ok: false, error: src.message, status: 400 };
  }
  const sourceImages =
    input.sourceType === "original" ? normalizeProductSourceImages(project) : [];
  const sourceImageUrls =
    sourceImages.length > 0 ? sourceImages.map((img) => img.url) : [src.url];

  const model = await resolveDefaultMarketplaceCardModel();
  if (!model) {
    return {
      ok: false,
      error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
      status: 400,
    };
  }

  const mergedPricing = buildMarketplaceCardMergedModelSettings(
    model,
    sourceImageUrls,
    style,
    resolvedSize.size,
  );
  if (!mergedPricing.ok) {
    return { ok: false, error: mergedPricing.error, status: 400 };
  }
  const marketplacePricing = await calculateProductCardMarketplaceCardCredits(
    model,
    mergedPricing.merged,
  );
  const serverCredits = marketplacePricing.credits;
  if (
    clientEstimateCredits != null &&
    Number.isFinite(clientEstimateCredits) &&
    clientEstimateCredits !== serverCredits
  ) {
    return {
      ok: false,
      error: "Стоимость изменилась — обновите оценку и попробуйте снова",
      status: 409,
      code: "PRICE_CHANGED",
    };
  }

  const benefitsStr = normalizeBenefits(input.benefits);
  const benefitsList = benefitsStr
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const overlayTemplate = input.overlayTemplate?.trim() || "bottom_panel";
  const cardSize = resolvedSize.size;
  const finalPrompt = buildMarketplaceCardPrompt({
    style,
    userInstructions: input.userInstructions,
    productTitle: input.productTitle,
    benefits: benefitsStr,
    extraText: input.extraText,
    overlayTemplate,
    cardAspectRatio: cardSize.aspectRatio,
  });

  const productMeta: ProductCardGenMeta = {
    flow: "product_card",
    productCard: {
      projectId: project.id,
      tab: "marketplace_card",
      sourceType: input.sourceType,
    },
  };

  const metadataRoot: Record<string, unknown> = {
    flow: "product_card",
    projectId: project.id,
    tab: "marketplace_card",
    sourceType: input.sourceType,
    sourceGenerationId: input.sourceGenerationId?.trim() ?? null,
    sourceImageUrl: src.url,
    sourceImages,
    sourceImagesCount: sourceImages.length,
    modelSlug: model.slug,
    pricingScope: "PRODUCT_CARD",
    productCardModelType: model.productCardModelType,
    priceBreakdown: marketplacePricing,
    cardSize: cardSize.id,
    cardSizeLabel: cardSize.label,
    outputWidth: cardSize.width,
    outputHeight: cardSize.height,
    aspectRatio: cardSize.kieAspectRatio,
    requestedAspectRatio: cardSize.aspectRatio,
    resolution: cardSize.kieResolution,
    overlayTemplate,
    overlay: buildMarketplaceCardOverlaySpec({
      template: overlayTemplate,
      cardSize: cardSize.id,
      outputWidth: cardSize.width,
      outputHeight: cardSize.height,
      aspectRatio: cardSize.aspectRatio,
      productTitle: input.productTitle,
      benefits: benefitsList,
      extraText: input.extraText,
      style,
    }),
    overlayPreviewSvg: renderMarketplaceCardOverlaySvg({
      template: overlayTemplate,
      cardSize: cardSize.id,
      outputWidth: cardSize.width,
      outputHeight: cardSize.height,
      aspectRatio: cardSize.aspectRatio,
      productTitle: input.productTitle,
      benefits: benefitsList,
      extraText: input.extraText,
      style,
    }),
    productTitle: input.productTitle,
    style,
  };

  const marketplaceCardSettings = {
    sourceImageUrl: src.url,
    sourceImageUrls,
    generationMode: "marketplace_card" as const,
    style: input.style,
    cardSize: cardSize.id,
    aspectRatio: cardSize.kieAspectRatio,
    resolution: cardSize.kieResolution,
    outputWidth: cardSize.width,
    outputHeight: cardSize.height,
  };

  const result = await queueProductCardImage(
    userId,
    model,
    finalPrompt,
    sourceImageUrls,
    productMeta,
    null,
    metadataRoot,
    marketplaceCardSettings,
    marketplacePricing,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      status: result.status,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  }

  const costCredits = result.costCredits ?? 0;

  await appendMarketplaceCardGeneration(project.id, {
    generationId: result.generationId,
    sourceType: input.sourceType,
    sourceGenerationId: input.sourceGenerationId?.trim() ?? null,
    style: input.style,
  });

  return {
    ok: true,
    generationId: result.generationId,
    status: result.status,
    costCredits,
  };
}

const PRODUCT_VIDEO_MOTION_IDS = new Set<string>(
  PRODUCT_VIDEO_MOTION_STYLES.map((s) => s.id),
);

export function isValidProductVideoMotionStyle(id: string): boolean {
  return PRODUCT_VIDEO_MOTION_IDS.has(id);
}

function buildProductCardVideoModelSettings(
  model: AiModel,
  sourceImageUrl: string,
  duration: 5 | 10,
  referenceImageUrls: string[] = [sourceImageUrl],
  resolution = "720p",
  aspectRatio = "16:9",
):
  | { ok: true; settings: Record<string, unknown> }
  | { ok: false; error: string } {
  if (!modelHasSettingsSchema(model.settingsSchema)) {
    return { ok: false, error: "У видео-модели нет схемы настроек" };
  }
  const base = defaultsFromSchema(model.settingsSchema);
  const fieldNames = new Set(getSchemaFields(model.settingsSchema).map((f) => f.name));
  const draft: Record<string, unknown> = { ...base };

  if (fieldNames.has("scenario")) {
    draft.scenario = "first-frame";
  }
  if (fieldNames.has("firstFrameUrl")) {
    draft.firstFrameUrl = sourceImageUrl;
  } else if (fieldNames.has("imageUrl")) {
    draft.imageUrl = sourceImageUrl;
  } else if (fieldNames.has("inputUrls")) {
    draft.inputUrls = referenceImageUrls.length > 0 ? referenceImageUrls : [sourceImageUrl];
  } else if (fieldNames.has("imageUrls")) {
    draft.imageUrls = referenceImageUrls.length > 0 ? referenceImageUrls : [sourceImageUrl];
  }
  if (fieldNames.has("duration")) {
    draft.duration = duration;
  }
  if (fieldNames.has("resolution")) {
    draft.resolution = resolution;
  }
  if (fieldNames.has("aspectRatio")) {
    draft.aspectRatio = aspectRatio;
  }
  if (fieldNames.has("generateAudio")) {
    draft.generateAudio = false;
  }
  if (fieldNames.has("webSearch")) {
    draft.webSearch = false;
  }

  const norm = validateAndNormalizeModelSettings(model.settingsSchema, draft);
  if (!norm.ok) {
    return { ok: false, error: norm.message };
  }
  return { ok: true, settings: norm.settings };
}

export type EstimateProductVideoOk = {
  ok: true;
  credits: number;
  modelName: string;
  priceBreakdown: Awaited<ReturnType<typeof calculateProductCardVideoCredits>>;
};

export type EstimateProductVideoErr = { ok: false; error: string; status: number };

export type EstimateProductVideoResult = EstimateProductVideoOk | EstimateProductVideoErr;

export async function estimateProductVideoCredits(
  userId: string,
  projectId: string,
  input: {
    sourceType: ProductVideoImageSourceType;
    sourceGenerationId: string | null;
    duration: 5 | 10;
    motionStyle: string;
    resolution?: string;
    aspectRatio?: string;
  },
): Promise<EstimateProductVideoResult> {
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }
  if (!isValidProductVideoMotionStyle(input.motionStyle)) {
    return { ok: false, error: "Некорректный стиль движения", status: 400 };
  }
  const src = await resolveProductVideoImageSource(
    userId,
    project,
    input.sourceType,
    input.sourceGenerationId,
  );
  if (!src.ok) {
    return { ok: false, error: src.message, status: 400 };
  }
  const model = await resolveDefaultProductVideoModel();
  if (!model) {
    return {
      ok: false,
      error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
      status: 400,
    };
  }
  const sourceImages =
    input.sourceType === "original" ? normalizeProductSourceImages(project) : [];
  const sourceImageUrls =
    sourceImages.length > 0 ? sourceImages.map((img) => img.url) : [src.url];
  const built = buildProductCardVideoModelSettings(
    model,
    src.url,
    input.duration,
    sourceImageUrls,
    input.resolution ?? "720p",
    input.aspectRatio ?? "16:9",
  );
  if (!built.ok) {
    return { ok: false, error: built.error, status: 400 };
  }
  const price = await calculateProductCardVideoCredits(model, built.settings);
  return { ok: true, credits: price.credits, modelName: model.name, priceBreakdown: price };
}

export type GenerateProductVideoOk = {
  ok: true;
  generationId: string;
  status: string;
  costCredits: number;
};

export type GenerateProductVideoErr = {
  ok: false;
  error: string;
  status: number;
  code?: "PRICE_CHANGED";
  reason?: string;
};

export type GenerateProductVideoResult = GenerateProductVideoOk | GenerateProductVideoErr;

export async function generateProductVideoForProductCard(p: {
  userId: string;
  projectId: string;
  sourceType: ProductVideoImageSourceType;
  sourceGenerationId: string | null;
  duration: 5 | 10;
  motionStyle: string;
  resolution?: string;
  aspectRatio?: string;
  userPrompt: string;
  clientEstimateCredits?: number | null;
}): Promise<GenerateProductVideoResult> {
  const { userId, projectId, clientEstimateCredits, ...input } = p;
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }
  if (!isValidProductVideoMotionStyle(input.motionStyle)) {
    return { ok: false, error: "Некорректный стиль движения", status: 400 };
  }

  const src = await resolveProductVideoImageSource(
    userId,
    project,
    input.sourceType,
    input.sourceGenerationId,
  );
  if (!src.ok) {
    return { ok: false, error: src.message, status: 400 };
  }

  const model = await resolveDefaultProductVideoModel();
  if (!model) {
    return {
      ok: false,
      error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
      status: 400,
    };
  }

  const sourceImages =
    input.sourceType === "original" ? normalizeProductSourceImages(project) : [];
  const sourceImageUrls =
    sourceImages.length > 0 ? sourceImages.map((img) => img.url) : [src.url];
  const built = buildProductCardVideoModelSettings(
    model,
    src.url,
    input.duration,
    sourceImageUrls,
    input.resolution ?? "720p",
    input.aspectRatio ?? "16:9",
  );
  if (!built.ok) {
    return { ok: false, error: built.error, status: 400 };
  }
  const videoPricing = await calculateProductCardVideoCredits(model, built.settings);
  const serverCredits = videoPricing.credits;
  if (
    clientEstimateCredits != null &&
    Number.isFinite(clientEstimateCredits) &&
    clientEstimateCredits !== serverCredits
  ) {
    return {
      ok: false,
      error: "Стоимость изменилась — обновите оценку и попробуйте снова",
      status: 409,
      code: "PRICE_CHANGED",
    };
  }

  const finalPrompt = buildProductVideoPrompt({
    motionStyle: input.motionStyle,
    userPrompt: input.userPrompt,
  });

  const metadataRoot: Record<string, unknown> = {
    flow: "product_card",
    projectId: project.id,
    tab: "video",
    sourceType: input.sourceType,
    sourceGenerationId: input.sourceGenerationId?.trim() ?? null,
    sourceImageUrl: src.url,
    sourceImages,
    sourceImagesCount: sourceImages.length,
    duration: input.duration,
    resolution: input.resolution ?? "720p",
    aspectRatio: input.aspectRatio ?? "16:9",
    motionStyle: input.motionStyle,
    userPrompt: input.userPrompt,
    modelSlug: model.slug,
    pricingScope: "PRODUCT_CARD",
    productCardModelType: model.productCardModelType,
    priceBreakdown: videoPricing,
  };

  const productMeta: ProductCardGenMeta = {
    flow: "product_card",
    productCard: {
      projectId: project.id,
      tab: "video",
      sourceType: input.sourceType,
    },
  };

  const result = await queueProductCardVideo(
    userId,
    model,
    finalPrompt,
    built.settings,
    productMeta,
    [],
    null,
    metadataRoot,
    videoPricing,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      status: result.status,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  }

  const costCredits = result.costCredits ?? 0;

  await appendVideoGenerationEntry(project.id, {
    generationId: result.generationId,
    sourceType: input.sourceType,
    sourceGenerationId: input.sourceGenerationId?.trim() ?? null,
    duration: input.duration,
    motionStyle: input.motionStyle,
  });

  return {
    ok: true,
    generationId: result.generationId,
    status: result.status,
    costCredits,
  };
}
