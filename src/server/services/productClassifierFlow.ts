import type { ProductCategoryId } from "@/config/product-card-categories";
import { PRODUCT_CATEGORY_IDS } from "@/config/product-card-categories";
import {
  type ProductClassifierResult,
  PRODUCT_CLASSIFIER_KIE_ERROR,
  PRODUCT_CLASSIFIER_PARSE_ERROR,
  PRODUCT_CLASSIFIER_SETUP_ERROR,
  resolveClassifierCategoryLabel,
  sanitizeProductClassifierResult,
} from "@/lib/product-classifier-result";
import { resolveDefaultProductClassifierModel } from "@/server/services/productCardModelResolver";
import { getProductCardModelSetupOverview } from "@/server/services/productCardModelSetup";
import {
  classifyProductWithKieChat,
  ProductClassifierKieHttpError,
  ProductClassifierKieNotEnabledError,
  ProductClassifierParseError,
} from "@/server/services/productClassifierKieChat";

function parseStrictProductCategoryId(raw: unknown): ProductCategoryId {
  if (typeof raw !== "string") return "other";
  const t = raw.trim();
  if ((PRODUCT_CATEGORY_IDS as readonly string[]).includes(t)) {
    return t as ProductCategoryId;
  }
  return "other";
}

const DEV_MOCK_CATEGORIES: Record<string, Partial<ProductClassifierResult>> = {
  home_goods: {
    category: "home_goods",
    categoryLabel: "Товары для дома",
    productTitle: "Керамическая кружка",
    visibleProduct: "Кружка на фото",
    suggestedBenefits: [
      "удобная ручка",
      "подходит для горячих напитков",
      "минималистичный дизайн",
    ],
    confidence: 0.86,
  },
  apparel: {
    category: "apparel",
    categoryLabel: "Одежда",
    productTitle: "Хлопковая футболка",
    visibleProduct: "Футболка на фото",
    suggestedBenefits: ["мягкая ткань", "универсальный крой", "удобна на каждый день"],
    confidence: 0.81,
  },
  electronics: {
    category: "electronics",
    categoryLabel: "Электроника",
    productTitle: "Наушники",
    visibleProduct: "Наушники на фото",
    suggestedBenefits: ["компактный формат", "удобно брать с собой"],
    confidence: 0.78,
  },
};

export type ProductClassifierFlowOutcome =
  | { ok: true; result: ProductClassifierResult; source: "dev_mock" | "kie" }
  | { ok: false; error: string; code: "setup" | "invalid_mock" | "kie" | "parse" };

export function isDevClassifierMockEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function parseDevClassifierMockCategory(
  value: string | null | undefined,
): ProductCategoryId | null {
  if (!isDevClassifierMockEnabled()) return null;
  const key = value?.trim();
  if (!key || !(key in DEV_MOCK_CATEGORIES)) return null;
  return parseStrictProductCategoryId(key);
}

export async function isProductClassifierReady(): Promise<boolean> {
  const overview = await getProductCardModelSetupOverview();
  const slot = overview.byType.PRODUCT_CLASSIFIER;
  // generationReady = модель Ready + gate on; autoClassifyReady дополнительно требует all_users
  return slot?.generationReady === true;
}

export function buildDevMockClassifierResult(
  categoryKey: string,
): ProductClassifierFlowOutcome {
  if (!isDevClassifierMockEnabled()) {
    return { ok: false, error: PRODUCT_CLASSIFIER_SETUP_ERROR, code: "setup" };
  }
  const preset = DEV_MOCK_CATEGORIES[categoryKey];
  if (!preset) {
    return {
      ok: false,
      error: "Неизвестный dev mock для classifier.",
      code: "invalid_mock",
    };
  }
  const category = parseStrictProductCategoryId(preset.category ?? categoryKey);
  return {
    ok: true,
    source: "dev_mock",
    result: sanitizeProductClassifierResult({
      ...preset,
      category,
      categoryLabel: preset.categoryLabel ?? resolveClassifierCategoryLabel(category),
    }),
  };
}

/**
 * Classifier flow: dev mock → setup error if Missing → Kie chat/completions if Ready.
 * Не создаёт Generation, CreditTransaction и не запускает worker.
 */
export async function runSafeProductClassifierFlow(args: {
  devMockCategory?: string | null;
  imageUrl?: string | null;
}): Promise<ProductClassifierFlowOutcome> {
  const mockCategory = parseDevClassifierMockCategory(args.devMockCategory);
  if (mockCategory) {
    return buildDevMockClassifierResult(mockCategory);
  }

  const ready = await isProductClassifierReady();
  if (!ready) {
    return { ok: false, error: PRODUCT_CLASSIFIER_SETUP_ERROR, code: "setup" };
  }

  const imageUrl = args.imageUrl?.trim() ?? "";
  if (!imageUrl) {
    return {
      ok: false,
      error: "Сначала загрузите фото товара",
      code: "setup",
    };
  }

  const model = await resolveDefaultProductClassifierModel();
  if (!model) {
    return { ok: false, error: PRODUCT_CLASSIFIER_SETUP_ERROR, code: "setup" };
  }

  if (process.env.PRODUCT_CLASSIFIER_ALLOW_REAL_KIE !== "true") {
    return { ok: false, error: PRODUCT_CLASSIFIER_SETUP_ERROR, code: "setup" };
  }

  try {
    const result = await classifyProductWithKieChat({ imageUrl, model });
    return { ok: true, result, source: "kie" };
  } catch (e) {
    if (e instanceof ProductClassifierParseError) {
      return { ok: false, error: PRODUCT_CLASSIFIER_PARSE_ERROR, code: "parse" };
    }
    if (e instanceof ProductClassifierKieHttpError) {
      return { ok: false, error: PRODUCT_CLASSIFIER_KIE_ERROR, code: "kie" };
    }
    if (e instanceof ProductClassifierKieNotEnabledError) {
      return { ok: false, error: PRODUCT_CLASSIFIER_SETUP_ERROR, code: "setup" };
    }
    return { ok: false, error: PRODUCT_CLASSIFIER_KIE_ERROR, code: "kie" };
  }
}
