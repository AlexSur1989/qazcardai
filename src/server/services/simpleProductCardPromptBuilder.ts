import type { SimpleProductCardPromptsSetting } from "@/config/simple-product-card-prompts-defaults";
import type { SimpleCardAspectRatio, SimpleCardStyleMode } from "@/config/simple-product-card";
import {
  SIMPLE_CARD_CREATIVITY_NOT_APPLICABLE,
  SIMPLE_CARD_LAYOUT_PRIORITY_NOTE,
} from "@/lib/simple-product-card-mega-prompt-template";
import {
  buildExactRenderTextBlock,
  buildMeasurementVisualInstructions,
  exactTextPhrasesFromParsedContent,
  formatUserProvidedContentBlock,
  hasConfirmedMeasurements,
  hasConfirmedSpecs,
  parseSimpleProductCardContent,
  type SimpleProductCardParsedContent,
} from "@/lib/simple-product-card-parsed-content";
import {
  creativityInstructionFromValue,
  type SimpleCardSemanticText,
} from "@/lib/simple-product-card-user-text";
import { simpleCardUsesReference, type SimpleProductCardRequest } from "@/lib/validations/simple-product-card";

export type SimpleProductCardPromptBuildInput = {
  payload: SimpleProductCardRequest;
  prompts: SimpleProductCardPromptsSetting;
  aspectRatio: SimpleCardAspectRatio;
};

export type SimpleProductCardPromptBuildResult = {
  prompt: string;
  negativePrompt: string;
  styleMode: SimpleCardStyleMode;
  usesReference: boolean;
  structuredText: SimpleCardSemanticText;
  parsedContent: SimpleProductCardParsedContent;
  exactTextPhrases: string[];
  creativityInstruction: string | null;
  hasDimensionsOrSpecs: boolean;
};

function fillTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return out;
}

function pickStyleTemplate(
  prompts: SimpleProductCardPromptsSetting,
  styleMode: SimpleCardStyleMode,
  usesReference: boolean,
): string {
  if (styleMode === "premium") return prompts.promptPremium;
  if (styleMode === "reference") return prompts.promptReference;
  if (usesReference) return prompts.promptClassicWithReference;
  return prompts.promptClassic;
}

function pickReferenceRules(
  prompts: SimpleProductCardPromptsSetting,
  styleMode: SimpleCardStyleMode,
  usesReference: boolean,
): string {
  if (styleMode === "premium") return prompts.referenceRulesPremium;
  if (styleMode === "reference") return prompts.referenceRulesReference;
  if (usesReference) return prompts.referenceRulesClassicWithRef;
  return prompts.referenceRulesClassicNoRef;
}

function styleSpecificVisualRules(
  styleMode: SimpleCardStyleMode,
  usesReference: boolean,
  content: SimpleProductCardParsedContent,
): string {
  const hasMeas = hasConfirmedMeasurements(content.measurements);
  const hasSpecs = hasConfirmedSpecs(content.specs);

  if (styleMode === "premium") {
    return [
      "Premium style: elegant light, premium background, subtle gradients, luxury-like typography.",
      hasMeas
        ? "Show measurements with thin elegant lines, glass-like labels, refined spacing."
        : "Do not add measurement lines without confirmed measurements.",
      hasSpecs
        ? "Show specs as refined premium badges or minimalist spec panel."
        : "Do not add spec badges without confirmed specs.",
    ].join("\n");
  }

  if (styleMode === "reference" || usesReference) {
    return [
      "Match reference mood for background, colors and composition rhythm.",
      hasMeas
        ? "Integrate measurement lines into the reference-inspired style while keeping labels readable."
        : "Do not copy unconfirmed numbers from the reference image.",
      "Accuracy and readability are more important than exact reference copying.",
    ].join("\n");
  }

  return [
    "Classic marketplace style: clean background, readable typography, simple panels/badges.",
    hasMeas
      ? "Use clean marketplace infographic measurement lines with thin arrows and rounded labels."
      : "Do not show ruler lines if no measurements are provided.",
    hasSpecs
      ? "Use compact spec badges or a clean specs panel — not dimension lines for volume/weight/power."
      : "Do not invent spec badges.",
  ].join("\n");
}

function parsedToSemanticLegacy(content: SimpleProductCardParsedContent): SimpleCardSemanticText {
  const dimensions = [
    content.measurements.width && { label: "Width", value: content.measurements.width, raw: "" },
    content.measurements.height && { label: "Height", value: content.measurements.height, raw: "" },
    content.measurements.depth && { label: "Depth", value: content.measurements.depth, raw: "" },
    content.measurements.length && { label: "Length", value: content.measurements.length, raw: "" },
    content.measurements.diameter && { label: "Diameter", value: content.measurements.diameter, raw: "" },
    content.measurements.thickness && { label: "Thickness", value: content.measurements.thickness, raw: "" },
  ].filter(Boolean) as Array<{ label: string; value: string; raw: string }>;

  const specs = [
    content.specs.volume && { label: "Volume", value: content.specs.volume, raw: "" },
    content.specs.weight && { label: "Weight", value: content.specs.weight, raw: "" },
    content.specs.power && { label: "Power", value: content.specs.power, raw: "" },
    content.specs.capacity && { label: "Capacity", value: content.specs.capacity, raw: "" },
    content.specs.battery && { label: "Battery", value: content.specs.battery, raw: "" },
    content.specs.memory && { label: "Memory", value: content.specs.memory, raw: "" },
    ...(content.specs.connectivity ?? []).map((c) => ({ label: "Connectivity", value: c, raw: c })),
    ...(content.specs.other ?? []).map((o) => ({ label: "Spec", value: o, raw: o })),
  ].filter(Boolean) as Array<{ label: string; value: string; raw: string }>;

  const offerParts = [
    content.offer.price,
    content.offer.discount,
    content.offer.promo,
    content.offer.deadline,
    content.offer.gift,
  ].filter(Boolean) as string[];

  return {
    headline: content.headline ?? null,
    subtitle: content.subtitle ?? null,
    benefits: content.benefits,
    dimensions,
    specs,
    materials: content.materials,
    packageKit: content.packageContents,
    usage: [...content.usageSteps, ...content.targetAudience],
    offerPromo: offerParts,
    otherText: [...content.delivery, ...content.warrantyTrust, ...content.otherPhrases],
    raw: "",
    hasDimensionsOrSpecs: dimensions.length > 0 || specs.length > 0,
  };
}

function imageInputBlock(usesReference: boolean): string {
  if (usesReference) {
    return `Image inputs:
Image A = main product image (product identity source of truth).
Image B = style reference image (style/composition reference only).
Use the first image as the actual product.
Use the second image only as a design/style reference: background, layout, composition, typography mood, lighting and visual presentation.
Do not replace the product with objects from the reference image.
Keep the product identity from the first image.`;
  }
  return `Image input:
Image A = main product image (product identity source of truth).`;
}

export function buildSimpleProductCardPrompt(
  input: SimpleProductCardPromptBuildInput,
): SimpleProductCardPromptBuildResult {
  const { payload, prompts } = input;
  const usesReference = simpleCardUsesReference(payload);

  const parsed = parseSimpleProductCardContent(payload.userText, {
    maxBenefits: prompts.maxBenefits ?? prompts.maxKeyPhrases,
    maxSpecs: prompts.maxSpecs,
    maxPackageItems: prompts.maxPackageItems,
    maxUsageSteps: prompts.maxUsageSteps,
  });

  const creativityInstruction = usesReference
    ? creativityInstructionFromValue(payload.referenceCreativity, prompts.creativityBands)
    : SIMPLE_CARD_CREATIVITY_NOT_APPLICABLE;

  let styleBlock = pickStyleTemplate(prompts, payload.styleMode, usesReference);
  if (usesReference && creativityInstruction) {
    styleBlock = styleBlock.replace(/\{\{creativity_instruction\}\}/g, creativityInstruction);
  }

  const userProvidedContent = formatUserProvidedContentBlock(parsed);
  const measurementVisualInstructions = buildMeasurementVisualInstructions(parsed.measurements);
  const exactRenderText = buildExactRenderTextBlock(parsed);

  const megaBody = fillTemplate(prompts.megaPromptTemplate, {
    styleMode: payload.styleMode,
    stylePrompt: styleBlock,
    referenceRules: pickReferenceRules(prompts, payload.styleMode, usesReference),
    creativityInstruction,
    userProvidedContent,
    measurementVisualInstructions,
    exactRenderText,
    styleSpecificVisualRules: styleSpecificVisualRules(
      payload.styleMode,
      usesReference,
      parsed,
    ),
    aspectRatio: input.aspectRatio,
    layoutPriorityNote: SIMPLE_CARD_LAYOUT_PRIORITY_NOTE,
  });

  const parts = [
    imageInputBlock(usesReference),
    megaBody,
    hasConfirmedMeasurements(parsed.measurements) || hasConfirmedSpecs(parsed.specs)
      ? prompts.dimensionsPrompt
      : "",
    prompts.negativePrompt,
  ].filter(Boolean);

  const exactPhrases = exactTextPhrasesFromParsedContent(parsed);
  const structured = parsedToSemanticLegacy(parsed);
  structured.raw = payload.userText;

  return {
    prompt: parts.join("\n\n"),
    negativePrompt: prompts.negativePrompt,
    styleMode: payload.styleMode,
    usesReference,
    structuredText: structured,
    parsedContent: parsed,
    exactTextPhrases: exactPhrases.slice(0, prompts.maxTextBlocks),
    creativityInstruction: usesReference ? creativityInstruction : null,
    hasDimensionsOrSpecs: structured.hasDimensionsOrSpecs,
  };
}
