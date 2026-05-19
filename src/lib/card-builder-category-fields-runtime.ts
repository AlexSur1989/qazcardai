import { hasUserDimensionMeasures } from "@/config/card-builder-template-allowlist";
import { isProductCategoryId } from "@/config/product-card-category-fields";
import type { ProductCategoryId } from "@/config/product-card-categories";
import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
import {
  buildCategoryFactsPromptBlock,
  categoryExactTextValuesForSlide,
  type BuildCategoryFactsPromptBlockInput,
} from "@/lib/card-builder-category-facts-prompt";

/** Длина одного текстового поля категории после очистки. */
export const CATEGORY_FIELD_VALUE_MAX_CHARS = 400;
export const CATEGORY_FIELD_KEY_MAX_CHARS = 64;

export type CardBuilderCategoryFieldsSnapshot = {
  categoryKey: string;
  values?: Record<string, string>;
};

/** Расширение объекта настроек плана `card_builder`; хранится в metadata.cardBuilder.settings. */
export type CardBuilderPlanWithCategoryFields = {
  selectedCategory: string;
  dimensions?: string;
  categoryFields?: CardBuilderCategoryFieldsSnapshot;
  categoryFieldsByCategory?: Partial<Record<ProductCategoryId, Record<string, string>>>;
};

export function sanitizeCategoryFieldValue(raw: string): string {
  return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function mergedCategoryValues(input: CardBuilderPlanWithCategoryFields): Record<string, string> {
  const cat = input.selectedCategory?.trim();
  if (!cat || !isProductCategoryId(cat)) return {};
  const archive = input.categoryFieldsByCategory?.[cat as ProductCategoryId] ?? {};
  const snap =
    input.categoryFields?.categoryKey === cat ? (input.categoryFields.values ?? {}) : {};
  return { ...archive, ...snap };
}

export function categoryFieldsPlainForPlanner(input: CardBuilderPlanWithCategoryFields): string {
  const v = mergedCategoryValues(input);
  return Object.values(v)
    .map((s) => sanitizeCategoryFieldValue(s))
    .filter(Boolean)
    .join(" ");
}

export function measureFragmentsFromCategoryFields(input: CardBuilderPlanWithCategoryFields): string[] {
  const v = mergedCategoryValues(input);
  const cat = input.selectedCategory?.trim();
  if (!cat) return [];
  const out: string[] = [];
  if (cat === "apparel" && v.sizeRange?.trim()) out.push(sanitizeCategoryFieldValue(v.sizeRange));
  if (cat === "accessories" && v.sizeOrVolume?.trim()) {
    out.push(sanitizeCategoryFieldValue(v.sizeOrVolume));
  }
  if (cat === "food_and_drinks" && v.volumeWeight?.trim()) {
    out.push(sanitizeCategoryFieldValue(v.volumeWeight));
  }
  if (cat === "beauty_and_care" && v.volume?.trim()) out.push(sanitizeCategoryFieldValue(v.volume));
  if (cat === "gadgets_and_tech" && v.size?.trim()) out.push(sanitizeCategoryFieldValue(v.size));
  if ((cat === "home_and_furniture" || cat === "other") && v.dimensions?.trim()) {
    out.push(sanitizeCategoryFieldValue(v.dimensions));
  }
  return out.filter(Boolean);
}

export function effectiveDimensionsForOverlay(input: CardBuilderPlanWithCategoryFields): string | null {
  const base =
    input.dimensions && input.dimensions.trim() ? sanitizeCategoryFieldValue(input.dimensions) : "";
  const extra = measureFragmentsFromCategoryFields(input);
  const line = [base, ...extra].filter(Boolean).join("; ").trim();
  return line || null;
}

export function hasMeasuresFromCategoryPlan(input: CardBuilderPlanWithCategoryFields): boolean {
  if (hasUserDimensionMeasures(input.dimensions)) return true;
  return measureFragmentsFromCategoryFields(input).some((x) => hasUserDimensionMeasures(x));
}

export function clonePlanInputWithMergedMeasuresForPlanner<
  T extends CardBuilderPlanWithCategoryFields,
>(input: T): T {
  const frags = measureFragmentsFromCategoryFields(input);
  if (!frags.length) return input;
  const base = input.dimensions?.trim() ?? "";
  const merged = [base, ...frags].filter(Boolean).join("; ").trim();
  if (!merged) return input;
  return { ...input, dimensions: merged };
}

export function normalizeFlatCategoryFieldRecord(
  raw: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k0, val] of Object.entries(raw)) {
    const k = k0.trim().slice(0, CATEGORY_FIELD_KEY_MAX_CHARS);
    if (!k) continue;
    if (typeof val !== "string") continue;
    const s = sanitizeCategoryFieldValue(val);
    if (!s) continue;
    out[k] = s.slice(0, CATEGORY_FIELD_VALUE_MAX_CHARS);
  }
  return out;
}

export function normalizeCategoryFieldsOnPlanInput<T extends CardBuilderPlanWithCategoryFields>(
  input: T,
): T {
  let categoryFieldsByCategory = input.categoryFieldsByCategory;
  if (categoryFieldsByCategory && typeof categoryFieldsByCategory === "object") {
    const next: Partial<Record<ProductCategoryId, Record<string, string>>> = {};
    for (const k of Object.keys(categoryFieldsByCategory) as ProductCategoryId[]) {
      if (!isProductCategoryId(k)) continue;
      const m = categoryFieldsByCategory[k];
      if (!m || typeof m !== "object") continue;
      const cleaned = normalizeFlatCategoryFieldRecord(m as Record<string, unknown>);
      if (Object.keys(cleaned).length) next[k] = cleaned;
    }
    categoryFieldsByCategory = Object.keys(next).length ? next : undefined;
  }

  let categoryFields = input.categoryFields;
  if (
    categoryFields &&
    typeof categoryFields === "object" &&
    typeof categoryFields.categoryKey === "string"
  ) {
    const ck = categoryFields.categoryKey.trim().slice(0, CATEGORY_FIELD_KEY_MAX_CHARS);
    const vals = normalizeFlatCategoryFieldRecord(
      (categoryFields.values ?? {}) as Record<string, unknown>,
    );
    if (ck && Object.keys(vals).length)
      categoryFields = { categoryKey: ck, values: vals };
    else categoryFields = undefined;
  }

  return { ...input, categoryFields, categoryFieldsByCategory };
}

export function validateNormalizedCategoryPlanFields(
  input: CardBuilderPlanWithCategoryFields,
): string[] {
  const errs: string[] = [];
  const check = (m: Record<string, string> | undefined, suffix: string) => {
    if (!m) return;
    for (const [k, v] of Object.entries(m)) {
      if (!v.trim()) continue;
      if (v.length > CATEGORY_FIELD_VALUE_MAX_CHARS) {
        errs.push(`Сократите текст поля «${k}»${suffix} (лимит ${CATEGORY_FIELD_VALUE_MAX_CHARS}).`);
      }
    }
  };
  check(input.categoryFields?.values, "");
  if (input.categoryFieldsByCategory) {
    for (const [ck, m] of Object.entries(input.categoryFieldsByCategory)) {
      check(m as Record<string, string>, ` в блоке категории «${ck}»`);
    }
  }
  return errs;
}

function categoryFactsInputFromPlan(
  slideRole: CardBuilderTemplateSlideRole,
  input: CardBuilderPlanWithCategoryFields,
  templateId?: string,
): BuildCategoryFactsPromptBlockInput {
  return {
    categoryKey: input.selectedCategory,
    categoryFields: input.categoryFields,
    categoryFieldsByCategory: input.categoryFieldsByCategory,
    slideRole,
    templateId,
  };
}

/** Строки «Label: значение» только для релевантных полей слайда (блок CATEGORY_FACTS). */
export function lockedCategoryLabelsForSlideRole(
  slideRole: CardBuilderTemplateSlideRole,
  input: CardBuilderPlanWithCategoryFields,
  templateId?: string,
): string[] {
  return buildCategoryFactsPromptBlock(categoryFactsInputFromPlan(slideRole, input, templateId))
    .factsListLines;
}

/** Значения полей для exact text lock (без префикса label). */
export function lockedCategoryExactValuesForSlideRole(
  slideRole: CardBuilderTemplateSlideRole,
  input: CardBuilderPlanWithCategoryFields,
  templateId?: string,
): string[] {
  return categoryExactTextValuesForSlide(categoryFactsInputFromPlan(slideRole, input, templateId));
}

export function slideCategoryFactsForRole(
  slideRole: CardBuilderTemplateSlideRole,
  input: CardBuilderPlanWithCategoryFields,
  templateId?: string,
): Record<string, string> {
  return buildCategoryFactsPromptBlock(categoryFactsInputFromPlan(slideRole, input, templateId))
    .slideFacts;
}

export function categoryFieldFactsLineForSlide(
  slideRole: CardBuilderTemplateSlideRole,
  input: CardBuilderPlanWithCategoryFields,
  templateId?: string,
): string {
  return lockedCategoryLabelsForSlideRole(slideRole, input, templateId).join("\n");
}
