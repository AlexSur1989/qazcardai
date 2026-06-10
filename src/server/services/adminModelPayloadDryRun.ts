import type { AiModel } from "@/generated/prisma/client";
import { isRecord } from "@/lib/model-pricing-shared";
import { defaultsFromSchema } from "@/lib/generation-form-settings-schema";
import { prisma } from "@/lib/prisma";
import {
  buildAdminModelKieInput,
  type AdminModelTestInput,
} from "@/server/services/adminModelTest";

export const DRY_RUN_FAKE_PRODUCT_IMAGE_URL =
  "https://app.qazcardai.kz/uploads/dry-run/product-card-sample.jpg";

export const DRY_RUN_DEFAULT_PROMPT =
  "Dry-run: sample product photo for marketplace card generation";

const IMAGE_MAPPING_KEYS = new Set([
  "input_urls",
  "image_urls",
  "image_url",
  "input_image",
  "input_images",
  "url",
  "first_frame_url",
  "first_clip_url",
]);

function mappingHasImageInput(model: AiModel): boolean {
  const pm = model.payloadMapping;
  if (!isRecord(pm)) return false;
  const input = pm.input;
  if (!isRecord(input)) return false;
  return Object.keys(input).some((k) => IMAGE_MAPPING_KEYS.has(k));
}

function mappingHasPrompt(model: AiModel): boolean {
  const pm = model.payloadMapping;
  if (!isRecord(pm)) return false;
  if (pm.adapter === "market-create-task") {
    return true;
  }
  const input = pm.input;
  if (!isRecord(input)) return false;
  return "prompt" in input || Object.values(input).some((v) => v === "$prompt");
}

function isPlaceholderApiModelId(apiModelId: string): boolean {
  const t = apiModelId.trim().toUpperCase();
  return t === "PLACEHOLDER" || t === "CHANGE_ME" || t.startsWith("PASTE_");
}

export function collectGptImage2ResolutionWarnings(
  apiModelId: string,
  settings: Record<string, unknown>,
): string[] {
  if (
    apiModelId !== "gpt-image-2-text-to-image" &&
    apiModelId !== "gpt-image-2-image-to-image"
  ) {
    return [];
  }

  const warnings: string[] = [];
  const resolution = String(settings.resolution ?? "").trim();
  const rawAspect = settings.aspectRatio;
  const aspectMissing =
    rawAspect === undefined ||
    rawAspect === null ||
    String(rawAspect).trim() === "";
  const aspectRatio = aspectMissing ? "" : String(rawAspect).trim();

  if (aspectRatio === "1:1" && resolution === "4K") {
    warnings.push("GPT Image 2: 1:1 does not support 4K.");
  }
  if (aspectRatio === "auto" && resolution && resolution !== "1K") {
    warnings.push("GPT Image 2: auto aspect_ratio should use only 1K.");
  }
  if (aspectMissing && resolution && resolution !== "1K") {
    warnings.push("GPT Image 2: missing aspect_ratio should use only 1K.");
  }

  return warnings;
}

const CRITICAL_DRY_RUN_WARNING_PATTERNS = [
  /^missing apiModelId$/,
  /^apiModelId is PLACEHOLDER$/,
  /^missing endpoint$/,
  /^empty payloadMapping$/,
  /^payloadMapping\.input missing$/,
  /^no prompt mapping$/,
  /^no image input mapping$/,
  /^productCardModelType requires supportsImageInput/,
  /^costCredits must be greater than 0$/,
  /^pricingSchema missing$/,
  /^empty settingsSchema$/,
  /^dry-run payload missing model$/,
  /^dry-run payload missing input\.prompt$/,
  /^dry-run payload input\.input_urls is not an array$/,
  /^dry-run payload missing input\.input_urls$/,
];

export function isCriticalModelDryRunWarning(warning: string): boolean {
  return CRITICAL_DRY_RUN_WARNING_PATTERNS.some((re) => re.test(warning));
}

export function validateDryRunPayloadShape(
  payload: unknown,
  model: Pick<AiModel, "apiModelId" | "supportsImageInput">,
): string[] {
  const warnings: string[] = [];
  if (!isRecord(payload)) {
    warnings.push("dry-run payload is not an object");
    return warnings;
  }

  const modelId = String(payload.model ?? "").trim();
  if (!modelId) {
    warnings.push("dry-run payload missing model");
  } else if (modelId !== model.apiModelId.trim()) {
    warnings.push(
      `dry-run payload model mismatch: ${modelId} !== ${model.apiModelId}`,
    );
  }

  const input = payload.input;
  if (!isRecord(input)) {
    warnings.push("dry-run payload missing input object");
    return warnings;
  }

  if (!String(input.prompt ?? "").trim()) {
    warnings.push("dry-run payload missing input.prompt");
  }

  if (model.supportsImageInput) {
    const hasImageField =
      "input_urls" in input ||
      "image_urls" in input ||
      "image_url" in input ||
      "first_frame_url" in input ||
      "first_clip_url" in input;
    if (!hasImageField) {
      warnings.push("dry-run payload missing input.input_urls");
    }
    if ("input_urls" in input && !Array.isArray(input.input_urls)) {
      warnings.push("dry-run payload input.input_urls is not an array");
    }
    if (
      "first_frame_url" in input &&
      !String(input.first_frame_url ?? "").trim()
    ) {
      warnings.push("dry-run payload missing input.first_frame_url");
    }
  }

  return warnings;
}

export function collectModelDryRunWarnings(model: AiModel): string[] {
  const warnings: string[] = [];

  if (!model.apiModelId?.trim()) {
    warnings.push("missing apiModelId");
  } else if (isPlaceholderApiModelId(model.apiModelId)) {
    warnings.push("apiModelId is PLACEHOLDER");
  }

  if (!model.endpoint?.trim()) {
    warnings.push("missing endpoint");
  }

  if (!model.isActive) {
    warnings.push("inactive model");
  }

  const pm = model.payloadMapping;
  if (!isRecord(pm) || Object.keys(pm).length === 0) {
    warnings.push("empty payloadMapping");
  } else if (!isRecord(pm.input) || Object.keys(pm.input).length === 0) {
    warnings.push("payloadMapping.input missing");
  }

  const ss = model.settingsSchema;
  if (!isRecord(ss) || (Array.isArray(ss.fields) && ss.fields.length === 0)) {
    warnings.push("empty settingsSchema");
  }

  if (!mappingHasPrompt(model)) {
    warnings.push("no prompt mapping");
  }

  if (model.supportsImageInput && !mappingHasImageInput(model)) {
    warnings.push("no image input mapping");
  }

  if (
    model.productCardModelType === "PRODUCT_MARKETPLACE_CARD" &&
    !model.supportsImageInput
  ) {
    warnings.push(
      "productCardModelType requires supportsImageInput but supportsImageInput=false",
    );
  }

  if (model.costCredits <= 0) {
    warnings.push("costCredits must be greater than 0");
  }

  const ps = model.pricingSchema;
  if (!isRecord(ps) || Object.keys(ps).length === 0) {
    warnings.push("pricingSchema missing");
  }

  return warnings;
}

export async function loadAiModelForAdminDryRun(modelId: string) {
  return prisma.aiModel.findUnique({ where: { id: modelId } });
}

export async function buildDryRunKiePayloadForModel(
  model: AiModel,
  input?: Partial<AdminModelTestInput>,
): Promise<
  | { ok: true; payload: unknown; warnings: string[]; costCredits: number }
  | { ok: false; error: string }
> {
  const warnings = collectModelDryRunWarnings(model);

  const schemaDefaults = defaultsFromSchema(model.settingsSchema);
  const testInput: AdminModelTestInput = {
    prompt: input?.prompt?.trim() || DRY_RUN_DEFAULT_PROMPT,
    settings: { ...schemaDefaults, ...(input?.settings ?? {}) },
    inputFiles:
      input?.inputFiles ??
      (model.supportsImageInput ? [DRY_RUN_FAKE_PRODUCT_IMAGE_URL] : undefined),
    negativePrompt: input?.negativePrompt ?? null,
    aspectRatio: input?.aspectRatio,
    resolution: input?.resolution,
    seed: input?.seed,
    durationSec: input?.durationSec,
  };

  const built = await buildAdminModelKieInput({
    model,
    input: testInput,
    checkMotionUrlOwnership: false,
  });

  if (!("kind" in built)) {
    return { ok: false, error: built.error };
  }

  const gptWarnings = collectGptImage2ResolutionWarnings(
    model.apiModelId,
    testInput.settings,
  );
  const payloadWarnings = validateDryRunPayloadShape(built.payload, model);

  return {
    ok: true,
    payload: built.payload,
    warnings: [...warnings, ...built.warnings, ...gptWarnings, ...payloadWarnings],
    costCredits: built.costCredits,
  };
}
