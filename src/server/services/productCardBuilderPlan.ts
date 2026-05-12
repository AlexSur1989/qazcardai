import type { ProductCategoryId } from "@/config/product-card-categories";
import {
  CARD_BUILDER_GOALS,
  CARD_BUILDER_GALLERY_6_ROLES,
  CARD_BUILDER_GALLERY_8_ROLES,
  type CardBuilderGoalId,
  type CardBuilderImageRole,
} from "@/config/card-builder-presets";

export type CardBuilderRecommendedTextMode = "none" | "title_only" | "medium" | "heavy" | "infographic";

export type CardBuilderSlidePlan = {
  slideId: string;
  title: string;
  purpose: string;
  imageRole: CardBuilderImageRole;
  recommendedTextMode: CardBuilderRecommendedTextMode;
  promptIntent: string;
  sourceImageMode: "original";
};

const SLIDE_BLUEPRINT: Record<
  Exclude<CardBuilderImageRole, "gallery_6" | "gallery_8">,
  { title: string; purpose: string; promptIntent: string; fallbackTextMode: CardBuilderRecommendedTextMode }
> = {
  main_photo: {
    title: "Главное фото",
    purpose: "Показать товар на спокойном фоне, как для витрины",
    promptIntent: "clean catalog hero image",
    fallbackTextMode: "none",
  },
  benefits_infographic: {
    title: "Преимущества",
    purpose: "Собрать 3 ключевых УТП в ясную подачу",
    promptIntent: "benefits infographic tiles",
    fallbackTextMode: "medium",
  },
  materials: {
    title: "Материалы",
    purpose: "Показать фактуру, состав и качество материала",
    promptIntent: "materials-focused product detail",
    fallbackTextMode: "medium",
  },
  dimensions: {
    title: "Размеры",
    purpose: "Передать габариты и масштаб без искажений товара",
    promptIntent: "dimensions and scale infographic",
    fallbackTextMode: "medium",
  },
  lifestyle: {
    title: "Lifestyle",
    purpose: "Показать товар естественно в использовании",
    promptIntent: "lifestyle contextual scene",
    fallbackTextMode: "title_only",
  },
  detail_closeup: {
    title: "Детали",
    purpose: "Крупным планом подчеркнуть швы, текстуру, фурнитуру",
    promptIntent: "detail macro close-up",
    fallbackTextMode: "title_only",
  },
  packaging: {
    title: "Упаковка / комплект",
    purpose: "Показать комплектацию и упаковку премиально",
    promptIntent: "premium packaging showcase",
    fallbackTextMode: "medium",
  },
  premium_poster: {
    title: "Постер",
    purpose: "Сильная рекламная подача, готовность к промо-баннеру",
    promptIntent: "premium advertising poster composition",
    fallbackTextMode: "heavy",
  },
  ad_banner: {
    title: "Рекламный баннер",
    purpose: "Широкоформатный рекламный кадр с акцентом на оффер",
    promptIntent: "wide ecommerce ad banner hero",
    fallbackTextMode: "heavy",
  },
};

function coerceTextMode(
  globalDensity: CardBuilderRecommendedTextMode,
  role: Exclude<CardBuilderImageRole, "gallery_6" | "gallery_8">,
): CardBuilderRecommendedTextMode {
  if (globalDensity === "none") return "none";
  const fb = SLIDE_BLUEPRINT[role].fallbackTextMode;
  const order = ["none", "title_only", "medium", "heavy", "infographic"] as const;
  const gi = order.indexOf(globalDensity);
  const bi = order.indexOf(fb);
  if (gi < 0 || bi < 0) return fb;
  return order[Math.max(gi, bi)];
}

function slideFromRole(
  role: Exclude<CardBuilderImageRole, "gallery_6" | "gallery_8">,
  index: number,
  textDensity: CardBuilderRecommendedTextMode,
): CardBuilderSlidePlan {
  const b = SLIDE_BLUEPRINT[role];
  return {
    slideId: `${String(index).padStart(2, "0")}_${role}`,
    title: b.title,
    purpose: b.purpose,
    imageRole: role,
    recommendedTextMode: coerceTextMode(textDensity, role),
    promptIntent: b.promptIntent,
    sourceImageMode: "original",
  };
}

export type CardBuilderPlanInput = {
  selectedCategory: ProductCategoryId;
  marketplace: string;
  goal: CardBuilderGoalId;
  preserveProduct: boolean;
  preserveAspects: readonly string[];
  allowCreativeStyle: boolean;
  benefitsTags: readonly string[];
  benefitsExtra?: string;
  mustShow: readonly string[];
  audience?: string | null;
  priceSegment?: string | null;
  salesStyle: string;
  textDensity: CardBuilderRecommendedTextMode;
};

/**
 * Эвристика (rule-based): на первом этапе без LLM-планировщика.
 * Категория пробрасывается для будущих правил порядка/акцентов.
 */
export function buildCardBuilderGalleryPlan(input: CardBuilderPlanInput): {
  slides: CardBuilderSlidePlan[];
  /** На будущее: сегменты маркетплейса могут переупорядочивать блоки */
  categoryHint?: ProductCategoryId;
} {
  void input.marketplace;
  void input.allowCreativeStyle;
  void input.preserveAspects;
  void input.benefitsExtra;
  void input.mustShow;
  void input.audience;
  void input.priceSegment;
  void input.benefitsTags;
  void input.preserveProduct;
  void input.salesStyle;
  const textDensity = input.textDensity;

  let roles: Exclude<CardBuilderImageRole, "gallery_6" | "gallery_8">[] = [];

  if (input.goal === "full_gallery_6") {
    roles = [...CARD_BUILDER_GALLERY_6_ROLES] as Exclude<
      CardBuilderImageRole,
      "gallery_6" | "gallery_8"
    >[];
  } else if (input.goal === "full_gallery_8") {
    roles = [...CARD_BUILDER_GALLERY_8_ROLES] as Exclude<
      CardBuilderImageRole,
      "gallery_6" | "gallery_8"
    >[];
  } else {
    const g = CARD_BUILDER_GOALS.find((x) => x.id === input.goal);
    const r = g?.imageRole;
    if (r && r !== "gallery_6" && r !== "gallery_8") {
      roles = [r];
    } else {
      roles = ["main_photo"];
    }
  }

  const slides = roles.map((role, i) => slideFromRole(role, i + 1, textDensity));

  return { slides, categoryHint: input.selectedCategory };
}
