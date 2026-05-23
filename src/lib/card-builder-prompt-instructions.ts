import { CARD_BUILDER_SALES_STYLES, CARD_BUILDER_TEXT_DENSITY } from "@/config/card-builder-config";
import { computeEffectiveCardBuilderSettingsForSlide } from "@/lib/card-builder-effective-settings";
import type { CardBuilderProductFact } from "@/lib/card-builder-product-facts";

export type CardBuilderStyleInstructionOpts = {
  suppressInfographicInstructions?: boolean;
  suppressBadgeCalloutInstructions?: boolean;
};

export function getSalesStyleInstruction(
  salesStyle: string,
  opts?: CardBuilderStyleInstructionOpts,
): string {
  const id = salesStyle.trim();
  if (opts?.suppressInfographicInstructions && id === "infographic") {
    return "";
  }
  const label = CARD_BUILDER_SALES_STYLES.find((s) => s.id === id)?.label ?? id;
  const blocks: Record<string, string> = {
    clean_catalog: [
      "Стиль: чистый каталог.",
      "Белый/светлый фон, ровная композиция, минимум декора.",
    ].join("\n"),
    light_marketplace: [
      "Стиль: светлый маркетплейс.",
      "Светлый фон, понятные плашки, уверенный коммерческий вид.",
    ].join("\n"),
    premium: [
      "Стиль: премиум.",
      "Дорогой визуал, качественный свет, аккуратная типографика.",
    ].join("\n"),
    cozy_lifestyle: [
      "Стиль: уютный lifestyle.",
      "Тёплая сцена, естественное использование, мягкий свет.",
    ].join("\n"),
    minimalism: [
      "Стиль: минимализм.",
      "Много воздуха, простая композиция, мало отвлекающих деталей.",
    ].join("\n"),
    bold_ad: [
      "Стиль: яркая реклама.",
      "Насыщенный визуал и сильный акцент без визуального перегруза.",
    ].join("\n"),
    infographic: [
      "Стиль: инфографика.",
      opts?.suppressBadgeCalloutInstructions
        ? "Структурированная подача без перегруженных плашек; текст только из locked phrases."
        : "Визуально: плашки, иконки, выноски, сетка — адаптируй под стиль; символы текста только из locked phrases пользователя.",
    ].join("\n"),
    editorial: [
      "Стиль: editorial.",
      "Журнальная композиция, премиальный кадрирование.",
    ].join("\n"),
  };
  return (blocks[id] ?? `Стиль продаж: ${label}.`).trim();
}

export type CardBuilderTextDensityInstructionOpts = {
  suppressHeavyTextInstructions?: boolean;
  suppressInfographicInstructions?: boolean;
  exactTextPhraseCount?: number;
  allowBenefitLanguage?: boolean;
};

export function getTextDensityInstruction(
  textDensity: string,
  opts?: CardBuilderTextDensityInstructionOpts,
): string {
  const id = textDensity.trim();
  const label = CARD_BUILDER_TEXT_DENSITY.find((t) => t.id === id)?.label ?? id;
  const lock = "Все читаемые слова на кадре — только из locked phrases; не добавляй другой маркетинговый текст.";
  const phraseCount = opts?.exactTextPhraseCount ?? 0;
  const canAskBenefits =
    opts?.allowBenefitLanguage !== false &&
    !opts?.suppressHeavyTextInstructions &&
    phraseCount >= 3;

  const body: Record<string, string> = {
    none: `Плотность текста: без текста — не добавляй заголовков и плашек. ${lock}`,
    minimal: `Плотность текста: минимум — не больше одной короткой строки из locked phrases. ${lock}`,
    medium: `Плотность текста: средне — заголовок и ключевые тезисы только из locked phrases${canAskBenefits ? " (ориентир: несколько плашек)" : ""}. ${lock}`,
    heavy: opts?.suppressHeavyTextInstructions
      ? `Плотность текста: умеренная — только фразы из locked phrases пользователя, без дополнительных формулировок. ${lock}`
      : canAskBenefits
        ? `Плотность текста: высокая — заголовок, 3–5 преимуществ и характеристики только из locked phrases («много текста», без собственных формулировок). ${lock}`
        : `Плотность текста: высокая — только locked phrases пользователя, без выдуманных преимуществ и характеристик. ${lock}`,
    infographic: opts?.suppressInfographicInstructions
      ? `Плотность текста: структурированная подача; текст только из locked phrases. ${lock}`
      : `Плотность текста: инфографика — плашки, иконки, выноски; текст только из locked phrases. ${lock}`,
  };
  return body[id] ?? `Плотность текста: ${label}. ${lock}`;
}

export function buildCardBuilderInstructionSnippet(input: {
  slideRole: string;
  rawSalesStyle: string;
  rawTextDensity: string;
  rawVisualStyle?: string;
  categoryKey?: string;
  productFacts: readonly CardBuilderProductFact[];
  exactTextPhrases: string[];
}): { snippet: string; effective: ReturnType<typeof computeEffectiveCardBuilderSettingsForSlide> } {
  const effective = computeEffectiveCardBuilderSettingsForSlide(input);
  const parts = [
    ...effective.slideRoleConstraintLines,
    getSalesStyleInstruction(effective.effectiveSalesStyle, {
      suppressInfographicInstructions: effective.suppressInfographicInstructions,
      suppressBadgeCalloutInstructions: effective.suppressBadgeCalloutInstructions,
    }),
    getTextDensityInstruction(effective.effectiveTextDensity, {
      suppressHeavyTextInstructions: effective.suppressHeavyTextInstructions,
      suppressInfographicInstructions: effective.suppressInfographicInstructions,
      exactTextPhraseCount: input.exactTextPhrases.length,
      allowBenefitLanguage: effective.allowBenefitLanguage,
    }),
  ].filter(Boolean);
  return { snippet: parts.join("\n"), effective };
}
