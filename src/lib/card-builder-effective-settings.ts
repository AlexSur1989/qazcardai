import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
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

  const allFacts = input.allProductFacts ?? input.productFactsForSlide;
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
    case "packaging":
    case "premium_poster":
    case "ad_banner":
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
