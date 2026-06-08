import type { ProductCategoryId } from "@/config/product-card-categories";
import { PRODUCT_CATEGORY_IDS } from "@/config/product-card-categories";
import { getProductCategoryById } from "@/config/product-card-categories";
import { getManualProductCategoryLabel, MANUAL_PRODUCT_CATEGORY_OPTIONS } from "@/config/product-card-manual-categories";

const MANUAL_CATEGORY_IDS = new Set(
  MANUAL_PRODUCT_CATEGORY_OPTIONS.map((o) => o.id as ProductCategoryId),
);

export const PRODUCT_CLASSIFIER_KIE_ERROR =
  "Не удалось распознать товар. Выберите категорию вручную или попробуйте позже.";

export const PRODUCT_CLASSIFIER_PARSE_ERROR =
  "Не удалось разобрать результат распознавания. Выберите данные вручную.";

export function normalizeClassifierCategoryId(raw: unknown): ProductCategoryId {
  if (typeof raw !== "string") return "universal";
  const t = raw.trim();
  if (MANUAL_CATEGORY_IDS.has(t as ProductCategoryId)) {
    return t as ProductCategoryId;
  }
  if ((PRODUCT_CATEGORY_IDS as readonly string[]).includes(t)) {
    return t as ProductCategoryId;
  }
  return "universal";
}

export type ProductClassifierDetectedAttribute = {
  label: string;
  value: string;
  confidence: number;
};

/** Предложение ИИ по товару на фото — не финальная истина, клиент может изменить все поля. */
export type ProductClassifierResult = {
  category: ProductCategoryId;
  categoryLabel: string;
  productTitle: string;
  visibleProduct: string;
  suggestedBenefits: string[];
  detectedAttributes: ProductClassifierDetectedAttribute[];
  confidence: number;
  warnings: string[];
};

export const PRODUCT_CLASSIFIER_SETUP_ERROR =
  "Автоматическое распознавание товара пока настраивается. Выберите категорию вручную.";

export const PRODUCT_CLASSIFIER_MISSING_HINT =
  "Автоматическое распознавание товара скоро будет доступно. Пока выберите категорию вручную.";

export function resolveClassifierCategoryLabel(category: ProductCategoryId): string {
  return (
    getProductCategoryById(category)?.label ??
    getManualProductCategoryLabel(category) ??
    "Прочее"
  );
}

/** Простой текст для USER — без процентов и технических терминов. */
export function formatClassifierConfidenceText(confidence: number): string {
  const c = Math.min(1, Math.max(0, confidence));
  if (c >= 0.85) return "ИИ достаточно уверен в результате";
  if (c >= 0.65) return "ИИ предложил данные — при необходимости проверьте и поправьте";
  return "ИИ не уверен — лучше проверить и поправить вручную";
}

export function benefitsToUserText(benefits: string[]): string {
  return benefits
    .map((b) => b.trim())
    .filter(Boolean)
    .join("\n");
}

export function sanitizeProductClassifierResult(
  raw: Partial<ProductClassifierResult> & { category: ProductCategoryId },
): ProductClassifierResult {
  const category = raw.category;
  const confidence =
    typeof raw.confidence === "number" && !Number.isNaN(raw.confidence)
      ? Math.min(1, Math.max(0, raw.confidence))
      : 0.5;

  return {
    category,
    categoryLabel: raw.categoryLabel?.trim() || resolveClassifierCategoryLabel(category),
    productTitle: raw.productTitle?.trim() || "",
    visibleProduct: raw.visibleProduct?.trim() || "",
    suggestedBenefits: Array.isArray(raw.suggestedBenefits)
      ? raw.suggestedBenefits.map((b) => String(b).trim()).filter(Boolean).slice(0, 7)
      : [],
    detectedAttributes: Array.isArray(raw.detectedAttributes)
      ? raw.detectedAttributes
          .map((a) => ({
            label: typeof a?.label === "string" ? a.label.trim() : "",
            value: typeof a?.value === "string" ? a.value.trim() : "",
            confidence:
              typeof a?.confidence === "number" && !Number.isNaN(a.confidence)
                ? Math.min(1, Math.max(0, a.confidence))
                : 0.5,
          }))
          .filter((a) => a.label && a.value)
          .slice(0, 10)
      : [],
    confidence,
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map((w) => String(w).trim()).filter(Boolean).slice(0, 6)
      : [],
  };
}
