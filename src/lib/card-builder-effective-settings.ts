import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
import { filterFactsForGeneration } from "@/lib/card-builder-fact-eligibility";
import type { CardBuilderProductFact } from "@/lib/card-builder-product-facts";
import {
  hasBenefitProductFacts,
  hasDimensionProductFacts,
  productFactsForSlideRole,
} from "@/lib/card-builder-product-facts";

export type CardBuilderEffectiveSettingsInput = {
  slideRole: string;
  templateId?: string;
  categoryKey?: string;
  rawSalesStyle: string;
  rawTextDensity: string;
  rawVisualStyle?: string;
  audience?: string;
  priceSegment?: string;
  productFactsForSlide: readonly CardBuilderProductFact[];
  allProductFacts?: readonly CardBuilderProductFact[];
  exactTextPhrases: readonly string[];
  creationMode?: string;
};

export type CardBuilderEffectiveSettings = {
  effectiveSalesStyle: string;
  effectiveTextDensity: string;
  effectiveVisualStyle: string;
  effectivePromptWarnings: string[];
  suppressInfographicInstructions: boolean;
  suppressHeavyTextInstructions: boolean;
  suppressBadgeCalloutInstructions: boolean;
  allowBenefitLanguage: boolean;
  allowDimensionLanguage: boolean;
  allowMaterialLanguage: boolean;
  maxVisibleTextBlocks: number;
  slideRoleConstraintLines: string[];
  blockGeneration: boolean;
  blockGenerationMessage?: string;
};

const TEXT_DENSITY_ORDER = ["none", "minimal", "medium", "heavy", "infographic"] as const;

function densityRank(id: string): number {
  const i = TEXT_DENSITY_ORDER.indexOf(id as (typeof TEXT_DENSITY_ORDER)[number]);
  return i >= 0 ? i : 2;
}

function capTextDensity(current: string, max: string): string {
  return densityRank(current) > densityRank(max) ? max : current;
}

function isPremiumCategory(categoryKey: string | undefined): boolean {
  const c = (categoryKey ?? "").trim();
  return c === "beauty_care" || c === "jewelry_accessories";
}

function lifestyleEffectiveSalesStyle(
  rawSalesStyle: string,
  rawVisualStyle: string | undefined,
  categoryKey: string | undefined,
): string {
  if (rawSalesStyle === "infographic" || rawVisualStyle === "infographic") {
    if (isPremiumCategory(categoryKey) || rawVisualStyle === "premium" || rawSalesStyle === "premium") {
      return "premium";
    }
    return "cozy_lifestyle";
  }
  if (rawSalesStyle === "bold_ad") return "cozy_lifestyle";
  if (rawSalesStyle === "premium" || rawSalesStyle === "editorial") return rawSalesStyle;
  if (rawVisualStyle === "premium") return "premium";
  return rawSalesStyle === "cozy_lifestyle" ? rawSalesStyle : "cozy_lifestyle";
}

function mainPhotoEffectiveSalesStyle(rawSalesStyle: string, rawVisualStyle: string | undefined): string {
  if (rawSalesStyle === "infographic" || rawVisualStyle === "infographic") return "clean_catalog";
  if (rawSalesStyle === "bold_ad") return "clean_catalog";
  if (rawSalesStyle === "premium" || rawSalesStyle === "editorial") return "premium";
  if (rawVisualStyle === "minimalism") return "minimalism";
  return "clean_catalog";
}

function infographicVisualStyle(rawVisualStyle: string | undefined, rawSalesStyle: string): string {
  if (rawVisualStyle === "infographic" || rawSalesStyle === "infographic") return "infographic";
  if (rawVisualStyle && rawVisualStyle !== "auto") return rawVisualStyle;
  return "auto";
}

function hasMaterialFacts(facts: readonly CardBuilderProductFact[]): boolean {
  return facts.some(
    (f) => f.type === "material" && f.visibleOnCard !== false && f.value.trim().length > 0,
  );
}

function hasBenefitOrFeatureFacts(facts: readonly CardBuilderProductFact[]): boolean {
  return facts.some(
    (f) =>
      (f.type === "benefit" || f.type === "feature") &&
      f.visibleOnCard !== false &&
      f.value.trim().length > 0,
  );
}

function hasPackageFacts(facts: readonly CardBuilderProductFact[]): boolean {
  return facts.some(
    (f) => f.type === "package" && f.visibleOnCard !== false && f.value.trim().length > 0,
  );
}

function hasComparisonFacts(facts: readonly CardBuilderProductFact[]): boolean {
  const eligible = facts.filter(
    (f) =>
      f.visibleOnCard !== false &&
      f.value.trim().length > 0 &&
      (f.type === "feature" ||
        f.type === "benefit" ||
        f.type === "compatibility" ||
        f.type === "dimension" ||
        f.type === "material"),
  );
  return eligible.length >= 2;
}

function hasUsageOrCareFacts(facts: readonly CardBuilderProductFact[]): boolean {
  return facts.some(
    (f) =>
      (f.type === "usage" || f.type === "care") &&
      f.visibleOnCard !== false &&
      f.value.trim().length > 0,
  );
}

function hasSpecFacts(facts: readonly CardBuilderProductFact[]): boolean {
  const specTypes = new Set(["feature", "dimension", "material", "compatibility", "package"]);
  return (
    facts.filter(
      (f) => specTypes.has(f.type) && f.visibleOnCard !== false && f.value.trim().length > 0,
    ).length >= 2
  );
}

function hasOfferFacts(facts: readonly CardBuilderProductFact[]): boolean {
  return facts.some((f) => {
    if (f.visibleOnCard === false || !f.value.trim()) return false;
    const blob = `${f.label} ${f.value}`.toLowerCase();
    return (
      /скидк|акци|промо|бонус|%-|₸|руб|тенге|deadline|до \d|цена|price|discount|promo/i.test(
        blob,
      ) || f.type === "package"
    );
  });
}

function hasSocialProofFacts(facts: readonly CardBuilderProductFact[]): boolean {
  return facts.some((f) => {
    if (f.visibleOnCard === false || !f.value.trim()) return false;
    const blob = `${f.label} ${f.value}`.toLowerCase();
    return /отзыв|review|rating|рейтинг|★|звезд|звёзд|оценк|продаж|заказ/i.test(blob);
  });
}

export function computeEffectiveCardBuilderSettings(
  input: CardBuilderEffectiveSettingsInput,
): CardBuilderEffectiveSettings {
  const role = input.slideRole.trim() as CardBuilderTemplateSlideRole;
  const warnings: string[] = [];
  const constraintLines: string[] = [];

  let effectiveSalesStyle = input.rawSalesStyle.trim() || "clean_catalog";
  let effectiveTextDensity = input.rawTextDensity.trim() || "medium";
  let effectiveVisualStyle = input.rawVisualStyle?.trim() || "auto";

  let suppressInfographicInstructions = false;
  let suppressHeavyTextInstructions = false;
  let suppressBadgeCalloutInstructions = false;
  let allowBenefitLanguage = role === "benefits_infographic";
  let allowDimensionLanguage = role === "dimensions";
  let allowMaterialLanguage = role === "materials";

  let blockGeneration = false;
  let blockGenerationMessage: string | undefined;

  const phraseCount = input.exactTextPhrases.length;
  let maxVisibleTextBlocks = Math.max(phraseCount, 1);

  const allFacts = filterFactsForGeneration(
    input.allProductFacts ?? input.productFactsForSlide,
    input.categoryKey,
  );
  const slideFacts = input.productFactsForSlide;
  void slideFacts;

  if (phraseCount <= 2) {
    maxVisibleTextBlocks = Math.max(phraseCount, 1);
    suppressHeavyTextInstructions = true;
  }

  switch (role) {
    case "lifestyle": {
      effectiveSalesStyle = lifestyleEffectiveSalesStyle(
        effectiveSalesStyle,
        effectiveVisualStyle,
        input.categoryKey,
      );
      effectiveTextDensity = capTextDensity(effectiveTextDensity, "medium");
      if (effectiveVisualStyle === "infographic") effectiveVisualStyle = "lifestyle";
      suppressInfographicInstructions = true;
      suppressHeavyTextInstructions = true;
      suppressBadgeCalloutInstructions = true;
      allowBenefitLanguage = false;
      constraintLines.push(
        "Lifestyle-слайд: естественная сцена использования без инфографики, сеток, плашек и выносок.",
        "Не добавляй списки преимуществ и характеристик, если их нет в locked phrases этого слайда.",
      );
      break;
    }
    case "main_photo": {
      effectiveSalesStyle = mainPhotoEffectiveSalesStyle(effectiveSalesStyle, effectiveVisualStyle);
      effectiveTextDensity = capTextDensity(effectiveTextDensity, "minimal");
      if (effectiveVisualStyle === "infographic") effectiveVisualStyle = "minimalism";
      suppressInfographicInstructions = true;
      suppressHeavyTextInstructions = true;
      suppressBadgeCalloutInstructions = true;
      allowBenefitLanguage = false;
      maxVisibleTextBlocks = effectiveTextDensity === "none" ? 0 : Math.min(maxVisibleTextBlocks, 2);
      constraintLines.push(
        "Главное фото: чистый каталожный кадр без инфографики, выносок, badges и списков преимуществ.",
        "Заголовок и при необходимости одна subtitle-фраза (назначение/описание) из locked phrases, если text density не «без текста».",
      );
      break;
    }
    case "benefits_infographic": {
      effectiveVisualStyle = infographicVisualStyle(effectiveVisualStyle, effectiveSalesStyle);
      if (!hasBenefitOrFeatureFacts(allFacts) && !hasBenefitProductFacts(allFacts)) {
        blockGeneration = true;
        blockGenerationMessage =
          "Добавьте хотя бы одно преимущество или функцию товара — без данных слайд преимуществ не генерируем.";
        warnings.push("Нет benefit/feature facts для benefits_infographic.");
      } else if (phraseCount <= 2) {
        suppressHeavyTextInstructions = true;
        warnings.push("Мало locked phrases — не просим 3–5 преимуществ.");
      }
      allowBenefitLanguage = true;
      break;
    }
    case "dimensions": {
      effectiveSalesStyle =
        effectiveSalesStyle === "infographic" ? "clean_catalog" : effectiveSalesStyle;
      effectiveTextDensity = capTextDensity(effectiveTextDensity, "medium");
      suppressInfographicInstructions = true;
      if (!hasDimensionProductFacts(allFacts)) {
        allowDimensionLanguage = false;
        suppressHeavyTextInstructions = true;
        constraintLines.push(
          "Размеры не указаны пользователем: покажи масштаб визуально БЕЗ числовых размеров, объёма, веса и подписей с цифрами.",
          "Не добавляй «560 мл», «см», «кг» и любые выдуманные числа.",
        );
        warnings.push("Нет dimension facts — только safe scale visual.");
      }
      break;
    }
    case "materials": {
      effectiveSalesStyle =
        effectiveSalesStyle === "infographic" ? "clean_catalog" : effectiveSalesStyle;
      effectiveTextDensity = capTextDensity(effectiveTextDensity, "medium");
      suppressInfographicInstructions = true;
      suppressBadgeCalloutInstructions = true;
      if (!hasMaterialFacts(allFacts)) {
        allowMaterialLanguage = false;
        constraintLines.push(
          "Материал не указан пользователем: покажи только фактуру и поверхность (visual texture / surface detail).",
          "Не называй конкретный материал (пластик, хлопок, металл, кожа и т.д.) без locked phrases.",
        );
        warnings.push("Нет material facts — soft texture only.");
      }
      break;
    }
    case "detail_closeup":
    case "premium_poster":
    case "ad_banner":
      break;
    case "packaging": {
      effectiveSalesStyle =
        effectiveSalesStyle === "infographic" ? "clean_catalog" : effectiveSalesStyle;
      effectiveTextDensity = capTextDensity(effectiveTextDensity, "medium");
      suppressInfographicInstructions = true;
      if (!hasPackageFacts(allFacts)) {
        blockGeneration = true;
        blockGenerationMessage =
          "Добавьте состав комплекта или упаковку — без данных слайд комплектации не генерируем.";
        warnings.push("Нет package facts для packaging.");
        constraintLines.push(
          "Комплектация не указана: не добавляй кабели, аксессуары, подарки и лишние предметы в набор.",
        );
      }
      break;
    }
    default: {
      if (effectiveSalesStyle === "infographic") {
        if (role === "premium_poster" || role === "ad_banner") {
          effectiveSalesStyle = "premium";
        }
      }
      break;
    }
  }

  if (
    effectiveVisualStyle === "minimalism" &&
    (effectiveSalesStyle === "bold_ad" || effectiveSalesStyle === "infographic")
  ) {
    effectiveSalesStyle = "minimalism";
    warnings.push("minimalism visualStyle — salesStyle понижен до minimalism.");
  }

  if (phraseCount <= 2 && role !== "benefits_infographic") {
    suppressHeavyTextInstructions = true;
  }

  if (phraseCount <= 2 && role === "benefits_infographic" && hasBenefitOrFeatureFacts(allFacts)) {
    if (phraseCount < 3) suppressHeavyTextInstructions = true;
  }

  const templateId = input.templateId?.trim();
  if (templateId === "comparison_card" && !hasComparisonFacts(allFacts)) {
    blockGeneration = true;
    blockGenerationMessage =
      "Добавьте минимум два подтверждённых факта для сравнения — без данных слайд сравнения не генерируем.";
    warnings.push("comparison_card без comparison facts.");
  }
  if (templateId === "set_contents" && !hasPackageFacts(allFacts)) {
    blockGeneration = true;
    blockGenerationMessage =
      "Добавьте состав комплекта — без данных слайд set_contents не генерируем.";
    warnings.push("set_contents без package facts.");
  }

  const cardTypeKey = input.slideRole.trim();
  if (cardTypeKey === "usage_instruction" && !hasUsageOrCareFacts(allFacts)) {
    blockGeneration = true;
    blockGenerationMessage = "Добавьте способ использования или уход — без данных инструкцию не генерируем.";
    warnings.push("usage_instruction без usage/care facts.");
  }
  if (cardTypeKey === "specs_card" && !hasSpecFacts(allFacts)) {
    blockGeneration = true;
    blockGenerationMessage =
      "Добавьте минимум 2–3 характеристики — без данных слайд specs не генерируем.";
    warnings.push("specs_card без достаточного числа spec facts.");
  }
  if (cardTypeKey === "social_proof" && !hasSocialProofFacts(allFacts)) {
    blockGeneration = true;
    blockGenerationMessage =
      "Добавьте реальные отзывы или рейтинг — без данных social proof не генерируем.";
    warnings.push("social_proof без review/rating facts.");
  }
  if (cardTypeKey === "offer_card" && !hasOfferFacts(allFacts)) {
    blockGeneration = true;
    blockGenerationMessage =
      "Добавьте данные акции (скидка, цена, промо) — без данных offer-слайд не генерируем.";
    warnings.push("offer_card без offer facts.");
  }

  return {
    effectiveSalesStyle,
    effectiveTextDensity,
    effectiveVisualStyle,
    effectivePromptWarnings: warnings,
    suppressInfographicInstructions,
    suppressHeavyTextInstructions,
    suppressBadgeCalloutInstructions,
    allowBenefitLanguage,
    allowDimensionLanguage,
    allowMaterialLanguage,
    maxVisibleTextBlocks,
    slideRoleConstraintLines: constraintLines,
    blockGeneration,
    blockGenerationMessage,
  };
}

export function computeEffectiveCardBuilderSettingsForSlide(input: {
  slideRole: string;
  templateId?: string;
  categoryKey?: string;
  rawSalesStyle: string;
  rawTextDensity: string;
  rawVisualStyle?: string;
  audience?: string;
  priceSegment?: string;
  productFacts: readonly CardBuilderProductFact[];
  exactTextPhrases: readonly string[];
  creationMode?: string;
}): CardBuilderEffectiveSettings {
  const slideRoleTyped = input.slideRole.trim() as CardBuilderTemplateSlideRole;
  const productFactsForSlide = productFactsForSlideRole(input.productFacts, slideRoleTyped);
  return computeEffectiveCardBuilderSettings({
    ...input,
    productFactsForSlide,
    allProductFacts: input.productFacts,
  });
}
