import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
import type { CardBuilderUniversalCategoryId } from "@/config/card-builder-universal";
import {
  confidenceLevelFromNumeric,
  isWebSuggestedFact,
  lockedTextPhrasesFromFacts,
  productFactsForSlideRole,
  type CardBuilderFactConfidenceLevel,
  type CardBuilderProductFact,
} from "@/lib/card-builder-product-facts";

export const RISKY_PRODUCT_CARD_CATEGORIES = new Set<CardBuilderUniversalCategoryId>([
  "beauty_care",
  "food_drinks",
  "kids_products",
  "auto_products",
  "gadgets_tech",
  "jewelry_accessories",
]);

const BEAUTY_BLOCKED = [
  /лечит/i,
  /устраняет/i,
  /дерматолог/i,
  /гипоаллерген/i,
  /подходит всем/i,
  /медицин/i,
  /клиническ/i,
  /доказан/i,
];

const FOOD_BLOCKED = [
  /лечит/i,
  /полезн.*здоров/i,
  /без сахар/i,
  /organ/i,
  /органик/i,
  /диетич/i,
  /низкокалор/i,
];

const KIDS_BLOCKED = [
  /безопасн/i,
  /сертифиц/i,
  /гипоаллерген/i,
  /возраст\s*\d/i,
  /для детей/i,
];

const AUTO_BLOCKED = [
  /совместим.*(?:bmw|audi|toyota|mercedes|lada|kia|hyundai)/i,
  /гарант/i,
  /оригинал/i,
  /oem/i,
];

const GADGETS_BLOCKED = [
  /мощност/i,
  /\b\d+\s*gb\b/i,
  /\b\d+\s*mah\b/i,
  /совместим.*(?:iphone|android|ios)/i,
  /памят/i,
  /батар/i,
];

const JEWELRY_BLOCKED = [
  /золот/i,
  /серебр/i,
  /бриллиант/i,
  /алмаз/i,
  /натуральн.*кож/i,
  /925/i,
  /585/i,
];

const CATEGORY_BLOCKED_PATTERNS: Partial<
  Record<CardBuilderUniversalCategoryId, RegExp[]>
> = {
  beauty_care: BEAUTY_BLOCKED,
  food_drinks: FOOD_BLOCKED,
  kids_products: KIDS_BLOCKED,
  auto_products: AUTO_BLOCKED,
  gadgets_tech: GADGETS_BLOCKED,
  jewelry_accessories: JEWELRY_BLOCKED,
};

const LOW_CONFIDENCE_LEVELS = new Set<CardBuilderFactConfidenceLevel>(["low"]);

export function normalizeCategoryForFactRules(
  categoryKey: string | undefined,
): CardBuilderUniversalCategoryId {
  const c = (categoryKey ?? "other").trim() as CardBuilderUniversalCategoryId;
  if (c === "auto") return "other";
  return c;
}

export function matchesBlockedClaimPattern(
  text: string,
  categoryKey: string | undefined,
): boolean {
  const cat = normalizeCategoryForFactRules(categoryKey);
  const patterns = CATEGORY_BLOCKED_PATTERNS[cat];
  if (!patterns?.length) return false;
  const hay = `${text}`.trim();
  if (!hay) return false;
  return patterns.some((re) => re.test(hay));
}

/** Можно ли использовать fact в генерации карточек. */
export function isFactEligibleForGeneration(
  fact: CardBuilderProductFact,
  categoryKey?: string,
): boolean {
  if (!fact.value.trim()) return false;
  if (fact.visibleOnCard === false) return false;

  if (fact.source === "web_suggested") {
    if (fact.needsReview !== false) return false;
    if (fact.verifiedByUser !== true) return false;
  }

  const level =
    fact.confidenceLevel ??
    (typeof fact.confidence === "number"
      ? confidenceLevelFromNumeric(fact.confidence)
      : undefined);

  if (isWebSuggestedFact(fact) && level && LOW_CONFIDENCE_LEVELS.has(level)) {
    return false;
  }

  if (
    isWebSuggestedFact(fact) &&
    RISKY_PRODUCT_CARD_CATEGORIES.has(normalizeCategoryForFactRules(categoryKey)) &&
    matchesBlockedClaimPattern(`${fact.label} ${fact.value}`, categoryKey)
  ) {
    return false;
  }

  if (fact.source === "vision_ai") {
    if (level && LOW_CONFIDENCE_LEVELS.has(level)) return false;
    if (
      fact.needsReview === true &&
      matchesBlockedClaimPattern(`${fact.label} ${fact.value}`, categoryKey)
    ) {
      return false;
    }
  }

  return true;
}

export function filterFactsForGeneration(
  facts: readonly CardBuilderProductFact[],
  categoryKey?: string,
): CardBuilderProductFact[] {
  return facts.filter((f) => isFactEligibleForGeneration(f, categoryKey));
}

export function productFactsForSlideGeneration(
  facts: readonly CardBuilderProductFact[],
  slideRole: CardBuilderTemplateSlideRole,
  categoryKey?: string,
): CardBuilderProductFact[] {
  return productFactsForSlideRole(filterFactsForGeneration(facts, categoryKey), slideRole);
}

export function lockedTextPhrasesForGeneration(
  facts: readonly CardBuilderProductFact[],
  categoryKey?: string,
): string[] {
  return lockedTextPhrasesFromFacts(filterFactsForGeneration(facts, categoryKey));
}

export function hasUnverifiedWebSuggestedFacts(
  facts: readonly CardBuilderProductFact[],
): boolean {
  return facts.some(
    (f) =>
      isWebSuggestedFact(f) &&
      (f.needsReview !== false || f.verifiedByUser !== true) &&
      f.value.trim().length > 0,
  );
}

export function hasInsufficientFactsForGallery(
  facts: readonly CardBuilderProductFact[],
  categoryKey?: string,
): boolean {
  const eligible = filterFactsForGeneration(facts, categoryKey);
  const hasBenefit = eligible.some((f) => f.type === "benefit" || f.type === "feature");
  const hasPurpose = eligible.some((f) => f.type === "product_purpose");
  const hasDetail = eligible.some(
    (f) =>
      f.type !== "benefit" &&
      f.type !== "feature" &&
      f.type !== "product_purpose" &&
      f.value.trim().length > 0,
  );
  return !hasBenefit && !hasPurpose && !hasDetail;
}

export function defaultVisibleOnCardForWebFact(
  categoryKey: string | undefined,
  riskyCategoriesRequireManualConfirmation: boolean,
): boolean {
  if (!riskyCategoriesRequireManualConfirmation) return false;
  return !RISKY_PRODUCT_CARD_CATEGORIES.has(normalizeCategoryForFactRules(categoryKey));
}
