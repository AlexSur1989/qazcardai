import type { ProductCategoryId } from "@/config/product-card-categories";

/** Категории для ручного выбора, когда PRODUCT_CLASSIFIER ещё не подключён. */
export const MANUAL_PRODUCT_CATEGORY_OPTIONS = [
  { id: "electronics", label: "Электроника" },
  { id: "home_appliances", label: "Бытовая техника" },
  { id: "apparel", label: "Одежда" },
  { id: "footwear", label: "Обувь" },
  { id: "beauty_and_care", label: "Косметика" },
  { id: "home_goods", label: "Товары для дома" },
  { id: "kids", label: "Детские товары" },
  { id: "accessories", label: "Аксессуары" },
  { id: "furniture", label: "Мебель" },
  { id: "auto", label: "Авто" },
  { id: "universal", label: "Универсальная категория" },
] as const satisfies ReadonlyArray<{ id: ProductCategoryId; label: string }>;

export type ManualProductCategoryId =
  (typeof MANUAL_PRODUCT_CATEGORY_OPTIONS)[number]["id"];

export function getManualProductCategoryLabel(
  id: string | null | undefined,
): string | null {
  if (!id?.trim()) return null;
  const row = MANUAL_PRODUCT_CATEGORY_OPTIONS.find((o) => o.id === id);
  if (row) return row.label;
  return null;
}
