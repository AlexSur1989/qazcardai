/**
 * Единственный источник базовых последовательностей шаблонов для полной галереи card_builder.
 * Ранее дублировалось с pickGalleryTemplateSequence в card-builder-templates.ts — теперь только здесь.
 */

import type { ProductCategoryId } from "@/config/product-card-categories";

export type PlannerBucket =
  | "furniture"
  | "apparel_clothing"
  | "footwear"
  | "jewelry_accessories"
  | "beauty"
  | "gadgets"
  | "food"
  | "universal";

export type GallerySequenceInput = {
  selectedCategory: string;
  subtitle?: string;
  benefitsExtra?: string;
  additionalBenefits?: string;
  /** Эвристики плана: текст из categoryFields клиента (только переданное). */
  categoryFieldsPlain?: string;
  /** Вторичный модификатор под референс стиля (без анализа пикселей). */
  styleReference?: {
    enabled: true;
    strength: "low" | "medium" | "high";
    referenceCount: number;
    useComposition: boolean;
    useBackground: boolean;
    useColors: boolean;
    useTypography: boolean;
    useBadges: boolean;
    useIcons: boolean;
    useMood: boolean;
    useOverallPresentation: boolean;
  };
};

function inferFootwearFromClientText(input: GallerySequenceInput): boolean {
  const t =
    `${input.subtitle ?? ""} ${input.benefitsExtra ?? ""} ${input.additionalBenefits ?? ""} ${input.categoryFieldsPlain ?? ""}`.trim();
  if (!t) return false;
  const re =
    /\b(?:обувь|ботинк|туфл|лоферы|босоножк|сапог|бутс|sandals|sneakers|boots)\b/ui;
  return re.test(t);
}

export function inferIngredientClaimsFromClientText(input: GallerySequenceInput): boolean {
  const plain = input.categoryFieldsPlain?.trim() ?? "";
  const t =
    `${input.subtitle ?? ""} ${input.benefitsExtra ?? ""} ${input.additionalBenefits ?? ""} ${plain}`.trim();
  if (!t) return false;

  const cat = input.selectedCategory.trim();
  if (cat === "food_and_drinks" && plain && /\b(?:вкус|состав|ингредиент|ингредиенты)\b/ui.test(plain)) {
    return true;
  }
  if (cat === "beauty_and_care" && plain && /\b(?:актив|эффект|состав)\b/ui.test(plain)) {
    return true;
  }

  return /ингредиент|состав|актив\b|formula|spf|спф|extract|экстракт/ui.test(t);
}

export function inferPlannerBucket(input: GallerySequenceInput): PlannerBucket {
  const cat = input.selectedCategory.trim();
  if (cat === "home_and_furniture") return "furniture";
  if (cat === "accessories") return "jewelry_accessories";
  if (cat === "beauty_and_care") return "beauty";
  if (cat === "gadgets_and_tech") return "gadgets";
  if (cat === "food_and_drinks") return "food";
  if (cat === "apparel") return inferFootwearFromClientText(input) ? "footwear" : "apparel_clothing";
  return "universal";
}

/** Базовая последовательность из 6 templateId до фильтров маркетплейса / replace dimensions. */
export function buildGallerySixTemplateIds(input: GallerySequenceInput): string[] {
  const bucket = inferPlannerBucket(input);
  switch (bucket) {
    case "furniture":
      return [
        "hero_clean",
        "interior_lifestyle",
        "material_focus",
        "dimensions_schema",
        "benefits_grid",
        "premium_poster",
      ];
    case "apparel_clothing":
      return [
        "hero_clean",
        "lifestyle_card",
        "material_focus",
        "size_range",
        "fabric_closeup",
        "premium_poster",
      ];
    case "footwear":
      return [
        "hero_clean",
        "lifestyle_card",
        "material_focus",
        "protection_features",
        "texture_closeup",
        "premium_poster",
      ];
    case "beauty":
      return inferIngredientClaimsFromClientText(input)
        ? [
            "hero_clean",
            "texture_closeup",
            "benefits_grid",
            "ingredients_effect",
            "lifestyle_card",
            "premium_poster",
          ]
        : [
            "hero_clean",
            "texture_closeup",
            "benefits_grid",
            "material_focus",
            "lifestyle_card",
            "premium_poster",
          ];
    case "gadgets":
      return [
        "hero_clean",
        "feature_callouts",
        "interface_detail",
        "size_scale",
        "lifestyle_card",
        "ad_banner",
      ];
    case "food":
      return [
        "hero_clean",
        "package_card",
        "ingredients_effect",
        "benefits_grid",
        "lifestyle_card",
        "premium_poster",
      ];
    case "jewelry_accessories":
      return [
        "hero_clean",
        "premium_poster",
        "texture_closeup",
        "material_focus",
        "lifestyle_card",
        "package_card",
      ];
    default:
      return [
        "hero_clean",
        "benefits_grid",
        "material_focus",
        "dimensions_schema",
        "lifestyle_card",
        "premium_poster",
      ];
  }
}

const GADGETS_EIGHT: readonly string[] = [
  "hero_clean",
  "feature_callouts",
  "interface_detail",
  "size_scale",
  "benefits_grid",
  "lifestyle_card",
  "comparison_card",
  "ad_banner",
];

/** 6 или 8 кадров: восьмой набор для гаджетов отдельно, иначе six + два слота. */
export function pickGalleryTemplateSequenceForPlan(
  input: GallerySequenceInput,
  slideCount: 6 | 8,
): string[] {
  const six = buildGallerySixTemplateIds(input);
  if (slideCount === 6) return six;
  if (inferPlannerBucket(input) === "gadgets") {
    return [...GADGETS_EIGHT];
  }
  return [...six, "texture_closeup", "package_card"];
}

/** Совместимость со старым API (только categoryId, без текста обуви). */
export function pickGalleryTemplateSequence(
  categoryId: string,
  slideCount: 6 | 8,
): string[] {
  return pickGalleryTemplateSequenceForPlan({ selectedCategory: categoryId }, slideCount);
}

export function isProductCategoryId(id: string): id is ProductCategoryId {
  return (
    id === "apparel" ||
    id === "accessories" ||
    id === "food_and_drinks" ||
    id === "beauty_and_care" ||
    id === "gadgets_and_tech" ||
    id === "home_and_furniture" ||
    id === "other"
  );
}
