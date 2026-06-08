/** Человекочитаемые подписи ролей Product Card в админке. */

export const PRODUCT_CARD_MODEL_TYPE_LABELS: Record<string, string> = {
  PRODUCT_CLASSIFIER: "Классификация товара",
  PRODUCT_CONCEPT_IMAGE: "Фото с концепциями",
  PRODUCT_MARKETPLACE_CARD: "Карточка товара",
  PRODUCT_VIDEO: "Видео товара",
};

export function labelProductCardModelType(
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return PRODUCT_CARD_MODEL_TYPE_LABELS[value] ?? value;
}

export function labelScopeUsage(
  scope: string,
  productCardModelType: string | null | undefined,
): string {
  if (scope === "PRODUCT_CARD") {
    return labelProductCardModelType(productCardModelType);
  }
  if (scope === "GENERAL") return "Каталог AI (admin/QA)";
  return scope;
}
