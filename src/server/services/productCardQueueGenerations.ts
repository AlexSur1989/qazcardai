
import { Prisma } from "@/generated/prisma/client";
import type { AiModel } from "@/generated/prisma/client";
import { getSchemaFields, defaultsFromSchema } from "@/lib/generation-form-settings-schema";
import {
  kieReachableImageUrlsFromInputFiles,
  KIE_REQUIRES_PUBLIC_IMAGE_URLS_RU,
  publicHttpUrlsOnly,
  validateImageInputFiles,
} from "@/lib/generation-input-limits";
import { isMockKie } from "@/lib/kie-mock";
import { prisma } from "@/lib/prisma";
import { publicApiErrorMessage } from "@/lib/safe-api-error";
import { validateVideoInputFiles } from "@/lib/video-input-limits";
import { CreditServiceError, getBalance, refundCredits, reserveCredits } from "@/server/services/credits";
import { enqueueGenerationJob } from "@/server/queues/generationQueue";
import { getQueueMode } from "@/server/queue-mode";
import { isRedisReachableForQueue } from "@/server/queues/redisConnection";
import {
  MODERATION_USER_MESSAGE,
  moderateGenerationInput,
} from "@/server/services/moderation";
import {
  modelHasSettingsSchema,
  validateAndNormalizeModelSettings,
} from "@/server/services/model-settings";
import { processGeneration } from "@/server/services/generationProcessor";
import {
  assertProductCardPriceAllowed,
  calculateProductCardConceptImageCredits,
  calculateProductCardMarketplaceCardCredits,
  calculateProductCardVideoCredits,
  type ProductCardPriceBreakdown,
} from "@/server/services/productCardPricing";
import {
  assertKlingMotionUrlsOwnedByUser,
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

function redisAndKieReady(): boolean {
  return (
    Boolean(process.env.REDIS_URL?.trim()) &&
    Boolean(process.env.KIE_API_KEY?.trim()) &&
    Boolean(process.env.KIE_BASE_URL?.trim())
  );
}

/**
 * Image product-card: inline + MOCK_KIE — без Redis/KIE; иначе как обычная очередь.
 */
function canRunProductCardImage(): boolean {
  if (getQueueMode() === "inline") {
    if (isMockKie()) return true;
    return Boolean(
      process.env.KIE_API_KEY?.trim() && process.env.KIE_BASE_URL?.trim(),
    );
  }
  return redisAndKieReady();
}

function canRunProductCardVideo(): boolean {
  if (getQueueMode() === "inline") {
    if (isMockKie()) return true;
    return Boolean(
      process.env.KIE_API_KEY?.trim() && process.env.KIE_BASE_URL?.trim(),
    );
  }
  return redisAndKieReady();
}

function productCardExtraTextsFromRoot(
  root?: Record<string, unknown>,
): string[] {
  if (!root) return [];
  const out: string[] = [];
  for (const k of [
    "userPrompt",
    "productTitle",
    "userInstructions",
    "extraText",
  ] as const) {
    const v = root[k];
    if (typeof v === "string" && v.trim()) out.push(v);
  }
  const b = root.benefits;
  if (Array.isArray(b)) {
    for (const x of b) {
      if (typeof x === "string" && x.trim()) out.push(x);
    }
  } else if (typeof b === "string" && b.trim()) {
    out.push(b);
  }
  return out;
}

export type ProductCardGenMeta = {
  flow: "product_card";
  productCard: {
    projectId: string;
    tab: "concept_photo" | "marketplace_card" | "video";
    category?: string;
    conceptId?: string;
    sourceType?:
      | "original"
      | "generated_concept"
      | "generated_card"
      | "concept_generation"
      | "marketplace_card_generation";
  };
};

function applyProductCardMetadata(
  target: Record<string, unknown>,
  product: ProductCardGenMeta,
): void {
  target.flow = "product_card";
  target.productCard = product.productCard;
}

type QueueOk = {
  ok: true;
  generationId: string;
  status: string;
  error?: string;
  costCredits?: number;
};
type QueueErr = { ok: false; error: string; status: number; reason?: string };
export type QueueResult = QueueOk | QueueErr;

/**
 * Сбор inputFiles + settings (image) как в /api/generations/image.
 * Экспортируется для product-card: estimate + merge marketplaceCard settings.
 */
export function buildImageModelInput(
  model: { settingsSchema: unknown; supportsImageInput: boolean },
  sourceImageUrl: string | string[],
): { normalizedSettings: Record<string, unknown>; inputFiles: string[]; hasSchema: boolean } {
  const sourceImageUrls = (Array.isArray(sourceImageUrl) ? sourceImageUrl : [sourceImageUrl])
    .map((url) => url.trim())
    .filter(Boolean);
  const mainSourceImageUrl = sourceImageUrls[0] ?? "";
  const hasSchema = modelHasSettingsSchema(model.settingsSchema);
  let schemaAcceptsMultipleImages = !hasSchema;
  let normalizedSettings: Record<string, unknown> = {};
  if (hasSchema) {
    const d = defaultsFromSchema(model.settingsSchema);
    const fields = getSchemaFields(model.settingsSchema);
    const fieldNames = new Set(fields.map((f) => f.name));
    schemaAcceptsMultipleImages = fields.some(
      (f) =>
        (f.name === "referenceImageUrls" ||
          f.name === "imageUrls" ||
          f.name === "inputUrls") &&
        (f.type === "url-list" ||
          f.type === "image-upload-list" ||
          (typeof f.maxItems === "number" && f.maxItems > 1)),
    );
    const urlsForSchema = schemaAcceptsMultipleImages
      ? sourceImageUrls
      : mainSourceImageUrl
        ? [mainSourceImageUrl]
        : [];
    if (fieldNames.has("referenceImageUrls")) {
      d.referenceImageUrls = urlsForSchema;
    }
    if (fieldNames.has("imageUrls")) {
      d.imageUrls = urlsForSchema;
    }
    if (fieldNames.has("inputUrls")) {
      d.inputUrls = urlsForSchema;
    }
    if (mainSourceImageUrl && fieldNames.has("imageUrl")) {
      d.imageUrl = mainSourceImageUrl;
    }
    if (mainSourceImageUrl && fieldNames.has("firstFrameUrl")) {
      d.firstFrameUrl = mainSourceImageUrl;
    }
    const v = validateAndNormalizeModelSettings(
      model.settingsSchema,
      d as Record<string, unknown>,
    );
    if (!v.ok) {
      throw new Error(v.message);
    }
    normalizedSettings = v.settings;
  }
  const fromSettings = hasSchema
    ? [
        ...(Array.isArray((normalizedSettings as { imageUrls?: string[] }).imageUrls)
          ? (normalizedSettings as { imageUrls: string[] }).imageUrls
          : []),
        ...(Array.isArray((normalizedSettings as { inputUrls?: string[] }).inputUrls)
          ? (normalizedSettings as { inputUrls: string[] }).inputUrls
          : []),
        ...(Array.isArray((normalizedSettings as { referenceImageUrls?: string[] }).referenceImageUrls)
          ? (normalizedSettings as { referenceImageUrls: string[] }).referenceImageUrls
          : []),
      ]
    : [];
  const fallbackUrls = schemaAcceptsMultipleImages
    ? sourceImageUrls
    : mainSourceImageUrl
      ? [mainSourceImageUrl]
      : [];
  const inputFiles = fromSettings.length > 0 ? fromSettings : fallbackUrls;
  return { normalizedSettings, inputFiles, hasSchema };
}

export type MarketplaceCardImageSettings = {
  sourceImageUrl: string;
  sourceImageUrls?: string[];
  generationMode: "marketplace_card";
  style: string;
};

export async function queueProductCardImage(
  userId: string,
  model: AiModel,
  prompt: string,
  sourceImageUrl: string | string[],
  productMeta: ProductCardGenMeta,
  negativePrompt?: string | null,
  /** Плоские поля в metadata (flow, projectId, tab, categoryId, …) — без hidden prompt. */
  metadataRoot?: Record<string, unknown>,
  /** Для «Карточка товара»: merge в `metadata.settings` + тот же объект для Product Card pricing. */
  marketplaceCardSettings?: MarketplaceCardImageSettings | null,
  pricingBreakdown?: ProductCardPriceBreakdown | null,
): Promise<QueueResult> {
  if (!model || model.type !== "IMAGE") {
    return { ok: false, error: "Модель изображения недоступна", status: 500 };
  }
  if (!canRunProductCardImage()) {
    return {
      ok: false,
      error:
        getQueueMode() === "inline" && !isMockKie()
          ? "Генерация недоступна: настройте KIE_API_KEY и KIE_BASE_URL"
          : "Генерация недоступна: проверьте REDIS, KIE",
      status: 503,
    };
  }

  const hasSchema = modelHasSettingsSchema(model.settingsSchema);
  let normalizedSettings: Record<string, unknown> = {};
  let inputFilesCombined: string[] = [];
  try {
    const b = buildImageModelInput(
      { settingsSchema: model.settingsSchema, supportsImageInput: model.supportsImageInput },
      sourceImageUrl,
    );
    normalizedSettings = b.normalizedSettings;
    inputFilesCombined = b.inputFiles;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Некорректные настройки модели",
      status: 400,
    };
  }

  if (inputFilesCombined.length > 0 && !model.supportsImageInput) {
    return { ok: false, error: "Модель не поддерживает входное изображение", status: 400 };
  }
  const filesCheck = validateImageInputFiles(
    inputFilesCombined.length > 0 ? inputFilesCombined : undefined,
  );
  if (!filesCheck.ok) {
    return { ok: false, error: filesCheck.error, status: 400 };
  }
  if (inputFilesCombined.length > 0 && model.supportsImageInput) {
    const hasData = inputFilesCombined.some((s) => s.trim().startsWith("data:"));
    if (hasData) {
      return { ok: false, error: "Нужен публичный URL изображения", status: 400 };
    }
    if (!isMockKie() && model.provider === "KIE_AI") {
      if (kieReachableImageUrlsFromInputFiles(inputFilesCombined).length === 0) {
        return { ok: false, error: KIE_REQUIRES_PUBLIC_IMAGE_URLS_RU, status: 400 };
      }
    } else if (publicHttpUrlsOnly(inputFilesCombined).length === 0) {
      return { ok: false, error: "Укажите публичный https URL", status: 400 };
    }
  }

  const metadata: Record<string, unknown> = {};
  if (hasSchema) {
    metadata.settings = marketplaceCardSettings
      ? { ...normalizedSettings, ...marketplaceCardSettings }
      : normalizedSettings;
  } else if (marketplaceCardSettings) {
    metadata.settings = { ...marketplaceCardSettings };
  }
  applyProductCardMetadata(metadata, productMeta);
  if (metadataRoot) {
    Object.assign(metadata, metadataRoot);
  }

  const mod = await moderateGenerationInput({
    prompt,
    negativePrompt: negativePrompt ?? null,
    extraTexts: productCardExtraTextsFromRoot(metadataRoot),
    userId,
    modelId: model.id,
    flow: productMeta.productCard.tab,
  });
  if (!mod.allowed) {
    return {
      ok: false,
      error: MODERATION_USER_MESSAGE,
      reason: mod.reason,
      status: 400,
    };
  }

  const mergedForCredits = marketplaceCardSettings
    ? { ...normalizedSettings, ...marketplaceCardSettings }
    : normalizedSettings;
  let price = pricingBreakdown ?? null;
  if (!price) {
    price =
      productMeta.productCard.tab === "marketplace_card"
        ? await calculateProductCardMarketplaceCardCredits(model, mergedForCredits)
        : await calculateProductCardConceptImageCredits(model, mergedForCredits);
  }
  try {
    assertProductCardPriceAllowed(price);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка цены", status: 400 };
  }
  const costCreditsCalculated = price.credits;
  metadata.pricingScope = "PRODUCT_CARD";
  metadata.productCardModelType = model.productCardModelType;
  metadata.priceBreakdown = price as unknown as Prisma.InputJsonValue;
  let balance: number;
  try {
    balance = await getBalance(userId);
  } catch {
    return { ok: false, error: "Пользователь не найден", status: 404 };
  }
  if (balance < costCreditsCalculated) {
    return { ok: false, error: "Недостаточно кредитов", status: 402 };
  }

  const gen = await prisma.generation.create({
    data: {
      userId,
      modelId: model.id,
      type: "IMAGE",
      status: "QUEUED",
      prompt,
      negativePrompt: negativePrompt ?? null,
      inputFiles: inputFilesCombined.length
        ? (inputFilesCombined as Prisma.InputJsonValue)
        : undefined,
      costCredits: costCreditsCalculated,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  try {
    await reserveCredits(userId, costCreditsCalculated, gen.id, "Резерв: карточка товара (фото)");
  } catch (e) {
    await prisma.generation.delete({ where: { id: gen.id } });
    if (e instanceof CreditServiceError && e.code === "INSUFFICIENT") {
      return { ok: false, error: "Недостаточно кредитов", status: 402 };
    }
    return {
      ok: false,
      error: publicApiErrorMessage(e, "Ошибка резерва кредитов"),
      status: 400,
    };
  }

  const queueMode = getQueueMode();
  if (queueMode === "inline") {
    await import("@/server/services/generationProcessor").then((m) => m.processGeneration(gen.id));
    const out = await prisma.generation.findUnique({ where: { id: gen.id } });
    return {
      ok: true,
      generationId: gen.id,
      status: out?.status ?? "QUEUED",
      costCredits: costCreditsCalculated,
    };
  }

  const redisUp = await isRedisReachableForQueue();
  if (!redisUp) {
    try {
      await refundCredits(gen.id, "Возврат: Redis недоступен");
    } catch {
      // ignore
    }
    await prisma.generation.delete({ where: { id: gen.id } }).catch(() => {});
    return { ok: false, error: "Очередь генерации недоступна (Redis).", status: 503 };
  }
  try {
    await enqueueGenerationJob(gen.id);
  } catch (e) {
    try {
      await refundCredits(gen.id, "Возврат: очередь");
    } catch {
      // ignore
    }
    await prisma.generation.delete({ where: { id: gen.id } }).catch(() => {});
    return {
      ok: false,
      error: publicApiErrorMessage(e, "Не удалось поставить в очередь"),
      status: 503,
    };
  }
  return {
    ok: true,
    generationId: gen.id,
    status: "QUEUED",
    costCredits: costCreditsCalculated,
  };
}

export async function queueProductCardVideo(
  userId: string,
  model: NonNullable<Awaited<ReturnType<typeof prisma.aiModel.findFirst>>>,
  prompt: string,
  normalizedSettings: Record<string, unknown>,
  productMeta: ProductCardGenMeta,
  bodyInputFiles: string[],
  negativePromptMerged: string | null,
  /** Плоские поля metadata (flow, projectId, tab, …) — без hidden prompt. */
  metadataRoot?: Record<string, unknown>,
  pricingBreakdown?: ProductCardPriceBreakdown | null,
): Promise<QueueResult> {
  if (model.type !== "VIDEO") {
    return { ok: false, error: "Видео-модель недоступна", status: 500 };
  }
  if (!canRunProductCardVideo()) {
    return {
      ok: false,
      error:
        getQueueMode() === "inline" && !isMockKie()
          ? "Генерация недоступна: настройте KIE_API_KEY и KIE_BASE_URL"
          : "Генерация недоступна: проверьте REDIS, KIE",
      status: 503,
    };
  }

  const hasSchema = modelHasSettingsSchema(model.settingsSchema);
  const imageUrlsFromSettings = (() => {
    if (!hasSchema) return [] as string[];
    if (isKlingMotionControlModel(model.apiModelId)) {
      return collectKlingMotionControlHttpUrls(normalizedSettings);
    }
    if (isSeedanceScenarioModel(model.apiModelId)) {
      return collectSeedanceSettingsHttpUrls(normalizedSettings);
    }
    if (Array.isArray(normalizedSettings.imageUrls)) {
      return normalizedSettings.imageUrls.filter((x): x is string => typeof x === "string");
    }
    return [] as string[];
  })();
  const inputFilesCombined = [...(bodyInputFiles ?? []), ...imageUrlsFromSettings];

  if (isKling30Model(model.apiModelId)) {
    const kVal = validateKling30Settings(normalizedSettings);
    if (!kVal.ok) {
      return { ok: false, error: kVal.message, status: 400 };
    }
  }
  if (isSeedanceScenarioModel(model.apiModelId)) {
    const sVal = validateSeedanceScenario(normalizedSettings);
    if (!sVal.ok) {
      return { ok: false, error: sVal.message, status: 400 };
    }
  }
  if (isKlingMotionControlModel(model.apiModelId)) {
    const mc = validateKlingMotionControlSettings(normalizedSettings);
    if (!mc.ok) {
      return { ok: false, error: mc.message, status: 400 };
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
      return { ok: false, error: own.message, status: 400 };
    }
  }

  const filesCheck = validateVideoInputFiles(
    inputFilesCombined.length > 0 ? inputFilesCombined : undefined,
  );
  if (!filesCheck.ok) {
    return { ok: false, error: filesCheck.error, status: 400 };
  }
  if (inputFilesCombined.length > 0) {
    const hasData = inputFilesCombined.some((s) => s.trim().startsWith("data:"));
    if (hasData) {
      return { ok: false, error: "Нужен публичный URL", status: 400 };
    }
    if (!isMockKie() && model.provider === "KIE_AI") {
      if (kieReachableImageUrlsFromInputFiles(inputFilesCombined).length === 0) {
        return { ok: false, error: KIE_REQUIRES_PUBLIC_IMAGE_URLS_RU, status: 400 };
      }
    } else if (publicHttpUrlsOnly(inputFilesCombined).length === 0) {
      return { ok: false, error: "Публичный http(s) URL", status: 400 };
    }
  }
  if (
    inputFilesCombined.length > 0 &&
    !model.supportsImageInput &&
    !model.supportsVideoInput
  ) {
    return { ok: false, error: "Модель не поддерживает вложения", status: 400 };
  }

  const metadata: Record<string, unknown> = {};
  if (hasSchema) {
    metadata.settings = normalizedSettings;
  }
  applyProductCardMetadata(metadata, productMeta);
  if (metadataRoot) {
    Object.assign(metadata, metadataRoot);
  }

  const mod = await moderateGenerationInput({
    prompt,
    negativePrompt: negativePromptMerged,
    extraTexts: productCardExtraTextsFromRoot(metadataRoot),
    userId,
    modelId: model.id,
    flow: productMeta.productCard.tab,
  });
  if (!mod.allowed) {
    return {
      ok: false,
      error: MODERATION_USER_MESSAGE,
      reason: mod.reason,
      status: 400,
    };
  }

  const price =
    pricingBreakdown ?? (await calculateProductCardVideoCredits(model, normalizedSettings));
  try {
    assertProductCardPriceAllowed(price);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка цены", status: 400 };
  }
  const costCreditsCalculated = price.credits;
  metadata.pricingScope = "PRODUCT_CARD";
  metadata.productCardModelType = model.productCardModelType;
  metadata.priceBreakdown = price as unknown as Prisma.InputJsonValue;
  let balance: number;
  try {
    balance = await getBalance(userId);
  } catch {
    return { ok: false, error: "Пользователь не найден", status: 404 };
  }
  if (balance < costCreditsCalculated) {
    return { ok: false, error: "Недостаточно кредитов", status: 402 };
  }

  const gen = await prisma.generation.create({
    data: {
      userId,
      modelId: model.id,
      type: "VIDEO",
      status: "QUEUED",
      prompt,
      negativePrompt: negativePromptMerged,
      inputFiles: inputFilesCombined.length
        ? (inputFilesCombined as Prisma.InputJsonValue)
        : undefined,
      costCredits: costCreditsCalculated,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  try {
    await reserveCredits(userId, costCreditsCalculated, gen.id, "Резерв: карточка товара (видео)");
  } catch (e) {
    await prisma.generation.delete({ where: { id: gen.id } });
    if (e instanceof CreditServiceError && e.code === "INSUFFICIENT") {
      return { ok: false, error: "Недостаточно кредитов", status: 402 };
    }
    return {
      ok: false,
      error: publicApiErrorMessage(e, "Ошибка резерва кредитов"),
      status: 400,
    };
  }

  const queueMode = getQueueMode();
  if (queueMode === "inline") {
    await processGeneration(gen.id);
    const out = await prisma.generation.findUnique({ where: { id: gen.id } });
    return {
      ok: true,
      generationId: gen.id,
      status: out?.status ?? "QUEUED",
      costCredits: costCreditsCalculated,
    };
  }
  const redisUp = await isRedisReachableForQueue();
  if (!redisUp) {
    try {
      await refundCredits(gen.id, "Возврат: Redis");
    } catch {
      // ignore
    }
    await prisma.generation.delete({ where: { id: gen.id } }).catch(() => {});
    return { ok: false, error: "Очередь недоступна (Redis).", status: 503 };
  }
  try {
    await enqueueGenerationJob(gen.id);
  } catch (e) {
    try {
      await refundCredits(gen.id, "Возврат: очередь");
    } catch {
      // ignore
    }
    await prisma.generation.delete({ where: { id: gen.id } }).catch(() => {});
    return {
      ok: false,
      error: publicApiErrorMessage(e, "Очередь"),
      status: 503,
    };
  }
  return {
    ok: true,
    generationId: gen.id,
    status: "QUEUED",
    costCredits: costCreditsCalculated,
  };
}
