import type { ProductCategoryId } from "@/config/product-card-categories";
import type { CardBuilderUniversalCategoryId } from "@/config/card-builder-universal";
import { parseUniversalCategoryId } from "@/config/card-builder-universal";
import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
import {
  hasBenefitProductFacts,
  hasDimensionProductFacts,
  hasPackageProductFacts,
  hasPromoProductFacts,
  hasReviewProductFacts,
  hasSpecProductFacts,
  type CardBuilderProductFact,
  type CardBuilderProductFactType,
} from "@/lib/card-builder-product-facts";

/** Маппинг universal category → legacy planner category (concept/marketplace не трогаем). */
export function mapUniversalCategoryToPlannerCategory(
  categoryKey: string,
): ProductCategoryId {
  const id = parseUniversalCategoryId(categoryKey);
  switch (id) {
    case "clothing_shoes":
      return "apparel";
    case "beauty_care":
      return "beauty_and_care";
    case "home_interior":
      return "home_and_furniture";
    case "jewelry_accessories":
      return "accessories";
    case "food_drinks":
      return "food_and_drinks";
    case "gadgets_tech":
      return "gadgets_and_tech";
    case "kids_products":
    case "sport_fitness":
    case "auto_products":
    case "auto":
    case "other":
    default:
      return "other";
  }
}

export type UniversalGalleryBuildInput = {
  categoryKey: string;
  productFacts: readonly CardBuilderProductFact[];
  galleryCount: 6 | 8;
};

function hasVisibleFactTypes(
  facts: readonly CardBuilderProductFact[],
  types: readonly CardBuilderProductFactType[],
): boolean {
  return facts.some(
    (f) =>
      types.includes(f.type) &&
      f.visibleOnCard !== false &&
      f.value.trim().length > 0,
  );
}

/** Второй слайд галереи без benefit facts — без выдуманных преимуществ. */
export function pickAlternativeSecondGalleryTemplate(
  productFacts: readonly CardBuilderProductFact[],
): string {
  if (hasVisibleFactTypes(productFacts, ["detail", "feature"])) {
    return "texture_closeup";
  }
  if (hasVisibleFactTypes(productFacts, ["material"])) {
    return "material_focus";
  }
  if (hasVisibleFactTypes(productFacts, ["usage"])) {
    return "lifestyle_card";
  }
  return "premium_poster";
}

/** Убирает подряд идущие дубликаты templateId, подставляя безопасные альтернatives. */
export function dedupeGalleryTemplateSequence(templateIds: string[]): string[] {
  const fallbacks = ["feature_callouts", "texture_closeup", "material_focus", "lifestyle_card"];
  const out = [...templateIds];
  for (let i = 1; i < out.length; i++) {
    if (out[i] === out[i - 1]) {
      const alt = fallbacks.find((t) => t !== out[i] && !out.slice(0, i).includes(t));
      out[i] = alt ?? "feature_callouts";
    }
  }
  return out;
}

/** Универсальная последовательность templateId без marketplace-профиля. */
export function buildUniversalGalleryTemplateIds(input: UniversalGalleryBuildInput): string[] {
  const hasDims = hasDimensionProductFacts(input.productFacts);
  const hasPkg = hasPackageProductFacts(input.productFacts);
  const hasBenefits = hasBenefitProductFacts(input.productFacts);

  const slide2 = hasBenefits ? "benefits_grid" : pickAlternativeSecondGalleryTemplate(input.productFacts);
  const slide5 = hasDims ? "dimensions_schema" : "texture_closeup";
  let base6: string[] = [
    "hero_clean",
    slide2,
    "texture_closeup",
    "material_focus",
    slide5,
    "lifestyle_card",
  ];
  base6 = dedupeGalleryTemplateSequence(base6);

  if (input.galleryCount === 6) {
    return base6;
  }

  const slide7 = hasPkg
    ? "set_contents"
    : hasReviewProductFacts(input.productFacts)
      ? "social_proof_card"
      : "feature_callouts";
  const slide8 = hasPromoProductFacts(input.productFacts) ? "ad_banner" : "premium_poster";
  return dedupeGalleryTemplateSequence([...base6, slide7, slide8]);
}

const SINGLE_TYPE_TO_ROLE: Record<string, CardBuilderTemplateSlideRole> = {
  main_photo: "main_photo",
  benefits_infographic: "benefits_infographic",
  benefits_card: "benefits_infographic",
  comparison: "benefits_infographic",
  dimensions: "dimensions",
  packaging: "packaging",
  instruction: "usage_instruction",
  specs_card: "specs_card",
  social_proof: "social_proof",
  offer_card: "ad_banner",
  before_after: "before_after",
  premium_poster: "premium_poster",
  lifestyle: "lifestyle",
  detail_closeup: "detail_closeup",
  materials: "materials",
};

const SINGLE_TYPE_TO_TEMPLATE: Record<string, string> = {
  main_photo: "hero_clean",
  benefits_infographic: "benefits_grid",
  benefits_card: "benefits_left_column",
  comparison: "comparison_card",
  dimensions: "dimensions_schema",
  packaging: "set_contents",
  instruction: "instruction_steps",
  specs_card: "specs_card",
  social_proof: "social_proof_card",
  offer_card: "ad_banner",
  before_after: "before_after_card",
  premium_poster: "premium_poster",
  lifestyle: "lifestyle_card",
  detail_closeup: "texture_closeup",
  materials: "material_focus",
};

export function resolveSingleCardTemplate(
  singleCardType: string,
  productFacts: readonly CardBuilderProductFact[],
): { templateId: string; slideRole: CardBuilderTemplateSlideRole } {
  const t = singleCardType.trim() || "auto";
  if (t === "auto") {
    const facts = productFacts.filter((f) => f.visibleOnCard !== false);
    if (hasBenefitProductFacts(facts)) {
      return { templateId: "benefits_grid", slideRole: "benefits_infographic" };
    }
    if (hasDimensionProductFacts(facts)) {
      return { templateId: "dimensions_schema", slideRole: "dimensions" };
    }
    return { templateId: "hero_clean", slideRole: "main_photo" };
  }
  const role = SINGLE_TYPE_TO_ROLE[t] ?? "main_photo";
  let templateId = SINGLE_TYPE_TO_TEMPLATE[t] ?? "hero_clean";
  if (t === "dimensions" && !hasDimensionProductFacts(productFacts)) {
    templateId = "size_scale";
  }
  if (t === "specs_card" && !hasSpecProductFacts(productFacts)) {
    templateId = "feature_callouts";
  }
  return { templateId, slideRole: role };
}

export function effectiveUniversalCategoryKey(
  categoryKey: string,
  visionCategoryKey?: string | null,
  manuallyOverridden?: boolean,
): CardBuilderUniversalCategoryId {
  if (manuallyOverridden) {
    return parseUniversalCategoryId(categoryKey);
  }
  if (categoryKey.trim() && categoryKey.trim() !== "auto") {
    return parseUniversalCategoryId(categoryKey);
  }
  if (visionCategoryKey?.trim()) {
    return parseUniversalCategoryId(visionCategoryKey);
  }
  return "other";
}

