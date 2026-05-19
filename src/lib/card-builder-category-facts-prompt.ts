import {
  getProductCardCategoryFieldsConfig,
  isProductCategoryId,
  type ProductCardCategoryField,
} from "@/config/product-card-category-fields";
import type { ProductCategoryId } from "@/config/product-card-categories";
import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
import {
  mergedCategoryValues,
  sanitizeCategoryFieldValue,
  type CardBuilderPlanWithCategoryFields,
} from "@/lib/card-builder-category-fields-runtime";

export type BuildCategoryFactsPromptBlockInput = {
  categoryKey: string;
  categoryFields?: CardBuilderPlanWithCategoryFields["categoryFields"];
  categoryFieldsByCategory?: CardBuilderPlanWithCategoryFields["categoryFieldsByCategory"];
  slideRole: CardBuilderTemplateSlideRole;
  templateId?: string;
};

export type CategoryFactsPromptBlockResult = {
  /** Факты для metadata / отладки: key → значение. */
  slideFacts: Record<string, string>;
  /** Строки «— Label: value» для блока CATEGORY_FACTS. */
  factsListLines: string[];
  /** Правила безопасности категории (длинные формулировки). */
  safetyRules: string[];
  /** Готовый текст блока CATEGORY_FACTS или пустая строка. */
  block: string;
};

const MEASURE_KEYS = new Set([
  "dimensions",
  "size",
  "sizeRange",
  "sizeOrVolume",
  "volume",
  "volumeWeight",
  "weight",
]);

const MATERIAL_DETAIL_KEYS = new Set([
  "material",
  "texture",
  "keyDetails",
  "color",
  "care",
  "fit",
]);

const LIFESTYLE_KEYS = new Set([
  "useCase",
  "room",
  "style",
  "season",
  "usage",
  "skinHairType",
]);

const PACKAGE_KEYS = new Set(["packageInfo"]);

const FOOD_INGREDIENT_KEYS = new Set(["flavor", "ingredients", "volumeWeight", "packageInfo", "storage"]);

const BEAUTY_INGREDIENT_KEYS = new Set([
  "activeIngredients",
  "effect",
  "texture",
  "skinHairType",
  "usage",
  "productType",
  "volume",
]);

const GADGET_TECH_KEYS = new Set(["mainFunctions", "specs", "compatibility", "model", "packageInfo"]);

const PREMIUM_POSTER_KEYS = new Set(["model"]);

type TemplatePickMode =
  | "materials_detail"
  | "dimensions_only"
  | "lifestyle"
  | "package"
  | "food_ingredients"
  | "beauty_ingredients"
  | "gadget_features"
  | "premium_poster";

function templatePickMode(templateId?: string): TemplatePickMode | null {
  const t = templateId?.trim();
  if (!t) return null;
  if (t === "texture_closeup" || t === "fabric_closeup") return "materials_detail";
  if (t === "size_range" || t === "size_scale" || t === "dimensions_schema") return "dimensions_only";
  if (t === "ingredients_effect") return "beauty_ingredients";
  if (t === "feature_callouts" || t === "interface_detail") return "gadget_features";
  if (t === "interior_lifestyle" || t === "fashion_catalog") return "lifestyle";
  if (t === "gift_packaging" || t === "set_contents") return "package";
  if (t === "premium_poster" || t === "ad_banner" || t === "editorial_poster") return "premium_poster";
  return null;
}

function fieldDef(
  categoryKey: ProductCategoryId,
  key: string,
): ProductCardCategoryField | undefined {
  return getProductCardCategoryFieldsConfig(categoryKey)?.fields.find((f) => f.key === key);
}

function registryAllows(
  categoryKey: ProductCategoryId,
  key: string,
  slideRole: CardBuilderTemplateSlideRole,
): boolean {
  const f = fieldDef(categoryKey, key);
  if (!f) return false;
  const roles = f.useInSlideRoles;
  if (!roles?.length) return true;
  return roles.includes(slideRole);
}

function keysForSlideRole(
  categoryKey: ProductCategoryId,
  slideRole: CardBuilderTemplateSlideRole,
  templateMode: TemplatePickMode | null,
): readonly string[] | null {
  if (templateMode === "materials_detail") {
    return [...MATERIAL_DETAIL_KEYS];
  }
  if (templateMode === "dimensions_only") {
    return [...MEASURE_KEYS];
  }
  if (templateMode === "lifestyle") {
    return [...LIFESTYLE_KEYS];
  }
  if (templateMode === "package") {
    return [...PACKAGE_KEYS];
  }
  if (templateMode === "food_ingredients") {
    return categoryKey === "food_and_drinks" ? [...FOOD_INGREDIENT_KEYS] : null;
  }
  if (templateMode === "beauty_ingredients") {
    return categoryKey === "beauty_and_care" ? [...BEAUTY_INGREDIENT_KEYS] : null;
  }
  if (templateMode === "gadget_features") {
    return categoryKey === "gadgets_and_tech" ? [...GADGET_TECH_KEYS] : null;
  }
  if (templateMode === "premium_poster") {
    return [...PREMIUM_POSTER_KEYS];
  }

  switch (slideRole) {
    case "main_photo":
      if (categoryKey === "accessories") return ["color", "material"];
      if (categoryKey === "gadgets_and_tech") return ["model"];
      return ["material"];
    case "benefits_infographic":
      if (categoryKey === "food_and_drinks") return ["flavor", "volumeWeight", "packageInfo", "storage"];
      if (categoryKey === "beauty_and_care") return ["productType", "effect", "volume", "usage"];
      if (categoryKey === "gadgets_and_tech") return ["mainFunctions", "specs", "compatibility", "model"];
      if (categoryKey === "home_and_furniture") return ["packageInfo", "style"];
      if (categoryKey === "apparel") return ["material", "fit", "keyDetails"];
      if (categoryKey === "accessories") return ["material", "keyDetails", "useCase"];
      return ["keyDetails", "material"];
    case "materials":
      return [...MATERIAL_DETAIL_KEYS];
    case "detail_closeup":
      if (categoryKey === "accessories") {
        return ["material", "color", "keyDetails", "sizeOrVolume", "useCase"];
      }
      if (categoryKey === "gadgets_and_tech") {
        return ["model", "mainFunctions", "specs", "compatibility", "keyDetails"];
      }
      return [...MATERIAL_DETAIL_KEYS];
    case "dimensions":
      return [...MEASURE_KEYS];
    case "lifestyle":
      return [...LIFESTYLE_KEYS];
    case "packaging":
      return [...PACKAGE_KEYS];
    case "premium_poster":
    case "ad_banner":
      return ["model"];
    default:
      return null;
  }
}

function pickFieldKeysForSlide(
  categoryKey: ProductCategoryId,
  slideRole: CardBuilderTemplateSlideRole,
  templateId?: string,
): string[] {
  const templateMode = templatePickMode(templateId);
  const preferred = keysForSlideRole(categoryKey, slideRole, templateMode);
  const conf = getProductCardCategoryFieldsConfig(categoryKey);
  if (!conf) return [];

  const useRegistryRoleFilter = preferred === null;
  const candidateKeys = preferred ?? conf.fields.map((f) => f.key);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of candidateKeys) {
    if (seen.has(key)) continue;
    if (!fieldDef(categoryKey, key)) continue;
    if (useRegistryRoleFilter && !registryAllows(categoryKey, key, slideRole)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function slideCategoryFactsRecord(
  input: BuildCategoryFactsPromptBlockInput,
): Record<string, string> {
  const cat = input.categoryKey.trim();
  if (!isProductCategoryId(cat)) return {};

  const plan: CardBuilderPlanWithCategoryFields = {
    selectedCategory: cat,
    categoryFields: input.categoryFields,
    categoryFieldsByCategory: input.categoryFieldsByCategory,
  };
  const vals = mergedCategoryValues(plan);
  const keys = pickFieldKeysForSlide(cat, input.slideRole, input.templateId);
  const out: Record<string, string> = {};

  for (const key of keys) {
    const raw = vals[key];
    if (typeof raw !== "string") continue;
    const v = sanitizeCategoryFieldValue(raw);
    if (!v) continue;
    out[key] = v;
  }
  return out;
}

export function categorySpecificSafetyRulesBlock(categoryKey: string): string {
  const id = categoryKey.trim();
  const blocks: Record<string, string> = {
    apparel: `Не выдумывай состав ткани, размерную сетку, сезонность или посадку.
Не меняй фасон, цвет, принт и логотип товара.`,
    accessories: `Не выдумывай материал, объём, размер, комплектацию или бренд.
Не меняй форму, цвет, логотип и важные детали товара.`,
    food_and_drinks: `Не выдумывай состав, БЖУ, калории, срок годности, органик-статус, отсутствие сахара или пользу для здоровья.
Не делай медицинские или диетические обещания.`,
    beauty_and_care: `Не выдумывай состав, активные компоненты, эффект, тип кожи/волос или способ применения.
Не делай медицинские/лечебные обещания.
Не пиши «дерматологически доказано», если пользователь не указал.`,
    gadgets_and_tech: `Не выдумывай мощность, память, батарею, гарантию, водозащиту, совместимость, скорость или технические характеристики.
Используй только характеристики, которые указал пользователь.`,
    home_and_furniture: `Не выдумывай размеры, материал, комплектацию или стиль.
Не добавляй лишние предметы как часть комплекта.
Сохраняй форму, цвет и материал товара.`,
    other: `Используй только указанные факты.
Не выдумывай характеристики, размеры, состав, функции или свойства.`,
  };
  if (!isProductCategoryId(id)) return blocks.other ?? "";
  return blocks[id] ?? blocks.other ?? "";
}

export function buildCategoryFactsPromptBlock(
  input: BuildCategoryFactsPromptBlockInput,
): CategoryFactsPromptBlockResult {
  const cat = input.categoryKey.trim();
  const empty: CategoryFactsPromptBlockResult = {
    slideFacts: {},
    factsListLines: [],
    safetyRules: [],
    block: "",
  };
  if (!isProductCategoryId(cat)) return empty;

  const slideFacts = slideCategoryFactsRecord(input);
  const conf = getProductCardCategoryFieldsConfig(cat);
  const factsListLines: string[] = [];
  for (const [key, value] of Object.entries(slideFacts)) {
    const label = conf?.fields.find((f) => f.key === key)?.label ?? key;
    factsListLines.push(`- ${label}: ${value}`);
  }

  const safetyRules = [categorySpecificSafetyRulesBlock(cat)].filter(Boolean);

  if (!factsListLines.length) {
    return { slideFacts, factsListLines, safetyRules, block: "" };
  }

  const listBody = factsListLines.join("\n");
  const block = [
    "CATEGORY_FACTS:",
    "",
    `Данные товара, указанные пользователем:
${listBody}`,
    "",
    "Используй эти данные как факты.",
    "Не выдумывай отсутствующие характеристики.",
    "Не добавляй свойства, которые пользователь не указал.",
    "Если поле не заполнено, не делай выводы самостоятельно.",
    "",
    ...safetyRules,
  ].join("\n");

  return { slideFacts, factsListLines, safetyRules, block };
}

/** Значения полей категории для locked exact text (без префикса «Label:»). */
export function categoryExactTextValuesForSlide(
  input: BuildCategoryFactsPromptBlockInput,
): string[] {
  const cat = input.categoryKey.trim();
  if (!isProductCategoryId(cat)) return [];

  const slideFacts = slideCategoryFactsRecord(input);
  const conf = getProductCardCategoryFieldsConfig(cat);
  if (!conf) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const [key, value] of Object.entries(slideFacts)) {
    const f = conf.fields.find((x) => x.key === key);
    if (!f || f.useAsExactText === false) continue;
    if (MEASURE_KEYS.has(key) && input.slideRole !== "dimensions") continue;
    const v = sanitizeCategoryFieldValue(value);
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

/** @deprecated Используйте buildCategoryFactsPromptBlock; оставлено для совместимости текстовых слотов. */
export function categoryFactsListLinesForSlide(
  input: BuildCategoryFactsPromptBlockInput,
): string[] {
  return buildCategoryFactsPromptBlock(input).factsListLines;
}
