
import { getAppSetting } from "@/server/services/appSettings";

export const PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE =
  "Модель карточки товара не настроена. Обратитесь к администратору.";

export type ProductCardModelType =
  | "PRODUCT_CLASSIFIER"
  | "PRODUCT_CONCEPT_IMAGE"
  | "PRODUCT_MARKETPLACE_CARD"
  | "PRODUCT_VIDEO"
  | "PRODUCT_CARD_BUILDER";

export type ProductCardSizePreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
};

export type ProductCardVideoPreset = {
  duration: number;
  resolution: string;
  aspectRatio: string;
};

export type ProductCardSettings = {
  enabled: boolean;
  mockMode: boolean;
  maxSourceImages: number;
  requiredMainImage: boolean;
  classifierModelSlug: string;
  conceptImageModelSlug: string;
  marketplaceCardModelSlug: string;
  cardBuilderModelSlug: string;
  videoModelSlug: string;
  usdToKzt: number;
  tokenValueKzt: number;
  markupPercent: number;
  allowNegativeMargin: boolean;
  lowMarginWarningPercent: number;
  minConceptImageTokens: number;
  minMarketplaceCardTokens: number;
  minVideoTokens: number;
  conceptImageSizes: ProductCardSizePreset[];
  marketplaceCardSizes: ProductCardSizePreset[];
  videoPresets: ProductCardVideoPreset[];
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number, min = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSizePresets(value: unknown): ProductCardSizePreset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = asString(row.id);
    const label = asString(row.label, id);
    const width = asNumber(row.width, 0, 1);
    const height = asNumber(row.height, 0, 1);
    const aspectRatio = asString(row.aspectRatio);
    if (!id || !label || !width || !height || !aspectRatio) return [];
    return [{ id, label, width, height, aspectRatio }];
  });
}

function normalizeVideoPresets(value: unknown): ProductCardVideoPreset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const duration = Math.round(asNumber(row.duration, 0, 1));
    const resolution = asString(row.resolution);
    const aspectRatio = asString(row.aspectRatio);
    if (!duration || !resolution || !aspectRatio) return [];
    return [{ duration, resolution, aspectRatio }];
  });
}

export async function getProductCardSettings(): Promise<ProductCardSettings> {
  const entries = await Promise.all([
    getAppSetting("PRODUCT_CARD_ENABLED"),
    getAppSetting("PRODUCT_CARD_MOCK_MODE"),
    getAppSetting("PRODUCT_CARD_MAX_SOURCE_IMAGES"),
    getAppSetting("PRODUCT_CARD_REQUIRED_MAIN_IMAGE"),
    getAppSetting("PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG"),
    getAppSetting("PRODUCT_CARD_DEFAULT_CONCEPT_IMAGE_MODEL_SLUG"),
    getAppSetting("PRODUCT_CARD_DEFAULT_MARKETPLACE_CARD_MODEL_SLUG"),
    getAppSetting("PRODUCT_CARD_DEFAULT_CARD_BUILDER_MODEL_SLUG"),
    getAppSetting("PRODUCT_CARD_DEFAULT_VIDEO_MODEL_SLUG"),
    getAppSetting("PRODUCT_CARD_DEFAULT_USD_TO_KZT"),
    getAppSetting("PRODUCT_CARD_DEFAULT_TOKEN_VALUE_KZT"),
    getAppSetting("PRODUCT_CARD_DEFAULT_MARKUP_PERCENT"),
    getAppSetting("PRODUCT_CARD_ALLOW_NEGATIVE_MARGIN"),
    getAppSetting("PRODUCT_CARD_LOW_MARGIN_WARNING_PERCENT"),
    getAppSetting("PRODUCT_CARD_MIN_CONCEPT_IMAGE_TOKENS"),
    getAppSetting("PRODUCT_CARD_MIN_MARKETPLACE_CARD_TOKENS"),
    getAppSetting("PRODUCT_CARD_MIN_VIDEO_TOKENS"),
    getAppSetting("PRODUCT_CARD_CONCEPT_IMAGE_SIZES"),
    getAppSetting("PRODUCT_CARD_MARKETPLACE_CARD_SIZES"),
    getAppSetting("PRODUCT_CARD_VIDEO_PRESETS"),
  ]);

  return {
    enabled: asBool(entries[0], true),
    mockMode: asBool(entries[1], false),
    maxSourceImages: Math.min(4, Math.max(1, Math.round(asNumber(entries[2], 4, 1)))),
    requiredMainImage: asBool(entries[3], true),
    classifierModelSlug: asString(entries[4], "gemini-2-5-flash-classifier"),
    conceptImageModelSlug: asString(entries[5], "seedream-4-0-product-concept"),
    marketplaceCardModelSlug: asString(entries[6], "gpt-image-2-product-card"),
    cardBuilderModelSlug: asString(entries[7], "gpt-image-2-product-card"),
    videoModelSlug: asString(entries[8], "seedance-2-0-fast-product-video"),
    usdToKzt: asNumber(entries[9], 500, 1),
    tokenValueKzt: asNumber(entries[10], 10, 0.0001),
    markupPercent: asNumber(entries[11], 100, 0),
    allowNegativeMargin: asBool(entries[12], false),
    lowMarginWarningPercent: asNumber(entries[13], 30, 0),
    minConceptImageTokens: Math.round(asNumber(entries[14], 15, 0)),
    minMarketplaceCardTokens: Math.round(asNumber(entries[15], 25, 0)),
    minVideoTokens: Math.round(asNumber(entries[16], 40, 0)),
    conceptImageSizes: normalizeSizePresets(entries[17]),
    marketplaceCardSizes: normalizeSizePresets(entries[18]),
    videoPresets: normalizeVideoPresets(entries[19]),
  };
}

export function defaultSlugForProductCardType(
  settings: ProductCardSettings,
  type: ProductCardModelType,
): string {
  if (type === "PRODUCT_CLASSIFIER") return settings.classifierModelSlug;
  if (type === "PRODUCT_CONCEPT_IMAGE") return settings.conceptImageModelSlug;
  if (type === "PRODUCT_MARKETPLACE_CARD") return settings.marketplaceCardModelSlug;
  if (type === "PRODUCT_CARD_BUILDER") return settings.cardBuilderModelSlug;
  return settings.videoModelSlug;
}
