import {
  CARD_BUILDER_BENEFIT_TAGS,
  CARD_BUILDER_MUST_SHOW,
} from "@/config/card-builder-config";
import {
  CARD_BUILDER_BENEFIT_TAG_ICON,
} from "@/config/card-builder-benefit-icons";
import {
  cardBuilderSlideUserPreviewCaption,
  getCardBuilderTemplate,
  type CardBuilderTemplateSlideRole,
} from "@/config/card-builder-templates";
import { getPublicProductCategories } from "@/config/product-card-categories";
import {
  effectiveDimensionsForOverlay,
  slideCategoryFactsForRole,
  type CardBuilderPlanWithCategoryFields,
} from "@/lib/card-builder-category-fields-runtime";
import type { CardBuilderGallerySlide, CardBuilderPlanInput } from "@/server/services/productCardBuilderPlan";

export type BuildCardBuilderTextSlotsInput = {
  productTitle: string | null | undefined;
  subtitle?: string | null;
  benefitTagIds: string[];
  additionalBenefits?: string | null;
  mustShowTagIds: string[];
  dimensions?: string | null;
  characteristics?: string | null;
  categoryId: string;
  marketplace: string;
  slideRole: CardBuilderTemplateSlideRole;
  templateId: string;
  /** Опционально: поля категории из мастера (metadata / план). */
  categoryFields?: CardBuilderPlanInput["categoryFields"];
  categoryFieldsByCategory?: CardBuilderPlanInput["categoryFieldsByCategory"];
};

function categoryLabelRu(categoryId: string): string {
  const cat = getPublicProductCategories().find((c) => c.id === categoryId);
  return cat?.label?.trim() || categoryId;
}

function benefitLabelsOrdered(tagIds: string[], max: number): { labels: string[]; icons: string[] } {
  const labels: string[] = [];
  const icons: string[] = [];
  for (const id of tagIds) {
    if (labels.length >= max) break;
    const row = CARD_BUILDER_BENEFIT_TAGS.find((b) => b.id === id);
    if (!row) continue;
    labels.push(row.label);
    icons.push(CARD_BUILDER_BENEFIT_TAG_ICON[id] ?? "check");
  }
  return { labels, icons };
}

export function buildCardBuilderTextSlots(input: BuildCardBuilderTextSlotsInput): {
  slots: Record<string, string>;
  benefitIcons: string[];
  needsMoreBenefits: boolean;
} {
  const tpl = getCardBuilderTemplate(input.templateId);
  const slots: Record<string, string> = {};
  const title =
    input.productTitle?.trim() ||
    `Товар · ${categoryLabelRu(input.categoryId)}`;
  slots.title = title;

  const subtitleParts: string[] = [];
  if (input.subtitle?.trim()) subtitleParts.push(input.subtitle.trim());
  if (input.mustShowTagIds.length) {
    const bits = input.mustShowTagIds
      .map((id) => CARD_BUILDER_MUST_SHOW.find((m) => m.id === id)?.label)
      .filter(Boolean) as string[];
    if (bits.length) subtitleParts.push(`Акценты: ${bits.join(", ")}`);
  }
  slots.subtitle = subtitleParts.join(" · ");

  const maxBen = tpl?.maxBenefits ?? 0;
  const { labels, icons } = benefitLabelsOrdered(input.benefitTagIds, maxBen);

  const needsMoreBenefits = false;

  const catPlan: CardBuilderPlanWithCategoryFields = {
    selectedCategory: input.categoryId,
    dimensions: input.dimensions ?? undefined,
    categoryFields: input.categoryFields,
    categoryFieldsByCategory: input.categoryFieldsByCategory,
  };
  const dimLine = effectiveDimensionsForOverlay(catPlan);
  const slideFacts = slideCategoryFactsForRole(input.slideRole, catPlan, input.templateId);

  for (let i = 0; i < maxBen; i++) {
    const key = `benefit_${i + 1}`;
    slots[key] = labels[i]?.trim() ?? "";
  }

  if (dimLine && (tpl?.textSlots ?? []).includes("size_line")) {
    slots.size_line = dimLine.slice(0, 220);
  } else if (input.dimensions?.trim()) {
    slots.size_line = input.dimensions.trim();
  } else if ((tpl?.textSlots ?? []).includes("size_line")) {
    slots.size_line = "";
  }

  const extra = input.additionalBenefits?.trim() ?? "";
  slots.extraText = extra.slice(0, 420);

  if (
    input.slideRole === "dimensions" &&
    (tpl?.textSlots ?? []).includes("size_line") &&
    !slots.size_line?.trim()
  ) {
    const measureVal =
      slideFacts.sizeOrVolume ??
      slideFacts.volumeWeight ??
      slideFacts.volume ??
      slideFacts.size ??
      slideFacts.dimensions ??
      slideFacts.sizeRange;
    if (measureVal?.trim()) slots.size_line = measureVal.trim().slice(0, 220);
  }

  const chars = input.characteristics?.trim();
  slots.statsText = chars ? chars.slice(0, 220) : "";

  return {
    slots,
    benefitIcons: icons.slice(0, maxBen),
    needsMoreBenefits,
  };
}

export function enrichCardBuilderGallerySlides(
  slides: CardBuilderGallerySlide[],
  input: CardBuilderPlanInput,
  productTitle: string | null | undefined,
): CardBuilderGallerySlide[] {
  return slides.map((slide) => {
    const tpl = getCardBuilderTemplate(slide.templateId);
    if (!tpl) return slide;

    const pack = buildCardBuilderTextSlots({
      productTitle,
      subtitle: input.subtitle,
      benefitTagIds: input.benefits ?? [],
      additionalBenefits: input.benefitsExtra,
      mustShowTagIds: input.mustShow ?? [],
      dimensions: input.dimensions ?? null,
      characteristics: input.benefitsExtra ?? null,
      categoryId: input.selectedCategory,
      marketplace: input.marketplace,
      slideRole: tpl.slideRole,
      templateId: slide.templateId,
      categoryFields: input.categoryFields,
      categoryFieldsByCategory: input.categoryFieldsByCategory,
    });

    return {
      ...slide,
      overlayTexts: pack.slots,
      overlayBenefitIcons: pack.benefitIcons,
      needsMoreBenefits: pack.needsMoreBenefits,
      previewCaption: cardBuilderSlideUserPreviewCaption(slide.templateId, tpl.slideRole),
    };
  });
}

export function enrichSingleSlideAfterTemplateChange(
  slide: CardBuilderGallerySlide,
  input: CardBuilderPlanInput,
  productTitle: string | null | undefined,
): CardBuilderGallerySlide {
  const tpl = getCardBuilderTemplate(slide.templateId);
  if (!tpl) return slide;
  const pack = buildCardBuilderTextSlots({
    productTitle,
    subtitle: input.subtitle,
    benefitTagIds: input.benefits ?? [],
    additionalBenefits: input.benefitsExtra,
    mustShowTagIds: input.mustShow ?? [],
    dimensions: input.dimensions ?? null,
    characteristics: input.benefitsExtra ?? null,
    categoryId: input.selectedCategory,
    marketplace: input.marketplace,
    slideRole: tpl.slideRole,
    templateId: slide.templateId,
    categoryFields: input.categoryFields,
    categoryFieldsByCategory: input.categoryFieldsByCategory,
  });
  return {
    ...slide,
    templateLabel: tpl.label,
    layoutPreset: tpl.layoutPreset,
    overlayRequired: false,
    textSlots: [...tpl.textSlots],
    iconSlots: [...tpl.iconSlots],
    recommendedTextMode: slide.recommendedTextMode,
    overlayTexts: pack.slots,
    overlayBenefitIcons: pack.benefitIcons,
    needsMoreBenefits: pack.needsMoreBenefits,
    previewCaption: cardBuilderSlideUserPreviewCaption(slide.templateId, tpl.slideRole),
  };
}