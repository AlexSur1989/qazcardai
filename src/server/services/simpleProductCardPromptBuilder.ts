import type { SimpleProductCardPromptsSetting } from "@/config/simple-product-card-prompts-defaults";
import type { SimpleCardAspectRatio, SimpleCardStyleMode } from "@/config/simple-product-card";
import {
  creativityInstructionFromValue,
  exactTextPhrasesFromSemantic,
  formatConfirmedDimensionsBlock,
  formatStructuredUserTextForPrompt,
  NO_DIMENSIONS_RULE,
  parseSimpleCardUserText,
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
  exactTextPhrases: string[];
  creativityInstruction: string | null;
  hasDimensionsOrSpecs: boolean;
};

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

export function buildSimpleProductCardPrompt(
  input: SimpleProductCardPromptBuildInput,
): SimpleProductCardPromptBuildResult {
  const { payload, prompts } = input;
  const usesReference = simpleCardUsesReference(payload);
  const structured = parseSimpleCardUserText(payload.userText, prompts.maxKeyPhrases);
  const creativityInstruction = usesReference
    ? creativityInstructionFromValue(payload.referenceCreativity, prompts.creativityBands)
    : null;

  let styleBlock = pickStyleTemplate(prompts, payload.styleMode, usesReference);
  if (creativityInstruction) {
    styleBlock = styleBlock.replace(/\{\{creativity_instruction\}\}/g, creativityInstruction);
  }

  const imageBlock = usesReference
    ? `Image inputs:
Image A = main product image (product identity source of truth).
Image B = style reference image (style/composition reference only).`
    : `Image input:
Image A = main product image (product identity source of truth).`;

  const userTextBlock = formatStructuredUserTextForPrompt(structured);
  const confirmedDimensions = formatConfirmedDimensionsBlock(structured);

  const dimensionsBlock = structured.hasDimensionsOrSpecs
    ? [prompts.dimensionsPrompt, confirmedDimensions].filter(Boolean).join("\n\n")
    : NO_DIMENSIONS_RULE;

  const parts = [
    prompts.globalRules,
    styleBlock,
    imageBlock,
    `Selected aspect ratio: ${input.aspectRatio}.`,
    dimensionsBlock,
    `User text (use only this text, do not invent features):\n${userTextBlock}`,
    prompts.preserveProductIdentity
      ? "Preserve product identity from Image A exactly."
      : "",
    prompts.negativePrompt,
  ].filter(Boolean);

  const exactPhrases = exactTextPhrasesFromSemantic(structured);

  return {
    prompt: parts.join("\n\n"),
    negativePrompt: prompts.negativePrompt,
    styleMode: payload.styleMode,
    usesReference,
    structuredText: structured,
    exactTextPhrases: exactPhrases.slice(0, prompts.maxTextBlocks),
    creativityInstruction,
    hasDimensionsOrSpecs: structured.hasDimensionsOrSpecs,
  };
}
