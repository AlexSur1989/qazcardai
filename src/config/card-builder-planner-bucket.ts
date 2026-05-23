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
  productType?: string;
};

function inferFootwearFromProductType(productType?: string): boolean {
  const t = productType?.trim() ?? "";
  if (!t) return false;
  const re =
    /\b(?:обувь|ботинк|туфл|лоферы|босоножк|сапог|бутс|sandals|sneakers|boots)\b/ui;
  return re.test(t);
}

export function inferPlannerBucket(input: GallerySequenceInput): PlannerBucket {
  const cat = input.selectedCategory.trim() as ProductCategoryId | string;
  if (cat === "home_and_furniture") return "furniture";
  if (cat === "accessories") return "jewelry_accessories";
  if (cat === "beauty_and_care") return "beauty";
  if (cat === "gadgets_and_tech") return "gadgets";
  if (cat === "food_and_drinks") return "food";
  if (cat === "apparel") {
    return inferFootwearFromProductType(input.productType) ? "footwear" : "apparel_clothing";
  }
  return "universal";
}
