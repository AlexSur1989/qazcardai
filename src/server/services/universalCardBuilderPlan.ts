import type { ProductCardMarketplaceProfile } from "@/config/product-card-marketplace-profiles";
import { isUniversalCardBuilderTarget } from "@/config/universal-card-builder-profile";
import { getCardBuilderTemplate } from "@/config/card-builder-templates";
import {
  buildUniversalGalleryTemplateIds,
  effectiveUniversalCategoryKey,
  mapUniversalCategoryToPlannerCategory,
  resolveSingleCardTemplate,
} from "@/lib/card-builder-universal-planner";
import {
  hasDimensionProductFacts,
  normalizeProductFactsList,
  type CardBuilderProductFact,
} from "@/lib/card-builder-product-facts";
import type {
  CardBuilderGallerySlide,
  CardBuilderPlanInput,
} from "@/server/services/productCardBuilderPlan";

type VisionSnapshot = {
  categoryKey?: string;
};

export function normalizeUniversalCardBuilderPlanInput(
  input: CardBuilderPlanInput,
): CardBuilderPlanInput {
  const facts = normalizeProductFactsList(input.productFacts);
  const vision = input.visionAnalysis as VisionSnapshot | undefined;
  const categoryKeyRaw = input.cardBuilderCategoryKey ?? "auto";
  const effectiveCategoryKey = effectiveUniversalCategoryKey(
    categoryKeyRaw,
    vision?.categoryKey,
    input.categoryManuallyOverridden,
  );
  const plannerCategory = mapUniversalCategoryToPlannerCategory(effectiveCategoryKey);

  let goal = input.goal;
  if (input.creationMode === "single") {
    const singleType = input.singleCardType ?? "auto";
    if (singleType === "auto") {
      const resolved = resolveSingleCardTemplate("auto", facts);
      goal = slideRoleToGoal(resolved.slideRole);
    } else {
      goal = singleCardTypeToGoal(singleType);
    }
  } else if (input.creationMode === "full_gallery") {
    goal = input.gallerySlideCount === 8 ? "full_gallery_8" : "full_gallery_6";
  }

  return {
    ...input,
    targetPlatform: input.targetPlatform ?? "universal",
    cardBuilderCategoryKey: effectiveCategoryKey,
    selectedCategory: plannerCategory,
    productFacts: facts,
    preserveProduct: input.preserveProduct ?? true,
    preserveAspects:
      input.preserveAspects?.length > 0
        ? input.preserveAspects
        : ["shape", "color", "logo", "proportions"],
    allowCreativeStylization: input.allowCreativeStylization ?? false,
    goal,
  };
}

function singleCardTypeToGoal(singleCardType: string): string {
  const map: Record<string, string> = {
    main_photo: "main_photo",
    benefits_infographic: "benefits_info",
    benefits_card: "benefits_info",
    comparison: "benefits_info",
    dimensions: "dimensions_slide",
    packaging: "packaging_kit",
    instruction: "usage_instruction",
    specs_card: "specs_card",
    social_proof: "social_proof",
    offer_card: "ad_banner",
    before_after: "before_after",
    premium_poster: "premium_poster",
    lifestyle: "lifestyle",
    detail_closeup: "detail_closeup",
    materials: "materials_slide",
    auto: "main_photo",
  };
  return map[singleCardType.trim()] ?? "main_photo";
}

function slideRoleToGoal(role: string): string {
  const map: Record<string, string> = {
    main_photo: "main_photo",
    benefits_infographic: "benefits_info",
    dimensions: "dimensions_slide",
    packaging: "packaging_kit",
    premium_poster: "premium_poster",
    lifestyle: "lifestyle",
    detail_closeup: "detail_closeup",
    materials: "materials_slide",
    ad_banner: "ad_banner",
    usage_instruction: "usage_instruction",
    specs_card: "specs_card",
    social_proof: "social_proof",
    before_after: "before_after",
  };
  return map[role] ?? "main_photo";
}

export function buildUniversalCardBuilderGalleryPlan(
  input: CardBuilderPlanInput,
  profile: ProductCardMarketplaceProfile,
): { slides: CardBuilderGallerySlide[]; planWarning?: string } {
  const normalized = normalizeUniversalCardBuilderPlanInput(input);
  const facts = normalized.productFacts ?? [];
  const categoryRu = normalized.cardBuilderCategoryKey ?? "other";

  let templateIds: string[] = [];
  let planWarning: string | undefined;

  if (normalized.creationMode === "single") {
    const singleType = normalized.singleCardType ?? "auto";
    const resolved = resolveSingleCardTemplate(singleType, facts);
    templateIds = [resolved.templateId];
    if (singleType === "dimensions" && !hasDimensionProductFacts(facts)) {
      planWarning =
        "Размеры не указаны — слайд покажет масштаб без точных цифр. Добавьте характеристики в данные товара.";
    }
    if (singleType === "offer_card" && !facts.some((f) => f.type === "promo" && f.value.trim())) {
      planWarning = "Добавьте акцию или скидку в поле «Акция / скидка» — иначе слайд не сгенерируется.";
    }
    if (singleType === "social_proof" && !facts.some((f) => f.type === "review" && f.value.trim())) {
      planWarning = "Добавьте отзыв или рейтинг — иначе слайд не сгенерируется.";
    }
  } else {
    const count = normalized.goal === "full_gallery_8" ? 8 : 6;
    templateIds = buildUniversalGalleryTemplateIds({
      categoryKey: categoryRu,
      productFacts: facts,
      galleryCount: count,
    });
    if (!hasDimensionProductFacts(facts)) {
      planWarning =
        "Размеры не указаны — в галерее вместо схемы с цифрами будет постер или детали.";
    }
  }

  const slides: CardBuilderGallerySlide[] = [];
  templateIds.forEach((tid, idx) => {
    const def = getCardBuilderTemplate(tid);
    if (!def) return;
    const slideId = `${String(idx + 1).padStart(2, "0")}_${def.slideRole}`;
    slides.push({
      slideId,
      title: def.label,
      purpose: "",
      previewCaption: "",
      imageRole: def.slideRole,
      templateId: def.templateId,
      templateLabel: def.label,
      layoutPreset: def.layoutPreset,
      overlayRequired: false,
      textSlots: [...def.textSlots],
      iconSlots: [...def.iconSlots],
      textRenderMode: "ai_text_in_design",
      marketplaceProfileId: profile.id,
      recommendedTextMode: def.defaultTextDensity ?? "medium",
      promptIntent: def.slideRole,
      sourceImageMode: "original",
    });
  });

  return planWarning ? { slides, planWarning } : { slides };
}

export function shouldUseUniversalCardBuilderPlan(input: CardBuilderPlanInput): boolean {
  return isUniversalCardBuilderTarget(input.targetPlatform);
}

export function productFactsFromPlan(input: CardBuilderPlanInput): CardBuilderProductFact[] {
  return normalizeProductFactsList(input.productFacts);
}
