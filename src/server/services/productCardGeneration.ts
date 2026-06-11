import { randomUUID } from "crypto";
import type { AiModel } from "@/generated/prisma/client";
import {
  buildConceptPhotoPrompt,
  buildMarketplaceCardPrompt,
  buildProductVideoPrompt,
  normalizeConceptId,
} from "@/config/product-card-prompts";
import {
  getProductCategoryById,
  MARKETPLACE_CARD_STYLES,
  PRODUCT_CATEGORY_IDS,
  PRODUCT_VIDEO_MOTION_STYLES,
  type MarketplaceCardStyle,
  type ProductCategoryId,
} from "@/config/product-card-categories";
import {
  getProductCardLayoutKey,
  getProductCardTemplatePreset,
  getProductCardTypographyPreset,
  variantTemplatePresetAt,
  variantTypographyPresetAt,
} from "@/config/product-card-overlay-presets";
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
  resolveProductVideoModel,
} from "@/server/services/productCardModelResolver";
import {
  isSeedanceScenarioModel,
  validateSeedanceScenario,
} from "@/server/services/seedance-settings";
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
import { generateProductSellingPoints } from "@/server/services/productCardSellingPoints";
import {
  appendConceptGenerationEntry,
  appendMarketplaceCardGeneration,
  appendVideoGenerationEntry,
} from "@/server/services/productCardUpdateMeta";
import {
  calculateProductCardConceptImageCredits,
  calculateProductCardMarketplaceCardCredits,
  calculateProductCardVideoCredits,
  resolveMarketplaceVariantBundleTotals,
} from "@/server/services/productCardPricing";
import {
  getProductCardSettings,
  PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
} from "@/server/services/productCardSettings";
import {
  resolveMarketplaceCardSize,
  type MarketplaceCardResolvedSize,
} from "@/server/services/marketplaceCardSizing";
import { getFullModerationConfig } from "@/server/services/moderation";

function clampMarketplacePrompt(prompt: string, maxLen: number): string {
  if (prompt.length <= maxLen) return prompt;
  const cut = prompt.slice(0, Math.max(0, maxLen - 1)).trimEnd();
  return `${cut}…`;
}

export function isValidProductCategoryId(id: string): id is ProductCategoryId {
  return (PRODUCT_CATEGORY_IDS as readonly string[]).includes(id);
}

export function isConceptInCategory(
  categoryId: ProductCategoryId,
  conceptId: string,
): boolean {
  const c = getProductCategoryById(categoryId);
  const normalized = normalizeConceptId(conceptId);
  return Boolean(c?.concepts.some((x) => x.id === conceptId || x.id === normalized));
}

function buildConceptPhotoModelSettings(
  model: AiModel,
  sourceImageUrl: string | string[],
  resolvedSize: MarketplaceCardResolvedSize,
):
  | { ok: true; merged: Record<string, unknown> }
  | { ok: false; error: string } {
  try {
    const b = buildImageModelInput(
      { settingsSchema: model.settingsSchema, supportsImageInput: model.supportsImageInput },
      sourceImageUrl,
    );
    return {
      ok: true,
      merged: {
        ...b.normalizedSettings,
        size: resolvedSize.id,
        aspectRatio: resolvedSize.kieAspectRatio,
        resolution: resolvedSize.kieResolution,
        outputWidth: resolvedSize.width,
        outputHeight: resolvedSize.height,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Некорректные настройки модели",
    };
  }
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
  code?: "PRICE_CHANGED";
};

export type GenerateConceptPhotoResult = GenerateConceptPhotoOk | GenerateConceptPhotoErr;

/**
 * Генерация «Фото с концепциями» через общий pipeline (queue + processGeneration).
 */
export async function generateConceptPhotoForProductCard(
  userId: string,
  projectId: string,
  input: {
    categoryId: string;
    conceptId: string;
    userPrompt: string;
    size?: string;
    clientEstimateCredits?: number | null;
  },
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

  const productCardSettings = await getProductCardSettings();
  const resolvedSize = resolveMarketplaceCardSize(
    productCardSettings.conceptImageSizes,
    input.size,
  );
  if (!resolvedSize.ok) {
    return { ok: false, error: resolvedSize.error, status: 400 };
  }
  const sizePreset = resolvedSize.size;

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
    size: sizePreset.id,
    sourceImageUrl: sourceUrl,
    sourceImages,
    sourceImagesCount: sourceImages.length,
    modelSlug: model.slug,
    pricingScope: "PRODUCT_CARD",
    productCardModelType: model.productCardModelType,
  };

  let conceptPricing;
  const mergedSettings = buildConceptPhotoModelSettings(
    model,
    sourceImageUrls.length > 0 ? sourceImageUrls : sourceUrl,
    sizePreset,
  );
  if (!mergedSettings.ok) {
    return {
      ok: false,
      error: mergedSettings.error,
      status: 400,
    };
  }
  try {
    conceptPricing = await calculateProductCardConceptImageCredits(
      model,
      mergedSettings.merged,
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Некорректные настройки модели",
      status: 400,
    };
  }

  const serverCredits = conceptPricing.credits;
  if (
    input.clientEstimateCredits != null &&
    Number.isFinite(input.clientEstimateCredits) &&
    input.clientEstimateCredits !== serverCredits
  ) {
    return {
      ok: false,
      error: "Стоимость изменилась — обновите оценку и попробуйте снова",
      status: 409,
      code: "PRICE_CHANGED",
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
    null,
    undefined,
    mergedSettings.merged,
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

export type GenerateMarketplaceCardVariantsOk = {
  ok: true;
  generationIds: string[];
  variants: Array<{
    generationId: string;
    status: string;
    costCredits: number;
    templatePreset: string;
    templateLayoutKey: string;
    typographyPreset: string;
    variantIndex: number;
    /** Слот без Generation (ошибка постановки в очередь и т.п.) */
    errorMessage?: string | null;
  }>;
  status: string;
  costCredits: number;
  variantGroupId: string;
  variantCount: number;
};

export type GenerateMarketplaceCardErr = {
  ok: false;
  error: string;
  status: number;
  code?: "PRICE_CHANGED";
  reason?: string;
};

export type GenerateMarketplaceCardResult = GenerateMarketplaceCardOk | GenerateMarketplaceCardErr;
export type GenerateMarketplaceCardVariantsResult = GenerateMarketplaceCardVariantsOk | GenerateMarketplaceCardErr;

export type EstimateMarketplaceCardOk = {
  ok: true;
  credits: number;
  perVariantCredits: number;
  variantCount: number;
  modelName: string;
  priceBreakdown: Awaited<ReturnType<typeof calculateProductCardMarketplaceCardCredits>>;
  /** Распределение списаний по вариантам (сумма = credits) */
  variantAllocations: number[];
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
    variantCount?: number;
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
  const rawVc = Math.round(input.variantCount ?? 1);
  /** Витрина: 4–6 отдельных Generation; одиночная карточка — множитель 1. */
  const variantCount =
    rawVc > 1 ? Math.min(6, Math.max(4, rawVc)) : Math.min(6, Math.max(1, rawVc));
  const bundle = resolveMarketplaceVariantBundleTotals(model, variantCount, price);
  return {
    ok: true,
    credits: bundle.totalCredits,
    perVariantCredits: price.credits,
    variantCount,
    modelName: model.name,
    priceBreakdown: bundle.priceBreakdown,
    variantAllocations: bundle.allocations,
  };
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
    subtitle?: string;
    statsText?: string;
    sizeText?: string;
    style: string;
    cardSize?: string;
    overlayTemplate?: string;
    templatePreset?: string;
    typographyPreset?: string;
    generationMode?: "marketplace_card" | "marketplace_card_variants";
    variantGroupId?: string;
    variantIndex?: number;
    variantCount?: number;
    preserveProductLabel?: boolean;
    useIcons?: boolean;
    useArrows?: boolean;
    useShadows?: boolean;
    userInstructions: string;
    /** Не доверяйте цене с фронта: при расхождении с пересчётом — 409 PRICE_CHANGED */
    clientEstimateCredits?: number | null;
    /**
     * Доля списания при витрине вариантов (сумма allocations = суммарный estimate).
     */
    billingCreditsOverride?: number | null;
  },
): Promise<GenerateMarketplaceCardResult> {
  const { userId, projectId, clientEstimateCredits, billingCreditsOverride, ...input } = p;
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

  const billedCredits =
    billingCreditsOverride != null &&
    Number.isFinite(billingCreditsOverride) &&
    billingCreditsOverride >= 0
      ? Math.max(0, Math.round(billingCreditsOverride))
      : marketplacePricing.credits;

  const scale =
    marketplacePricing.credits > 0 ? billedCredits / marketplacePricing.credits : 1;
  const billingBreakdown =
    billedCredits === marketplacePricing.credits
      ? marketplacePricing
      : {
          ...marketplacePricing,
          credits: billedCredits,
          tokens: billedCredits,
          revenueKzt:
            Math.round(marketplacePricing.revenueKzt * scale * 100) / 100,
          providerCostUsd:
            Math.round(marketplacePricing.providerCostUsd * scale * 100_000) /
            100_000,
          providerCostKzt:
            Math.round(marketplacePricing.providerCostKzt * scale * 100) / 100,
          marginKzt:
            Math.round(
              (marketplacePricing.revenueKzt * scale -
                marketplacePricing.providerCostKzt * scale) *
                100,
            ) / 100,
          formula: `${marketplacePricing.formula}; job_allocation=${billedCredits}`,
        };

  const serverCredits = billingBreakdown.credits;
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
  const templatePreset = getProductCardTemplatePreset(input.templatePreset);
  const typographyPreset = getProductCardTypographyPreset(input.typographyPreset);
  const templateLayoutKey = getProductCardLayoutKey(templatePreset.id, cardSize.id);
  const normalizedText = generateProductSellingPoints({
    productTitle: input.productTitle,
    productCategory: project.selectedCategory,
    userBenefits: benefitsList,
    userExtraText: input.extraText,
    userSubtitle: input.subtitle,
    statsText: input.statsText,
    sizeText: input.sizeText,
    templatePreset: templatePreset.id,
  });
  const variantMode = input.generationMode ?? "marketplace_card";
  const variantIndex = typeof input.variantIndex === "number" ? input.variantIndex : 0;
  const variantCount = Math.min(6, Math.max(1, Math.round(input.variantCount ?? 1)));
  /** Keep short — moderation counts prompt length only; long RU/template copy was hitting MAX_PROMPT_LENGTH. */
  const userDirRaw = input.userInstructions.trim().slice(0, 380);
  const visualInstructions = [
    userDirRaw || undefined,
    `Visual direction: ${templatePreset.aiStyle}.`,
    `Product ~50–60% frame; visually plain margins for overlay only.`,
    input.preserveProductLabel
      ? "Keep original pack labels recognizable; never invent packaging text/logos."
      : "Do not invent logos or pack text.",
  ]
    .filter(Boolean)
    .join("\n");
  let finalPrompt = buildMarketplaceCardPrompt({
    style,
    userInstructions: visualInstructions,
    productTitle: normalizedText.title,
    benefits: normalizedText.benefits.join("\n"),
    extraText: normalizedText.extraText,
    overlayTemplate,
    cardAspectRatio: cardSize.aspectRatio,
    compositionInstruction: templatePreset.compositionInstruction,
  });
  const modCfg = await getFullModerationConfig();
  const promptCap = Math.max(256, Math.floor(modCfg.maxPromptLength) - 48);
  finalPrompt = clampMarketplacePrompt(finalPrompt, promptCap);

  const marketplaceOverlayInput = {
    template: overlayTemplate,
    cardSize: cardSize.id,
    outputWidth: cardSize.width,
    outputHeight: cardSize.height,
    aspectRatio: cardSize.aspectRatio,
    productTitle: normalizedText.title,
    subtitle: normalizedText.subtitle,
    benefits: normalizedText.benefits,
    extraText: normalizedText.extraText,
    statsText: normalizedText.statsText,
    sizeText: normalizedText.sizeText,
    style,
    templatePreset: templatePreset.id,
    typographyPreset: typographyPreset.id,
    overlayVersion: "v2" as const,
    useIcons: input.useIcons !== false,
    useArrows: input.useArrows !== false,
    useShadows: input.useShadows !== false,
    preserveProductLabel: input.preserveProductLabel === true,
  };
  const marketplaceOverlaySpec = buildMarketplaceCardOverlaySpec(marketplaceOverlayInput);
  type OverlaySpecWithLayout = { layoutAnalysis?: unknown };
  const layoutAnalysisPayload =
    "layoutAnalysis" in marketplaceOverlaySpec
      ? (marketplaceOverlaySpec as OverlaySpecWithLayout).layoutAnalysis
      : undefined;

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
    priceBreakdown: billingBreakdown,
    cardSize: cardSize.id,
    cardSizeLabel: cardSize.label,
    outputWidth: cardSize.width,
    outputHeight: cardSize.height,
    aspectRatio: cardSize.kieAspectRatio,
    requestedAspectRatio: cardSize.aspectRatio,
    resolution: cardSize.kieResolution,
    overlayTemplate,
    generationMode: variantMode,
    templatePreset: templatePreset.id,
    templatePresetLabel: templatePreset.label,
    templateLayoutKey,
    theme: templatePreset.theme,
    layout: templateLayoutKey,
    overlayVersion: "v2",
    typographyPreset: typographyPreset.id,
    typographyPresetLabel: typographyPreset.label,
    normalizedText,
    preserveProductLabel: input.preserveProductLabel === true,
    compositionMode: input.preserveProductLabel ? "preserve_product_label_requested" : "ai_base_with_overlay",
    useIcons: input.useIcons !== false,
    useArrows: input.useArrows !== false,
    useShadows: input.useShadows !== false,
    variantGroupId: input.variantGroupId ?? null,
    variantIndex,
    variantCount,
    layoutAnalysis: layoutAnalysisPayload,
    overlay: marketplaceOverlaySpec,
    overlayPreviewSvg: renderMarketplaceCardOverlaySvg(marketplaceOverlayInput),
    productTitle: normalizedText.title,
    subtitle: normalizedText.subtitle,
    style,
  };

  const marketplaceCardSettings = {
    sourceImageUrl: src.url,
    sourceImageUrls,
    generationMode: variantMode,
    templatePreset: templatePreset.id,
    templateLayoutKey,
    typographyPreset: typographyPreset.id,
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
    billingBreakdown,
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
    generationMode: variantMode,
    templatePreset: templatePreset.id,
    templateLayoutKey,
    typographyPreset: typographyPreset.id,
    cardSize: cardSize.id,
    variantGroupId: input.variantGroupId,
    variantIndex,
    variantCount,
  });

  return {
    ok: true,
    generationId: result.generationId,
    status: result.status,
    costCredits,
  };
}


export async function generateMarketplaceCardVariantsForProductCard(
  p: {
    userId: string;
    projectId: string;
    sourceType: MarketplaceImageSource;
    sourceGenerationId: string | null;
    productTitle: string;
    benefits: string | string[];
    extraText: string;
    subtitle?: string;
    statsText?: string;
    sizeText?: string;
    style: string;
    cardSize?: string;
    userInstructions: string;
    clientEstimateCredits?: number | null;
    variantCount?: number;
    typographyPreset?: string;
    preserveProductLabel?: boolean;
    useIcons?: boolean;
    useArrows?: boolean;
    useShadows?: boolean;
  },
): Promise<GenerateMarketplaceCardVariantsResult> {
  const variantCount = Math.min(6, Math.max(4, Math.round(p.variantCount ?? 6)));
  const estimate = await estimateMarketplaceCardCredits(p.userId, p.projectId, {
    sourceType: p.sourceType,
    sourceGenerationId: p.sourceGenerationId,
    style: p.style,
    cardSize: p.cardSize,
    variantCount,
  });
  if (!estimate.ok) return estimate;
  if (
    p.clientEstimateCredits != null &&
    Number.isFinite(p.clientEstimateCredits) &&
    p.clientEstimateCredits !== estimate.credits
  ) {
    return {
      ok: false,
      error: "Стоимость изменилась — обновите оценку и попробуйте снова",
      status: 409,
      code: "PRICE_CHANGED",
    };
  }

  const variantGroupId = randomUUID();
  const settled = await Promise.all(
    Array.from({ length: variantCount }, (_, i) =>
      generateMarketplaceCardForProductCard({
        ...p,
        templatePreset: variantTemplatePresetAt(i),
        typographyPreset: p.typographyPreset?.trim() || variantTypographyPresetAt(i),
        generationMode: "marketplace_card_variants",
        variantGroupId,
        variantIndex: i,
        variantCount,
        clientEstimateCredits: null,
        billingCreditsOverride:
          estimate.variantAllocations[i] ?? estimate.perVariantCredits,
      }).then((single) => ({ i, single })),
    ),
  );
  const variants: GenerateMarketplaceCardVariantsOk["variants"] = settled.map(({ i, single }) => {
    const templatePreset = variantTemplatePresetAt(i);
    const typographyPreset = p.typographyPreset?.trim() || variantTypographyPresetAt(i);
    const templateLayoutKey = getProductCardLayoutKey(templatePreset, p.cardSize);
    if (single.ok) {
      return {
        generationId: single.generationId,
        status: single.status,
        costCredits: single.costCredits,
        templatePreset,
        templateLayoutKey,
        typographyPreset,
        variantIndex: i,
        errorMessage: null as string | null,
      };
    }
    return {
      generationId: `failed-${variantGroupId}-${i}`,
      status: "FAILED",
      costCredits: 0,
      templatePreset,
      templateLayoutKey,
      typographyPreset,
      variantIndex: i,
      errorMessage: single.error,
    };
  });
  const generationIds = variants
    .map((v) => v.generationId)
    .filter((id) => !id.startsWith("failed-"));
  if (generationIds.length === 0) {
    return { ok: false, error: "Не удалось создать варианты карточки", status: 500 };
  }
  return {
    ok: true,
    generationIds,
    variants,
    status: "QUEUED",
    costCredits: variants.reduce((sum, v) => sum + v.costCredits, 0),
    variantGroupId,
    variantCount,
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
  lastFrameUrl: string | null = null,
):
  | { ok: true; settings: Record<string, unknown> }
  | { ok: false; error: string } {
  if (!modelHasSettingsSchema(model.settingsSchema)) {
    return { ok: false, error: "У видео-модели нет схемы настроек" };
  }
  const base = defaultsFromSchema(model.settingsSchema);
  const fieldNames = new Set(getSchemaFields(model.settingsSchema).map((f) => f.name));
  const draft: Record<string, unknown> = { ...base };
  const lastTrimmed = lastFrameUrl?.trim() ?? "";
  const hasLastFrame = lastTrimmed !== "";

  if (fieldNames.has("scenario")) {
    draft.scenario = hasLastFrame ? "first-last-frame" : "first-frame";
  } else if (
    model.apiModelId === "bytedance/seedance-2" ||
    model.apiModelId === "bytedance/seedance-2-fast"
  ) {
    draft.scenario = hasLastFrame ? "first-last-frame" : "first-frame";
  }
  if (fieldNames.has("firstFrameUrl")) {
    const urls =
      referenceImageUrls.length > 0 ? referenceImageUrls : [sourceImageUrl];
    const firstField = getSchemaFields(model.settingsSchema).find(
      (f) => f.name === "firstFrameUrl",
    );
    const isUploadList =
      firstField?.type === "image-upload-list" ||
      firstField?.type === "upload-list" ||
      firstField?.type === "url-list";
    draft.firstFrameUrl = isUploadList ? urls : sourceImageUrl;
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
  if (fieldNames.has("lastFrameUrl")) {
    draft.lastFrameUrl = hasLastFrame ? lastTrimmed : "";
  }

  const norm = validateAndNormalizeModelSettings(model.settingsSchema, draft);
  if (!norm.ok) {
    return { ok: false, error: norm.message };
  }
  if (isSeedanceScenarioModel(model.apiModelId)) {
    const seedanceVal = validateSeedanceScenario(norm.settings);
    if (!seedanceVal.ok) {
      return { ok: false, error: seedanceVal.message };
    }
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
    lastFrameUrl?: string | null;
    modelSlug?: string | null;
  },
): Promise<EstimateProductVideoResult> {
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }
  if (!isValidProductVideoMotionStyle(input.motionStyle)) {
    return { ok: false, error: "Некорректный стиль движения", status: 400 };
  }
  const lastFrameTrimmed = input.lastFrameUrl?.trim() ?? "";
  if (lastFrameTrimmed && !(await assertUserOwnsFileUrl(userId, lastFrameTrimmed))) {
    return { ok: false, error: "Последний кадр: недоступный URL загрузки", status: 400 };
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
  const model = await resolveProductVideoModel(input.modelSlug);
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
    lastFrameTrimmed || null,
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
  loopVideo?: boolean;
  lastFrameUrl?: string | null;
  clientEstimateCredits?: number | null;
  modelSlug?: string | null;
}): Promise<GenerateProductVideoResult> {
  const { userId, projectId, clientEstimateCredits, ...input } = p;
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }
  if (!isValidProductVideoMotionStyle(input.motionStyle)) {
    return { ok: false, error: "Некорректный стиль движения", status: 400 };
  }
  const lastFrameTrimmed = input.lastFrameUrl?.trim() ?? "";
  if (lastFrameTrimmed && !(await assertUserOwnsFileUrl(userId, lastFrameTrimmed))) {
    return { ok: false, error: "Последний кадр: недоступный URL загрузки", status: 400 };
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

  const model = await resolveProductVideoModel(input.modelSlug);
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
    lastFrameTrimmed || null,
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
    loopVideo: p.loopVideo === true,
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
    loopVideo: p.loopVideo === true,
    lastFrameUrl: lastFrameTrimmed || null,
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
