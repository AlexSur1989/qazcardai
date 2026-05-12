
import { getAppSetting } from "@/server/services/appSettings";

export const PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE =
  "Модель карточки товара не настроена. Обратитесь к администратору.";

export type ProductCardModelType =
  | "PRODUCT_CLASSIFIER"
  | "PRODUCT_CONCEPT_IMAGE"
  | "PRODUCT_MARKETPLACE_CARD"
  | "PRODUCT_CARD_BUILDER"
  | "PRODUCT_VIDEO";

export type ProductCardScenarioKey =
  | "conceptPhoto"
  | "marketplaceCard"
  | "cardBuilder"
  | "productVideo";

export type ProductCardScenarioToggle = {
  enabled: boolean;
  label: string;
};

export type ProductCardScenarioToggles = Record<
  ProductCardScenarioKey,
  ProductCardScenarioToggle
>;

export type ProductCardCardBuilderPricing = {
  cardBuilderPlanCredits: number;
  cardBuilderSingleSlideCredits: number;
  cardBuilderGallery6Credits: number;
  cardBuilderGallery8Credits: number;
  multipliers: {
    premiumStyle: number;
    heavyTextInfographic: number;
  };
};

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
  scenarios: ProductCardScenarioToggles;
  cardBuilderPricing: ProductCardCardBuilderPricing;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

const DEFAULT_SCENARIOS: ProductCardScenarioToggles = {
  conceptPhoto: { enabled: true, label: "Фото с концепциями" },
  marketplaceCard: { enabled: true, label: "Карточка товара" },
  cardBuilder: { enabled: true, label: "Создать карточку" },
  productVideo: { enabled: true, label: "Видео" },
};

function normalizeScenarios(raw: unknown): ProductCardScenarioToggles {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_SCENARIOS };
  }
  const o = raw as Record<string, unknown>;
  const pick = (
    key: ProductCardScenarioKey,
    fb: ProductCardScenarioToggle,
  ): ProductCardScenarioToggle => {
    const v = o[key];
    if (!v || typeof v !== "object" || Array.isArray(v)) return { ...fb };
    const row = v as Record<string, unknown>;
    return {
      enabled: asBool(row.enabled, fb.enabled),
      label: asString(row.label, fb.label),
    };
  };
  return {
    conceptPhoto: pick("conceptPhoto", DEFAULT_SCENARIOS.conceptPhoto),
    marketplaceCard: pick("marketplaceCard", DEFAULT_SCENARIOS.marketplaceCard),
    cardBuilder: pick("cardBuilder", DEFAULT_SCENARIOS.cardBuilder),
    productVideo: pick("productVideo", DEFAULT_SCENARIOS.productVideo),
  };
}

const DEFAULT_CARD_BUILDER_PRICING: ProductCardCardBuilderPricing = {
  cardBuilderPlanCredits: 0,
  cardBuilderSingleSlideCredits: 150,
  cardBuilderGallery6Credits: 750,
  cardBuilderGallery8Credits: 950,
  multipliers: { premiumStyle: 1.2, heavyTextInfographic: 1.1 },
};

function normalizeCardBuilderPricing(raw: unknown): ProductCardCardBuilderPricing {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_CARD_BUILDER_PRICING, multipliers: { ...DEFAULT_CARD_BUILDER_PRICING.multipliers } };
  }
  const o = raw as Record<string, unknown>;
  const mult = asRecord(o.multipliers);
  return {
    cardBuilderPlanCredits: Math.max(0, Math.round(asNumber(o.cardBuilderPlanCredits, DEFAULT_CARD_BUILDER_PRICING.cardBuilderPlanCredits))),
    cardBuilderSingleSlideCredits: Math.max(1, Math.round(asNumber(o.cardBuilderSingleSlideCredits, DEFAULT_CARD_BUILDER_PRICING.cardBuilderSingleSlideCredits))),
    cardBuilderGallery6Credits: Math.max(1, Math.round(asNumber(o.cardBuilderGallery6Credits, DEFAULT_CARD_BUILDER_PRICING.cardBuilderGallery6Credits))),
    cardBuilderGallery8Credits: Math.max(1, Math.round(asNumber(o.cardBuilderGallery8Credits, DEFAULT_CARD_BUILDER_PRICING.cardBuilderGallery8Credits))),
    multipliers: {
      premiumStyle: Math.max(0.1, asNumber(mult?.premiumStyle, DEFAULT_CARD_BUILDER_PRICING.multipliers.premiumStyle)),
      heavyTextInfographic: Math.max(0.1, asNumber(mult?.heavyTextInfographic, DEFAULT_CARD_BUILDER_PRICING.multipliers.heavyTextInfographic)),
    },
  };
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
    getAppSetting("PRODUCT_CARD_SCENARIOS"),
    getAppSetting("PRODUCT_CARD_CARD_BUILDER_PRICING"),
  ]);

  return {
    enabled: asBool(entries[0], true),
    mockMode: asBool(entries[1], false),
    maxSourceImages: Math.min(4, Math.max(1, Math.round(asNumber(entries[2], 4, 1)))),
    requiredMainImage: asBool(entries[3], true),
    classifierModelSlug: asString(entries[4], "gemini-2-5-flash-classifier"),
    conceptImageModelSlug: asString(entries[5], "seedream-4-0-product-concept"),
    marketplaceCardModelSlug: asString(entries[6], "gpt-image-2-product-card"),
    cardBuilderModelSlug: asString(entries[7]),
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
    scenarios: normalizeScenarios(entries[20]),
    cardBuilderPricing: normalizeCardBuilderPricing(entries[21]),
  };
}

export function defaultSlugForProductCardType(
  settings: ProductCardSettings,
  type: ProductCardModelType,
): string {
  if (type === "PRODUCT_CLASSIFIER") return settings.classifierModelSlug;
  if (type === "PRODUCT_CONCEPT_IMAGE") return settings.conceptImageModelSlug;
  if (type === "PRODUCT_MARKETPLACE_CARD") return settings.marketplaceCardModelSlug;
  if (type === "PRODUCT_CARD_BUILDER") return settings.cardBuilderModelSlug.trim();
  return settings.videoModelSlug;
}
