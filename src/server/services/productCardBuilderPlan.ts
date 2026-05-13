import {
  defaultTemplateForSlideRole,
  getCardBuilderTemplate,
  pickGalleryTemplateSequence,
  type CardBuilderTemplateSlideRole,
} from "@/config/card-builder-templates";
import { getPublicProductCategories } from "@/config/product-card-categories";

export type CardBuilderSlideRole = CardBuilderTemplateSlideRole;

export type CardBuilderGallerySlide = {
  slideId: string;
  title: string;
  purpose: string;
  /** Короткое описание для пользователя в превью */
  previewCaption: string;
  imageRole: CardBuilderSlideRole;
  templateId: string;
  templateLabel: string;
  layoutPreset: string;
  overlayRequired: boolean;
  textSlots: string[];
  iconSlots: string[];
  sourceImageMode: "original" | "variant";
  recommendedTextMode: "none" | "minimal" | "medium" | "heavy" | "infographic";
  promptIntent: string;
  overlayTexts?: Record<string, string>;
  overlayBenefitIcons?: string[];
  needsMoreBenefits?: boolean;
};

export type CardBuilderPlanInput = {
  selectedCategory: string;
  marketplace: string;
  goal: string;
  preserveProduct: boolean;
  preserveAspects: string[];
  allowCreativeStylization?: boolean;
  benefits: string[];
  benefitsExtra?: string;
  subtitle?: string;
  dimensions?: string;
  languageMode?: string;
  mustShow: string[];
  audience: string;
  priceSegment: string;
  salesStyle: string;
  textDensity: string;
};

const BASE_SLIDES: Record<
  CardBuilderSlideRole,
  Omit<
    CardBuilderGallerySlide,
    | "slideId"
    | "previewCaption"
    | "templateId"
    | "templateLabel"
    | "layoutPreset"
    | "overlayRequired"
    | "textSlots"
    | "iconSlots"
    | "overlayTexts"
    | "overlayBenefitIcons"
    | "needsMoreBenefits"
  >
> = {
  main_photo: {
    title: "Главное фото",
    purpose: "Показать товар на чистом читаемом фоне как герой кадра",
    imageRole: "main_photo",
    recommendedTextMode: "none",
    promptIntent: "clean catalog hero image",
    sourceImageMode: "original",
  },
  benefits_infographic: {
    title: "Преимущества",
    purpose: "Визуально выделить ключевые УТП; текст задаётся серверным overlay",
    imageRole: "benefits_infographic",
    recommendedTextMode: "medium",
    promptIntent: "benefit-led selling layout without readable bitmap text",
    sourceImageMode: "original",
  },
  dimensions: {
    title: "Размеры",
    purpose: "Показать габариты и масштаб наглядно",
    imageRole: "dimensions",
    recommendedTextMode: "minimal",
    promptIntent: "scale and dimension readability",
    sourceImageMode: "original",
  },
  materials: {
    title: "Материалы",
    purpose: "Раскрыть фактуру и качество материала",
    imageRole: "materials",
    recommendedTextMode: "minimal",
    promptIntent: "material macro and tactile premium cues",
    sourceImageMode: "original",
  },
  lifestyle: {
    title: "Lifestyle",
    purpose: "Товар в естественном сценарии использования",
    imageRole: "lifestyle",
    recommendedTextMode: "minimal",
    promptIntent: "aspirational in-context lifestyle commerce",
    sourceImageMode: "original",
  },
  premium_poster: {
    title: "Постер",
    purpose: "Сильный рекламный кадр с премиальной подачёй",
    imageRole: "premium_poster",
    recommendedTextMode: "minimal",
    promptIntent: "premium retail poster hero",
    sourceImageMode: "original",
  },
  detail_closeup: {
    title: "Детали",
    purpose: "Крупный план якорной детали или фактуры",
    imageRole: "detail_closeup",
    recommendedTextMode: "none",
    promptIntent: "macro hero detail fidelity",
    sourceImageMode: "original",
  },
  packaging: {
    title: "Упаковка / комплект",
    purpose: "Комплектация и упаковка",
    imageRole: "packaging",
    recommendedTextMode: "minimal",
    promptIntent: "kit and packaging storytelling",
    sourceImageMode: "original",
  },
  ad_banner: {
    title: "Рекламный баннер",
    purpose: "Яркая рекламная подача с местом под текст overlay",
    imageRole: "ad_banner",
    recommendedTextMode: "minimal",
    promptIntent: "bold ecommerce banner framing",
    sourceImageMode: "original",
  },
};

function categoryLabelRu(categoryId: string): string {
  const cat = getPublicProductCategories().find((c) => c.id === categoryId);
  return cat?.label?.trim() || categoryId;
}

function pickTextMode(
  userMode: string,
  recommended: CardBuilderGallerySlide["recommendedTextMode"],
): CardBuilderGallerySlide["recommendedTextMode"] {
  const u = userMode.trim().toLowerCase();
  if (u === "none" || u === "minimal" || u === "medium" || u === "heavy" || u === "infographic") {
    return u;
  }
  return recommended;
}

function buildSlideFromTemplate(
  templateId: string,
  idx: number,
  input: CardBuilderPlanInput,
  categoryRu: string,
): CardBuilderGallerySlide | null {
  const def = getCardBuilderTemplate(templateId);
  if (!def) return null;
  const base = BASE_SLIDES[def.slideRole];
  const slideId = `${String(idx + 1).padStart(2, "0")}_${def.slideRole}`;
  const adaptedPurpose = `${base.purpose} (${categoryRu}).`;
  const tm = pickTextMode(input.textDensity, def.defaultTextDensity);

  return {
    slideId,
    title: base.title,
    purpose: adaptedPurpose,
    previewCaption: "",
    imageRole: def.slideRole,
    templateId: def.templateId,
    templateLabel: def.label,
    layoutPreset: def.layoutPreset,
    overlayRequired: def.overlayRequired,
    textSlots: [...def.textSlots],
    iconSlots: [...def.iconSlots],
    recommendedTextMode: tm,
    promptIntent: base.promptIntent,
    sourceImageMode: input.allowCreativeStylization ? "variant" : base.sourceImageMode,
  };
}

function maybeSwapPosterForBanner(templateIds: string[], input: CardBuilderPlanInput): string[] {
  if (input.marketplace !== "instagram_vk" && input.salesStyle !== "bold_ad") {
    return templateIds;
  }
  const copy = [...templateIds];
  const lastIdx = copy.length - 1;
  const lastId = copy[lastIdx];
  const lastTpl = lastId ? getCardBuilderTemplate(lastId) : undefined;
  if (lastTpl?.slideRole === "premium_poster") {
    copy[lastIdx] = "ad_banner";
  }
  return copy;
}

/** Rule-based галерея: категория → шаблоны слайдов; goal задаёт число кадров. */
export function buildCardBuilderGalleryPlan(input: CardBuilderPlanInput): {
  slides: CardBuilderGallerySlide[];
} {
  const catRu = categoryLabelRu(input.selectedCategory);

  let templateIds: string[];

  switch (input.goal) {
    case "full_gallery_8":
      templateIds = pickGalleryTemplateSequence(input.selectedCategory, 8);
      templateIds = maybeSwapPosterForBanner(templateIds, input);
      break;
    case "full_gallery_6":
      templateIds = pickGalleryTemplateSequence(input.selectedCategory, 6);
      templateIds = maybeSwapPosterForBanner(templateIds, input);
      break;
    case "main_photo":
      templateIds = [defaultTemplateForSlideRole("main_photo")];
      break;
    case "benefits_info":
      templateIds = [defaultTemplateForSlideRole("benefits_infographic")];
      break;
    case "dimensions_slide":
      templateIds = [defaultTemplateForSlideRole("dimensions")];
      break;
    case "materials_slide":
      templateIds = [defaultTemplateForSlideRole("materials")];
      break;
    case "lifestyle":
      templateIds = [defaultTemplateForSlideRole("lifestyle")];
      break;
    case "detail_closeup":
      templateIds = [defaultTemplateForSlideRole("detail_closeup")];
      break;
    case "packaging_kit":
      templateIds = [defaultTemplateForSlideRole("packaging")];
      break;
    case "premium_poster":
      templateIds = [defaultTemplateForSlideRole("premium_poster")];
      break;
    default:
      templateIds = [defaultTemplateForSlideRole("main_photo")];
  }

  const slides: CardBuilderGallerySlide[] = [];
  templateIds.forEach((tid, idx) => {
    const s = buildSlideFromTemplate(tid, idx, input, catRu);
    if (s) slides.push(s);
  });

  return { slides };
}
