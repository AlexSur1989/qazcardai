/**
 * Тип профиля card_builder и снимок правил для metadata.
 * Каноничный профиль сценария «Создать карточку» — UNIVERSAL_CARD_BUILDER_PROFILE.
 */

import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";

export const PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION = "v1" as const;

export type ProductCardMarketplaceSourceLevel =
  | "official"
  | "secondary"
  | "default"
  | "mixed";

export type ProductCardMarketplaceProfile = {
  id: string;
  label: string;
  description?: string;
  sourceLevel: ProductCardMarketplaceSourceLevel;
  needsVerification?: boolean;
  enabled: boolean;
  defaultAspectRatio: string;
  defaultSize: string;
  extraAspectRatios?: string[];
  extraSizes?: string[];
  fileFormats?: string[];
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxFileSizeMb?: number;
  mainPhotoTextAllowed: boolean;
  infographicAllowed: boolean;
  lifestyleAllowed: boolean;
  preserveProductRequired: boolean;
  avoidWatermarks: boolean;
  avoidExtraObjects: boolean;
  avoidLogos?: boolean;
  avoidPriceLabels?: boolean;
  avoidContacts?: boolean;
  maxBenefitBadges: number;
  recommendedSlides: string[];
  allowedSlideTypes: string[];
  mainPhotoRules: {
    textAllowed: boolean;
    recommendedTextDensity: "none" | "minimal" | "medium" | "heavy" | "infographic";
    background:
      | "pure_white"
      | "white"
      | "clean"
      | "neutral"
      | "realistic"
      | "brand"
      | "lifestyle"
      | "custom";
    productFocus: "strict" | "high" | "medium" | "flexible";
    preserveProductRequired: boolean;
    avoidExtraObjects: boolean;
    promptInstruction: string;
  };
  infographicRules: {
    textAllowed: boolean;
    maxBenefitBadges: number;
    iconsAllowed: boolean;
    largeReadableText: boolean;
    promptInstruction: string;
  };
  lifestyleRules: {
    allowed: boolean;
    promptInstruction: string;
  };
  promptInstruction: string;
  userHint: string;
  complianceHints: string[];
};

const SLIDE_ROLE_ALIASES: Record<string, CardBuilderTemplateSlideRole> = {
  package: "packaging",
  front_view: "main_photo",
  back_view: "detail_closeup",
  scale: "dimensions",
  details: "detail_closeup",
};

const VALID_ROLES = new Set<CardBuilderTemplateSlideRole>([
  "main_photo",
  "benefits_infographic",
  "dimensions",
  "materials",
  "lifestyle",
  "detail_closeup",
  "packaging",
  "premium_poster",
  "ad_banner",
]);

export function normalizeMarketplaceSlideRole(
  raw: string,
): CardBuilderTemplateSlideRole | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (VALID_ROLES.has(s as CardBuilderTemplateSlideRole)) {
    return s as CardBuilderTemplateSlideRole;
  }
  const mapped = SLIDE_ROLE_ALIASES[s];
  return mapped ?? null;
}

export function normalizeSlideRoleList(list: string[]): CardBuilderTemplateSlideRole[] {
  const out: CardBuilderTemplateSlideRole[] = [];
  const seen = new Set<string>();
  for (const x of list) {
    const r = normalizeMarketplaceSlideRole(x);
    if (r && !seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  return out;
}

export type AppliedMarketplaceRulesSnapshot = {
  defaultAspectRatio: string;
  defaultSize: string;
  mainPhotoTextAllowed: boolean;
  maxBenefitBadges: number;
  sourceLevel: ProductCardMarketplaceSourceLevel;
  needsVerification?: boolean;
  infographicAllowed: boolean;
  lifestyleAllowed: boolean;
};

export function buildAppliedMarketplaceRulesSnapshot(
  p: ProductCardMarketplaceProfile,
): AppliedMarketplaceRulesSnapshot {
  return {
    defaultAspectRatio: p.defaultAspectRatio,
    defaultSize: p.defaultSize,
    mainPhotoTextAllowed: p.mainPhotoTextAllowed,
    maxBenefitBadges: p.maxBenefitBadges,
    sourceLevel: p.sourceLevel,
    needsVerification: p.needsVerification,
    infographicAllowed: p.infographicAllowed,
    lifestyleAllowed: p.lifestyleAllowed,
  };
}

/** Раньше — 13 профилей маркетплейсов; card_builder переведён на universal. */
export const PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS: ProductCardMarketplaceProfile[] = [];

export function profileByMarketplaceId(
  id: string,
): ProductCardMarketplaceProfile | undefined {
  return PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS.find((p) => p.id === id);
}
