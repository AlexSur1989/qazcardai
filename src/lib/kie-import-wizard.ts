/**
 * Kie.ai Import Wizard — parse docs payload, auto-detect settingsSchema + payloadMapping.
 */

import type { KiePayloadMapping } from "@/server/services/kiePayloadMapping";

export type KieImportBasics = {
  name: string;
  slug: string;
  scope: "GENERAL" | "PRODUCT_CARD";
  type: "IMAGE" | "VIDEO";
  productCardModelType:
    | "PRODUCT_CLASSIFIER"
    | "PRODUCT_CONCEPT_IMAGE"
    | "PRODUCT_MARKETPLACE_CARD"
    | "PRODUCT_VIDEO"
    | null;
  apiModelId: string;
  endpoint: string;
  statusEndpoint: string;
};

export type KieImportDetected = {
  settingsSchema: Record<string, unknown>;
  payloadMapping: KiePayloadMapping;
  supportsImageInput: boolean;
  supportsVideoInput: boolean;
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  detectedFields: string[];
};

const KIE_TO_SETTINGS: Record<
  string,
  {
    settingsName: string;
    type: string;
    label: string;
    mappingExpr: string;
    coerce?: "string" | "number" | "boolean" | "stringArray";
  }
> = {
  aspect_ratio: {
    settingsName: "aspectRatio",
    type: "select",
    label: "Соотношение сторон",
    mappingExpr: "$settings.aspectRatio",
  },
  resolution: {
    settingsName: "resolution",
    type: "select",
    label: "Разрешение",
    mappingExpr: "$settings.resolution",
  },
  size: {
    settingsName: "size",
    type: "select",
    label: "Размер",
    mappingExpr: "$settings.size",
  },
  duration: {
    settingsName: "duration",
    type: "number",
    label: "Длительность (сек)",
    mappingExpr: "$settings.duration",
    coerce: "number",
  },
  negative_prompt: {
    settingsName: "negativePrompt",
    type: "textarea",
    label: "Negative prompt",
    mappingExpr: "$settings.negativePrompt",
  },
  seed: {
    settingsName: "seed",
    type: "number",
    label: "Seed",
    mappingExpr: "$settings.seed",
    coerce: "number",
  },
  input_urls: {
    settingsName: "inputUrls",
    type: "upload-list",
    label: "Input URLs",
    mappingExpr: "$inputFiles",
    coerce: "stringArray",
  },
  image_urls: {
    settingsName: "imageUrls",
    type: "upload-list",
    label: "Image URLs",
    mappingExpr: "$inputFiles",
    coerce: "stringArray",
  },
  image_url: {
    settingsName: "imageUrl",
    type: "image-upload",
    label: "Image URL",
    mappingExpr: "$inputFiles",
  },
  input_image: {
    settingsName: "inputImage",
    type: "image-upload",
    label: "Input image",
    mappingExpr: "$inputFiles",
  },
  input_images: {
    settingsName: "inputImages",
    type: "upload-list",
    label: "Input images",
    mappingExpr: "$inputFiles",
    coerce: "stringArray",
  },
  url: {
    settingsName: "sourceUrl",
    type: "image-upload",
    label: "Source URL",
    mappingExpr: "$inputFiles",
  },
};

export const KIE_IMAGE_INPUT_KEYS = new Set([
  "input_urls",
  "image_urls",
  "image_url",
  "input_image",
  "input_images",
  "url",
]);

export function isKieImageInputField(key: string): boolean {
  return KIE_IMAGE_INPUT_KEYS.has(key);
}

export const MARKETPLACE_CARD_IMPORT_HINT =
  "Для карточки товара модель должна поддерживать image input. Обычно нужен image-to-image режим.";

export const MARKETPLACE_CARD_NO_IMAGE_FIELD_WARNING =
  "В payload не найдено поле для изображения. Для PRODUCT_MARKETPLACE_CARD это может быть ошибкой.";

const SKIP_INPUT_KEYS = new Set(["prompt", "callBackUrl", "callbackUrl"]);

export function parseKiePayloadJson(raw: string):
  | { ok: true; parsed: unknown; input: Record<string, unknown> }
  | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Вставьте JSON из документации Kie.ai" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return {
      ok: false,
      error: "Невалидный JSON. Проверьте скобки, кавычки и запятые.",
    };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "JSON должен быть объектом (тело createTask или input)" };
  }
  const obj = parsed as Record<string, unknown>;
  let input: Record<string, unknown>;
  if (obj.input && typeof obj.input === "object" && !Array.isArray(obj.input)) {
    input = obj.input as Record<string, unknown>;
  } else {
    input = obj;
  }
  return { ok: true, parsed, input };
}

export function detectFieldsFromKieInput(
  input: Record<string, unknown>,
): KieImportDetected {
  const fields: Array<Record<string, unknown>> = [];
  const mappingInput: Record<string, string | number | boolean | null> = {};
  const coerce: Record<string, "string" | "number" | "boolean" | "stringArray"> =
    {};
  const detectedFields: string[] = [];

  let supportsImageInput = false;
  let supportsVideoInput = false;
  let supportsNegativePrompt = false;
  let supportsSeed = false;

  for (const kieKey of Object.keys(input)) {
    detectedFields.push(kieKey);
    if (SKIP_INPUT_KEYS.has(kieKey)) continue;

    const rule = KIE_TO_SETTINGS[kieKey];
    if (!rule) continue;

    fields.push({
      name: rule.settingsName,
      type: rule.type,
      label: rule.label,
    });
    mappingInput[kieKey] = rule.mappingExpr;
    if (rule.coerce) {
      coerce[kieKey] = rule.coerce;
    }

    if (isKieImageInputField(kieKey)) {
      supportsImageInput = true;
    }
    if (kieKey === "negative_prompt") supportsNegativePrompt = true;
    if (kieKey === "seed") supportsSeed = true;
    if (kieKey === "duration") supportsVideoInput = true;
  }

  const payloadMapping: KiePayloadMapping = {
    adapter: "market-create-task",
    input: mappingInput,
    omitNull: true,
    ...(Object.keys(coerce).length > 0 ? { coerce } : {}),
  };

  return {
    settingsSchema: { fields },
    payloadMapping,
    supportsImageInput,
    supportsVideoInput,
    supportsNegativePrompt,
    supportsSeed,
    detectedFields,
  };
}

export function buildFixedPricingSchema(credits: number): Record<string, unknown> {
  const c = Math.max(0, Math.floor(credits));
  return { type: "fixed", credits: c };
}

export function getImportDetectWarnings(
  input: Record<string, unknown>,
  detected: KieImportDetected,
  productCardModelType: KieImportBasics["productCardModelType"],
): string[] {
  const warnings: string[] = [];
  const hasImageField = detected.detectedFields.some(isKieImageInputField);

  if (productCardModelType === "PRODUCT_MARKETPLACE_CARD") {
    if (!hasImageField) {
      warnings.push(MARKETPLACE_CARD_NO_IMAGE_FIELD_WARNING);
    }
    if (!detected.supportsImageInput) {
      warnings.push(MARKETPLACE_CARD_IMPORT_HINT);
    }
  }

  void input;
  return warnings;
}

export function buildImportMetadata(args: {
  rawPayloadExample: unknown;
  detectedFields: string[];
  docsUrl?: string;
  productCardModelType?: KieImportBasics["productCardModelType"];
  importWarnings?: string[];
}): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    source: "kie import wizard",
    docsUrl: args.docsUrl?.trim() || "",
    docsCheckedAt: new Date().toISOString().slice(0, 10),
    rawPayloadExample: args.rawPayloadExample,
    importDetectedFields: args.detectedFields,
    publicReady: false,
  };

  if (args.productCardModelType === "PRODUCT_MARKETPLACE_CARD") {
    meta.purpose = "product_marketplace_card";
    meta.ownerHint = "Use for product photo → marketplace card generation";
  }

  if (args.importWarnings?.length) {
    meta.importWarnings = args.importWarnings;
  }

  return meta;
}

export function resolveImportSupportsImageInput(
  detected: KieImportDetected,
  productCardModelType: KieImportBasics["productCardModelType"],
): boolean {
  if (productCardModelType === "PRODUCT_MARKETPLACE_CARD") {
    return true;
  }
  return detected.supportsImageInput;
}
