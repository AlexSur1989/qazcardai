import type { ProductCardMarketplaceProfile } from "@/config/product-card-marketplace-profiles";
import { PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION } from "@/config/product-card-marketplace-profiles";

/**
 * Универсальный профиль card_builder: без правил Kaspi/Ozon/WB.
 * Используется при targetPlatform=universal (по умолчанию).
 */
export const UNIVERSAL_CARD_BUILDER_PROFILE: ProductCardMarketplaceProfile = {
  id: "universal",
  label: "Универсальная карточка",
  sourceLevel: "default",
  enabled: true,
  defaultAspectRatio: "1:1",
  defaultSize: "1500x1500",
  mainPhotoTextAllowed: true,
  infographicAllowed: true,
  lifestyleAllowed: true,
  preserveProductRequired: true,
  avoidWatermarks: true,
  avoidExtraObjects: false,
  avoidLogos: false,
  maxBenefitBadges: 8,
  recommendedSlides: [
    "main_photo",
    "benefits_infographic",
    "detail_closeup",
    "materials",
    "dimensions",
    "lifestyle",
    "packaging",
    "premium_poster",
  ],
  allowedSlideTypes: [
    "main_photo",
    "benefits_infographic",
    "materials",
    "dimensions",
    "lifestyle",
    "detail_closeup",
    "packaging",
    "premium_poster",
    "ad_banner",
  ],
  mainPhotoRules: {
    textAllowed: true,
    recommendedTextDensity: "minimal",
    background: "clean",
    productFocus: "high",
    preserveProductRequired: true,
    avoidExtraObjects: false,
    promptInstruction:
      "Универсальная e-commerce карточка: чистый фокус на товаре, честная идентичность SKU, гибкий дизайн без правил конкретного маркетплейса.",
  },
  infographicRules: {
    textAllowed: true,
    maxBenefitBadges: 8,
    iconsAllowed: true,
    largeReadableText: true,
    promptInstruction:
      "Инфографика с преимуществами: только факты пользователя; не выдумывать характеристики и медицинские обещания.",
  },
  lifestyleRules: {
    allowed: true,
    promptInstruction:
      "Lifestyle-кадр: реалистичная сцена использования; товар узнаваем; текст только из locked phrases.",
  },
  complianceHints: [
    "Не выдумывай размеры, состав, функции и сертификаты.",
    "Сохраняй товар 1:1 с исходного фото.",
    "Не добавляй водяные знаки и чужие бренды.",
  ],
  needsVerification: false,
  promptInstruction:
    "Универсальный режим генерации карточек: профессиональный e-commerce дизайн без привязки к маркетплейсу.",
  userHint: "Универсальная карточка для сайта, соцсетей или любых витрин.",
};

export const UNIVERSAL_CARD_BUILDER_PROFILE_VERSION = PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION;

export function isUniversalCardBuilderTarget(targetPlatform?: string | null): boolean {
  if (targetPlatform == null) return false;
  const t = targetPlatform.trim();
  return t === "universal" || t === "";
}

export function resolveCardBuilderProfileForPlan(input: {
  targetPlatform?: string | null;
  marketplace?: string | null;
  marketplaceProfile?: ProductCardMarketplaceProfile | null;
}): ProductCardMarketplaceProfile {
  if (isUniversalCardBuilderTarget(input.targetPlatform)) {
    return UNIVERSAL_CARD_BUILDER_PROFILE;
  }
  return input.marketplaceProfile ?? UNIVERSAL_CARD_BUILDER_PROFILE;
}
