import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
import type {
  AppliedMarketplaceRulesSnapshot,
  ProductCardMarketplaceProfile,
} from "@/config/product-card-marketplace-profiles";
import type { CardBuilderProductFact } from "@/lib/card-builder-product-facts";
import type { CardBuilderStyleReferencePlan } from "@/lib/card-builder-style-reference";
import {
  buildUniversalCardBuilderGalleryPlan,
} from "@/server/services/universalCardBuilderPlan";

export type CardBuilderSlideRole = CardBuilderTemplateSlideRole;

/** Одиночная цель мастера → роль первого кадра. */
export function cardBuilderGoalToSlideRole(goal: string): CardBuilderSlideRole | null {
  const m: Partial<Record<string, CardBuilderSlideRole>> = {
    main_photo: "main_photo",
    benefits_info: "benefits_infographic",
    dimensions_slide: "dimensions",
    materials_slide: "materials",
    lifestyle: "lifestyle",
    detail_closeup: "detail_closeup",
    packaging_kit: "packaging",
    premium_poster: "premium_poster",
  };
  return m[goal] ?? null;
}

export function marketplaceProfileAllowsGalleryRole(
  profile: ProductCardMarketplaceProfile,
  role: CardBuilderSlideRole,
): boolean {
  const allowed = profile.allowedSlideTypes as readonly string[];
  return allowed.includes(role);
}

export function cardBuilderProfileSlideErrorMessage(
  profile: ProductCardMarketplaceProfile,
  role: CardBuilderSlideRole,
): string | null {
  if (!marketplaceProfileAllowsGalleryRole(profile, role)) {
    return `Тип слайда недоступен для профиля «${profile.label}».`;
  }
  if (role === "benefits_infographic") {
    const cap = Math.min(profile.maxBenefitBadges, profile.infographicRules.maxBenefitBadges);
    if (!profile.infographicAllowed || cap <= 0) {
      return `Инфографика преимуществ недоступна для профиля «${profile.label}».`;
    }
  }
  if (role === "lifestyle" && !profile.lifestyleAllowed) {
    return `Lifestyle недоступен для профиля «${profile.label}».`;
  }
  return null;
}

export function marketplaceGoalDisallowedReason(
  profile: ProductCardMarketplaceProfile,
  goal: string,
): string | null {
  const role = cardBuilderGoalToSlideRole(goal);
  if (!role) return null;
  return cardBuilderProfileSlideErrorMessage(profile, role);
}

export type CardBuilderGallerySlide = {
  slideId: string;
  title: string;
  purpose: string;
  previewCaption: string;
  imageRole: CardBuilderSlideRole;
  templateId: string;
  templateLabel: string;
  layoutPreset: string;
  overlayRequired: boolean;
  textRenderMode?: "ai_text_in_design";
  marketplaceProfileId?: string;
  textSlots: string[];
  iconSlots: string[];
  sourceImageMode: "original" | "variant";
  recommendedTextMode: "none" | "minimal" | "medium" | "heavy" | "infographic";
  promptIntent: string;
};

export type CardBuilderPlanInput = {
  selectedCategory: string;
  marketplace: string;
  goal: string;
  preserveProduct: boolean;
  preserveAspects: string[];
  allowCreativeStylization?: boolean;
  languageMode?: string;
  audience: string;
  priceSegment: string;
  salesStyle: string;
  textDensity: string;
  marketplaceProfileId?: string;
  marketplaceProfileVersion?: string;
  appliedMarketplaceRules?: AppliedMarketplaceRulesSnapshot;
  cardBuilderTargetAspectRatio?: string;
  cardBuilderTargetSize?: string;
  styleReference?: CardBuilderStyleReferencePlan;
  targetPlatform?: string;
  cardBuilderCategoryKey?: string;
  creationMode?: "single" | "full_gallery";
  singleCardType?: string;
  visualStyle?: string;
  productType?: string;
  productNameGuess?: string;
  categoryManuallyOverridden?: boolean;
  productFacts?: CardBuilderProductFact[];
  visionAnalysis?: Record<string, unknown>;
  gallerySlideCount?: 6 | 8;
};

/** Сборка плана галереи (универсальный card_builder). */
export function buildCardBuilderGalleryPlan(
  input: CardBuilderPlanInput,
  profile: ProductCardMarketplaceProfile,
): { slides: CardBuilderGallerySlide[]; planWarning?: string } {
  return buildUniversalCardBuilderGalleryPlan(input, profile);
}
