import {
  cardBuilderSlideUserPreviewCaption,
  getCardBuilderTemplate,
} from "@/config/card-builder-templates";
import type { CardBuilderGallerySlide, CardBuilderPlanInput } from "@/server/services/productCardBuilderPlan";

/** Только подпись предпросмотра слайда; overlay/benefits legacy удалены. */
export function enrichCardBuilderGallerySlides(
  slides: CardBuilderGallerySlide[],
  input: CardBuilderPlanInput,
  _productTitle: string | null | undefined,
): CardBuilderGallerySlide[] {
  void input;
  return slides.map((slide) => {
    const tpl = getCardBuilderTemplate(slide.templateId);
    if (!tpl) return slide;
    return {
      ...slide,
      previewCaption: cardBuilderSlideUserPreviewCaption(slide.templateId, tpl.slideRole),
    };
  });
}

export function enrichSingleSlideAfterTemplateChange(
  slide: CardBuilderGallerySlide,
  _input: CardBuilderPlanInput,
  _productTitle: string | null | undefined,
): CardBuilderGallerySlide {
  const tpl = getCardBuilderTemplate(slide.templateId);
  if (!tpl) return slide;
  return {
    ...slide,
    templateLabel: tpl.label,
    layoutPreset: tpl.layoutPreset,
    overlayRequired: false,
    textSlots: [...tpl.textSlots],
    iconSlots: [...tpl.iconSlots],
    recommendedTextMode: slide.recommendedTextMode,
    previewCaption: cardBuilderSlideUserPreviewCaption(slide.templateId, tpl.slideRole),
  };
}
