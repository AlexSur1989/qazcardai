export type CardBuilderSlideRole =
  | "main_photo"
  | "benefits_infographic"
  | "dimensions"
  | "materials"
  | "lifestyle"
  | "detail_closeup"
  | "packaging"
  | "premium_poster"
  | "ad_banner";

export type CardBuilderGallerySlide = {
  slideId: string;
  title: string;
  purpose: string;
  imageRole: CardBuilderSlideRole;
  recommendedTextMode: "none" | "minimal" | "medium" | "heavy" | "infographic";
  promptIntent: string;
  sourceImageMode: "original" | "variant";
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
  mustShow: string[];
  audience: string;
  priceSegment: string;
  salesStyle: string;
  textDensity: string;
};

const BASE_SLIDES: Record<
  CardBuilderSlideRole,
  Omit<CardBuilderGallerySlide, "slideId">
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
    purpose: "Визуально выделить 2–4 ключевых УТП в продающей композиции",
    imageRole: "benefits_infographic",
    recommendedTextMode: "medium",
    promptIntent: "benefit-led selling layout without readable bitmap text",
    sourceImageMode: "original",
  },
  dimensions: {
    title: "Размеры",
    purpose: "Показать габариты и масштаб товара наглядно",
    imageRole: "dimensions",
    recommendedTextMode: "minimal",
    promptIntent: "scale and dimension readability",
    sourceImageMode: "original",
  },
  materials: {
    title: "Материалы",
    purpose: "Раскрыть фактуру, материал и качество изготовления",
    imageRole: "materials",
    recommendedTextMode: "minimal",
    promptIntent: "material macro and tactile premium cues",
    sourceImageMode: "original",
  },
  lifestyle: {
    title: "Lifestyle",
    purpose: "Показать товар в естественном сценарии использования",
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
    purpose: "Показать комплектацию, упаковку и содержимое",
    imageRole: "packaging",
    recommendedTextMode: "minimal",
    promptIntent: "kit and packaging storytelling",
    sourceImageMode: "original",
  },
  ad_banner: {
    title: "Рекламный баннер",
    purpose: "Яркая рекламная подача с чистым негативным пространством под оверлей",
    imageRole: "ad_banner",
    recommendedTextMode: "minimal",
    promptIntent: "bold ecommerce banner framing",
    sourceImageMode: "original",
  },
};

function withCategoryHint(
  category: string,
  slide: Omit<CardBuilderGallerySlide, "slideId">,
): Omit<CardBuilderGallerySlide, "slideId"> {
  const hint = category.trim().toLowerCase();
  return {
    ...slide,
    purpose:
      `${slide.purpose} (category context: ${hint || "general"}; keep true product identity).`,
  };
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

/** Rule-based галерея: зависимость от goal и категории (без LLM-планировщика). */
export function buildCardBuilderGalleryPlan(input: CardBuilderPlanInput): {
  slides: CardBuilderGallerySlide[];
} {
  let roles: CardBuilderSlideRole[];

  switch (input.goal) {
    case "main_photo":
      roles = ["main_photo"];
      break;
    case "benefits_info":
      roles = ["benefits_infographic"];
      break;
    case "dimensions_slide":
      roles = ["dimensions"];
      break;
    case "materials_slide":
      roles = ["materials"];
      break;
    case "lifestyle":
      roles = ["lifestyle"];
      break;
    case "detail_closeup":
      roles = ["detail_closeup"];
      break;
    case "packaging_kit":
      roles = ["packaging"];
      break;
    case "premium_poster":
      roles = ["premium_poster"];
      break;
    case "full_gallery_8":
      roles = [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "detail_closeup",
        "packaging",
        "premium_poster",
      ];
      break;
    case "full_gallery_6":
      roles = [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "premium_poster",
      ];
      break;
    default:
      roles = ["main_photo"];
      break;
  }

  if (input.marketplace === "instagram_vk" || input.salesStyle === "bold_ad") {
    roles = roles.map((r) =>
      r === "premium_poster" && input.goal.startsWith("full_gallery") ? "ad_banner" : r,
    );
  }

  const slides: CardBuilderGallerySlide[] = roles.map((role, idx) => {
    const base = BASE_SLIDES[role];
    const adapted = withCategoryHint(input.selectedCategory, base);
    const slideId = `${String(idx + 1).padStart(2, "0")}_${role}`;
    return {
      slideId,
      ...adapted,
      recommendedTextMode: pickTextMode(input.textDensity, adapted.recommendedTextMode),
      sourceImageMode:
        input.allowCreativeStylization ? "variant" : adapted.sourceImageMode,
    };
  });

  return { slides };
}
