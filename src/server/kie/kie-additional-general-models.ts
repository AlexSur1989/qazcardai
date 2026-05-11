import type { KiePayloadMapping } from "@/server/services/kiePayloadMapping";

import {
  GENERAL_PHASE1_DOCS_CHECKED_AT,
  KIE_METADATA_SOURCE_LINE,
} from "@/server/kie/general-phase1-models";

type AdditionalKieModel = {
  slug: string;
  name: string;
  type: "IMAGE" | "VIDEO";
  apiModelId: string;
  supportsImageInput: boolean;
  supportsVideoInput: boolean;
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  maxDuration: number | null;
  metadata: Record<string, unknown>;
  description: string;
  availableAspectRatios: string[];
  availableResolutions: string[];
  settingsSchema: Record<string, unknown>;
  payloadMapping: KiePayloadMapping;
  pricingSchema: Record<string, unknown>;
  costCredits: number;
  realCost: number | null;
};

const ENDPOINT = "/api/v1/jobs/createTask";
const STATUS_ENDPOINT = "/api/v1/jobs/recordInfo";

const RATIO_IMAGE = ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"];
const RATIO_IMAGE_AUTO = [...RATIO_IMAGE, "auto"];
const RATIO_GROK = ["2:3", "3:2", "1:1", "16:9", "9:16"];
/** Flux 2 Flex (docs.kie.ai/market/flux2/*): в T2I enum без auto; в I2I есть auto */
const FLUX_FLEX_IMAGE_ASPECT = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"] as const;
const FLUX_FLEX_I2I_ASPECT = [...FLUX_FLEX_IMAGE_ASPECT, "auto"] as const;
const RATIO_VIDEO = ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "adaptive"];
const IMAGE_SIZE = ["square", "square_hd", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"];

export const ADDITIONAL_KIE_GENERAL_SLUG_ORDER = [
  "seedance-2-0-text-to-video",
  "seedance-2-0-image-to-video",
  "seedance-2-0-fast-text-to-video",
  "seedance-2-0-fast-image-to-video",
  "nano-banana-2-text-to-image",
  "nano-banana-2-image-to-image",
  "nano-banana-pro-image-to-image",
  "seedream-5-lite-image-to-image",
  "seedream-4-5-text-to-image",
  "seedream-4-5-edit",
  "flux-2-flex-text-to-image",
  "flux-2-flex-image-to-image",
  "grok-imagine-text-to-image",
  "grok-imagine-image-to-image",
  "grok-imagine-text-to-video",
  "grok-imagine-image-to-video",
  "qwen-text-to-image",
  "qwen2-image-edit",
  "ideogram-v3-edit",
  "ideogram-v3-remix",
] as const;

function pricing(providerModel: string, defaultCredits: number): Record<string, unknown> {
  return {
    type: "fixed_by_model_costCredits",
    provider: "KIE_AI",
    providerModel,
    defaultCredits,
    fallbackCredits: defaultCredits,
    pricingNeedsReview: true,
    note: "Hidden by publicReady=false until kie.ai/pricing is manually verified.",
  };
}

function meta(
  family: string,
  mode: string,
  docsUrl: string,
  playgroundUrl?: string,
): Record<string, unknown> {
  return {
    docsUrl,
    playgroundUrl,
    docsCheckedAt: GENERAL_PHASE1_DOCS_CHECKED_AT,
    source: KIE_METADATA_SOURCE_LINE,
    kieModelFamily: family,
    kieMode: mode,
    endpoint: ENDPOINT,
    statusEndpoint: STATUS_ENDPOINT,
    publicReady: false,
    requiresManualKieTest: true,
    pricingNeedsReview: true,
    reason: "Added as admin-only concrete Kie mode until pricing, admin preview and real Kie test pass.",
  };
}

function selectField(name: string, label: string, options: readonly string[], defaultValue: string, required = true) {
  return {
    name,
    label,
    type: "select",
    required,
    defaultValue,
    options: options.map((value) => ({ label: value, value })),
  };
}

const boolField = (name: string, label: string, defaultValue: boolean) => ({
  name,
  label,
  type: "boolean",
  required: false,
  defaultValue,
});

const seedField = {
  name: "seed",
  label: "Seed",
  type: "number",
  required: false,
  min: 0,
  max: 2147483647,
  step: 1,
};

const negativePromptField = {
  name: "negativePrompt",
  label: "Negative prompt",
  type: "textarea",
  required: false,
};

function uploadList(name: string, label: string, variant: "image" | "video" | "audio", maxItems: number, required: boolean) {
  return {
    name,
    label,
    type: `${variant}-upload-list`,
    required,
    maxItems,
    accept: `${variant}/*`,
    purpose: "generation_input",
  };
}

function imageGenSettings(maxImages: number, requiredImages: boolean, ratios = RATIO_IMAGE_AUTO) {
  return {
    version: 1,
    fields: [
      uploadList("imageInput", "Input images", "image", maxImages, requiredImages),
      selectField("aspectRatio", "Формат", ratios, ratios.includes("auto") ? "auto" : ratios[0]!),
      selectField("resolution", "Разрешение", ["1K", "2K", "4K"], "1K"),
      selectField("outputFormat", "Формат файла", ["png", "jpg"], "png"),
    ],
  } satisfies Record<string, unknown>;
}

function imageGenPayload(requiredImages: boolean): KiePayloadMapping {
  return {
    adapter: "market-create-task",
    omitNull: true,
    required: requiredImages ? ["image_input"] : [],
    input: {
      image_input: "$settings.imageInput",
      aspect_ratio: "$settings.aspectRatio",
      resolution: "$settings.resolution",
      output_format: "$settings.outputFormat",
    },
    coerce: {
      image_input: "stringArray",
      aspect_ratio: "string",
      resolution: "string",
      output_format: "string",
    },
  };
}

function seedanceSettings(imageMode: boolean, fast: boolean) {
  return {
    version: 1,
    fields: [
      ...(imageMode
        ? [
            uploadList("firstFrameUrl", "First frame", "image", 1, true),
            uploadList("lastFrameUrl", "Last frame", "image", 1, false),
            uploadList("referenceImageUrls", "Reference images", "image", 9, false),
            uploadList("referenceVideoUrls", "Reference videos", "video", 3, false),
            uploadList("referenceAudioUrls", "Reference audios", "audio", 3, false),
          ]
        : []),
      boolField("returnLastFrame", "Return last frame", false),
      boolField("generateAudio", "Generate audio", false),
      selectField("resolution", "Разрешение", fast ? ["480p", "720p"] : ["480p", "720p", "1080p"], "720p"),
      selectField("aspectRatio", "Формат", RATIO_VIDEO, "16:9"),
      { name: "duration", label: "Длительность", type: "number", required: true, defaultValue: 5, min: 4, max: 15, step: 1 },
      boolField("webSearch", "Web search", false),
      boolField("nsfwChecker", "NSFW checker", false),
    ],
  } satisfies Record<string, unknown>;
}

function seedancePayload(imageMode: boolean): KiePayloadMapping {
  return {
    adapter: "market-create-task",
    omitNull: true,
    required: imageMode ? ["first_frame_url", "resolution", "aspect_ratio", "duration"] : ["resolution", "aspect_ratio", "duration"],
    input: {
      first_frame_url: "$settings.firstFrameUrl.0",
      last_frame_url: "$settings.lastFrameUrl.0",
      reference_image_urls: "$settings.referenceImageUrls",
      reference_video_urls: "$settings.referenceVideoUrls",
      reference_audio_urls: "$settings.referenceAudioUrls",
      return_last_frame: "$settings.returnLastFrame",
      generate_audio: "$settings.generateAudio",
      resolution: "$settings.resolution",
      aspect_ratio: "$settings.aspectRatio",
      duration: "$settings.duration",
      web_search: "$settings.webSearch",
      nsfw_checker: "$settings.nsfwChecker",
    },
    coerce: {
      first_frame_url: "string",
      last_frame_url: "string",
      reference_image_urls: "stringArray",
      reference_video_urls: "stringArray",
      reference_audio_urls: "stringArray",
      return_last_frame: "boolean",
      generate_audio: "boolean",
      resolution: "string",
      aspect_ratio: "string",
      duration: "number",
      web_search: "boolean",
      nsfw_checker: "boolean",
    },
  };
}

const seedreamT2ISettings = {
  version: 1,
  fields: [
    selectField("aspectRatio", "Формат", RATIO_IMAGE, "1:1"),
    selectField("quality", "Качество", ["basic", "high"], "basic"),
    boolField("nsfwChecker", "NSFW checker", false),
  ],
} satisfies Record<string, unknown>;

const seedreamI2ISettings = {
  version: 1,
  fields: [
    uploadList("imageUrls", "Input images", "image", 14, true),
    ...seedreamT2ISettings.fields,
  ],
} satisfies Record<string, unknown>;

const seedreamT2IPayload: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["aspect_ratio", "quality"],
  input: {
    aspect_ratio: "$settings.aspectRatio",
    quality: "$settings.quality",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: { aspect_ratio: "string", quality: "string", nsfw_checker: "boolean" },
};

const seedreamI2IPayload: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["image_urls", "aspect_ratio", "quality"],
  input: {
    image_urls: "$settings.imageUrls",
    aspect_ratio: "$settings.aspectRatio",
    quality: "$settings.quality",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: { image_urls: "stringArray", aspect_ratio: "string", quality: "string", nsfw_checker: "boolean" },
};

const fluxFlexT2ISettings = {
  version: 1,
  fields: [
    selectField("aspectRatio", "Формат", FLUX_FLEX_IMAGE_ASPECT, "1:1"),
    selectField("resolution", "Разрешение", ["1K", "2K"], "1K"),
    boolField("nsfwChecker", "NSFW checker", false),
  ],
} satisfies Record<string, unknown>;

const fluxFlexT2IPayload: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["aspect_ratio", "resolution"],
  input: {
    aspect_ratio: "$settings.aspectRatio",
    resolution: "$settings.resolution",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: {
    aspect_ratio: "string",
    resolution: "string",
    nsfw_checker: "boolean",
  },
};

const fluxFlexI2ISettings = {
  version: 1,
  fields: [
    uploadList("inputUrls", "Входные изображения", "image", 8, true),
    selectField("aspectRatio", "Формат", FLUX_FLEX_I2I_ASPECT, "1:1"),
    selectField("resolution", "Разрешение", ["1K", "2K"], "1K"),
    boolField("nsfwChecker", "NSFW checker", false),
  ],
} satisfies Record<string, unknown>;

const fluxFlexI2IPayload: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["input_urls", "aspect_ratio", "resolution"],
  input: {
    input_urls: "$settings.inputUrls",
    aspect_ratio: "$settings.aspectRatio",
    resolution: "$settings.resolution",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: {
    input_urls: "stringArray",
    aspect_ratio: "string",
    resolution: "string",
    nsfw_checker: "boolean",
  },
};

const grokImageSettings = {
  version: 1,
  fields: [
    selectField("aspectRatio", "Формат", RATIO_GROK, "1:1"),
    boolField("nsfwChecker", "NSFW checker", false),
    boolField("enablePro", "Quality mode", false),
  ],
} satisfies Record<string, unknown>;

const grokT2IPayload: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  input: {
    aspect_ratio: "$settings.aspectRatio",
    nsfw_checker: "$settings.nsfwChecker",
    enable_pro: "$settings.enablePro",
  },
  coerce: { aspect_ratio: "string", nsfw_checker: "boolean", enable_pro: "boolean" },
};

const grokI2ISettings = {
  version: 1,
  fields: [
    uploadList("imageUrls", "Reference images", "image", 5, true),
    boolField("nsfwChecker", "NSFW checker", false),
  ],
} satisfies Record<string, unknown>;

const grokI2IPayload: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["image_urls"],
  input: {
    image_urls: "$settings.imageUrls",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: { image_urls: "stringArray", nsfw_checker: "boolean" },
};

const grokVideoSettings = {
  version: 1,
  fields: [
    selectField("aspectRatio", "Формат", RATIO_GROK, "2:3"),
    selectField("mode", "Mode", ["fun", "normal", "spicy"], "normal"),
    { name: "duration", label: "Длительность", type: "number", required: true, defaultValue: 6, min: 6, max: 30, step: 1 },
    selectField("resolution", "Разрешение", ["480p", "720p"], "480p"),
    boolField("nsfwChecker", "NSFW checker", false),
  ],
} satisfies Record<string, unknown>;

const grokT2VPayload: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  input: {
    aspect_ratio: "$settings.aspectRatio",
    mode: "$settings.mode",
    duration: "$settings.duration",
    resolution: "$settings.resolution",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: { aspect_ratio: "string", mode: "string", duration: "number", resolution: "string", nsfw_checker: "boolean" },
};

const grokI2VSettings = {
  version: 1,
  fields: [
    uploadList("imageUrls", "Reference images", "image", 7, true),
    ...grokVideoSettings.fields,
  ],
} satisfies Record<string, unknown>;

const grokI2VPayload: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["image_urls"],
  input: {
    image_urls: "$settings.imageUrls",
    mode: "$settings.mode",
    duration: "$settings.duration",
    resolution: "$settings.resolution",
    aspect_ratio: "$settings.aspectRatio",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: { image_urls: "stringArray", mode: "string", duration: "number", resolution: "string", aspect_ratio: "string", nsfw_checker: "boolean" },
};

function qwenT2ISettings() {
  return {
    version: 1,
    fields: [
      selectField("imageSize", "Размер", ["square", "square_hd", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"], "square_hd"),
      { name: "numInferenceSteps", label: "Steps", type: "number", required: false, defaultValue: 30, min: 2, max: 250, step: 1 },
      seedField,
      { name: "guidanceScale", label: "Guidance scale", type: "number", required: false, defaultValue: 2.5, min: 0, max: 20, step: 0.1 },
      boolField("enableSafetyChecker", "Safety checker", true),
      selectField("outputFormat", "Формат файла", ["png", "jpeg"], "png"),
      negativePromptField,
      selectField("acceleration", "Acceleration", ["none", "regular", "high"], "none"),
      boolField("nsfwChecker", "NSFW checker", false),
    ],
  } satisfies Record<string, unknown>;
}

const qwenT2IPayload: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  input: {
    image_size: "$settings.imageSize",
    num_inference_steps: "$settings.numInferenceSteps",
    seed: "$settings.seed",
    guidance_scale: "$settings.guidanceScale",
    enable_safety_checker: "$settings.enableSafetyChecker",
    output_format: "$settings.outputFormat",
    negative_prompt: "$settings.negativePrompt",
    acceleration: "$settings.acceleration",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: {
    image_size: "string",
    num_inference_steps: "number",
    seed: "number",
    guidance_scale: "number",
    enable_safety_checker: "boolean",
    output_format: "string",
    negative_prompt: "string",
    acceleration: "string",
    nsfw_checker: "boolean",
  },
};

const qwenEditSettings = {
  version: 1,
  fields: [
    uploadList("imageUrl", "Input image", "image", 1, true),
    selectField("imageSize", "Размер", ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"], "16:9"),
    seedField,
    selectField("outputFormat", "Формат файла", ["jpeg", "png"], "png"),
    boolField("nsfwChecker", "NSFW checker", false),
  ],
} satisfies Record<string, unknown>;

const qwenEditPayload: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["image_url"],
  input: {
    image_url: "$settings.imageUrl.0",
    image_size: "$settings.imageSize",
    seed: "$settings.seed",
    output_format: "$settings.outputFormat",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: { image_url: "string", image_size: "string", seed: "number", output_format: "string", nsfw_checker: "boolean" },
};

function ideogramSettings(kind: "edit" | "remix") {
  return {
    version: 1,
    fields: [
      uploadList("imageUrl", "Input image", "image", 1, true),
      ...(kind === "edit" ? [uploadList("maskUrl", "Mask image", "image", 1, true)] : []),
      selectField("renderingSpeed", "Rendering speed", ["TURBO", "BALANCED", "QUALITY"], "BALANCED", false),
      boolField("expandPrompt", "MagicPrompt", true),
      ...(kind === "remix"
        ? [
            selectField("style", "Style", ["AUTO", "GENERAL", "REALISTIC", "DESIGN"], "AUTO", false),
            selectField("imageSize", "Размер", IMAGE_SIZE, "square_hd", false),
            selectField("numImages", "Images", ["1", "2", "3", "4"], "1", false),
            { name: "strength", label: "Strength", type: "number", required: false, defaultValue: 0.8, min: 0.01, max: 1, step: 0.01 },
            negativePromptField,
          ]
        : []),
      seedField,
    ],
  } satisfies Record<string, unknown>;
}

const ideogramEditPayload: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["image_url", "mask_url"],
  input: {
    image_url: "$settings.imageUrl.0",
    mask_url: "$settings.maskUrl.0",
    rendering_speed: "$settings.renderingSpeed",
    expand_prompt: "$settings.expandPrompt",
    seed: "$settings.seed",
  },
  coerce: { image_url: "string", mask_url: "string", rendering_speed: "string", expand_prompt: "boolean", seed: "number" },
};

const ideogramRemixPayload: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["image_url"],
  input: {
    image_url: "$settings.imageUrl.0",
    rendering_speed: "$settings.renderingSpeed",
    style: "$settings.style",
    expand_prompt: "$settings.expandPrompt",
    image_size: "$settings.imageSize",
    num_images: "$settings.numImages",
    seed: "$settings.seed",
    strength: "$settings.strength",
    negative_prompt: "$settings.negativePrompt",
  },
  coerce: { image_url: "string", rendering_speed: "string", style: "string", expand_prompt: "boolean", image_size: "string", num_images: "string", seed: "number", strength: "number", negative_prompt: "string" },
};

function row(args: Omit<AdditionalKieModel, "provider" | "endpoint" | "statusEndpoint">): AdditionalKieModel {
  return args;
}

export const ADDITIONAL_KIE_GENERAL_MODELS: readonly AdditionalKieModel[] = [
  row({
    slug: "seedance-2-0-text-to-video",
    name: "Seedance 2.0 — Text to Video",
    type: "VIDEO",
    apiModelId: "bytedance/seedance-2",
    supportsImageInput: false,
    supportsVideoInput: false,
    supportsNegativePrompt: false,
    supportsSeed: false,
    maxDuration: 15,
    metadata: meta("Seedance 2.0", "text-to-video", "https://docs.kie.ai/market/bytedance/seedance-2", "https://kie.ai/seedance-2"),
    description: "Seedance 2.0 text-to-video concrete QazCard mode.",
    availableAspectRatios: RATIO_VIDEO,
    availableResolutions: ["480p", "720p", "1080p"],
    settingsSchema: seedanceSettings(false, false),
    payloadMapping: seedancePayload(false),
    pricingSchema: pricing("bytedance/seedance-2", 67),
    costCredits: 67,
    realCost: 0,
  }),
  row({
    slug: "seedance-2-0-image-to-video",
    name: "Seedance 2.0 — Image to Video",
    type: "VIDEO",
    apiModelId: "bytedance/seedance-2",
    supportsImageInput: true,
    supportsVideoInput: true,
    supportsNegativePrompt: false,
    supportsSeed: false,
    maxDuration: 15,
    metadata: meta("Seedance 2.0", "image-to-video", "https://docs.kie.ai/market/bytedance/seedance-2", "https://kie.ai/seedance-2"),
    description: "Seedance 2.0 image/reference-to-video concrete QazCard mode.",
    availableAspectRatios: RATIO_VIDEO,
    availableResolutions: ["480p", "720p", "1080p"],
    settingsSchema: seedanceSettings(true, false),
    payloadMapping: seedancePayload(true),
    pricingSchema: {
      type: "formula",
      baseCredits: 120,
      rules: [
        { when: { field: "duration", equals: 10 }, multiply: 2 },
        { when: { field: "resolution", equals: "1080p" }, multiply: 1.5 },
      ],
      round: "ceil",
      minCredits: 120,
    },
    costCredits: 120,
    realCost: 0,
  }),
  row({
    slug: "seedance-2-0-fast-text-to-video",
    name: "Seedance 2.0 Fast — Text to Video",
    type: "VIDEO",
    apiModelId: "bytedance/seedance-2-fast",
    supportsImageInput: false,
    supportsVideoInput: false,
    supportsNegativePrompt: false,
    supportsSeed: false,
    maxDuration: 15,
    metadata: meta("Seedance 2.0 Fast", "text-to-video", "https://docs.kie.ai/market/bytedance/seedance-2-fast", "https://kie.ai/seedance-2"),
    description: "Seedance 2.0 Fast text-to-video concrete QazCard mode.",
    availableAspectRatios: RATIO_VIDEO,
    availableResolutions: ["480p", "720p"],
    settingsSchema: seedanceSettings(false, true),
    payloadMapping: seedancePayload(false),
    pricingSchema: pricing("bytedance/seedance-2-fast", 55),
    costCredits: 55,
    realCost: 0,
  }),
  row({
    slug: "seedance-2-0-fast-image-to-video",
    name: "Seedance 2.0 Fast — Image to Video",
    type: "VIDEO",
    apiModelId: "bytedance/seedance-2-fast",
    supportsImageInput: true,
    supportsVideoInput: true,
    supportsNegativePrompt: false,
    supportsSeed: false,
    maxDuration: 15,
    metadata: meta("Seedance 2.0 Fast", "image-to-video", "https://docs.kie.ai/market/bytedance/seedance-2-fast", "https://kie.ai/seedance-2"),
    description: "Seedance 2.0 Fast image/reference-to-video concrete QazCard mode.",
    availableAspectRatios: RATIO_VIDEO,
    availableResolutions: ["480p", "720p"],
    settingsSchema: seedanceSettings(true, true),
    payloadMapping: seedancePayload(true),
    pricingSchema: pricing("bytedance/seedance-2-fast", 55),
    costCredits: 55,
    realCost: 0,
  }),
  row({ slug: "nano-banana-2-text-to-image", name: "Nano Banana 2 — Text to Image", type: "IMAGE", apiModelId: "nano-banana-2", supportsImageInput: false, supportsVideoInput: false, supportsNegativePrompt: false, supportsSeed: false, maxDuration: null, metadata: meta("Nano Banana 2", "text-to-image", "https://docs.kie.ai/market/google/nanobanana2", "https://kie.ai/nano-banana-2"), description: "Nano Banana 2 text-to-image concrete mode.", availableAspectRatios: RATIO_IMAGE_AUTO, availableResolutions: ["1K", "2K", "4K"], settingsSchema: imageGenSettings(14, false), payloadMapping: imageGenPayload(false), pricingSchema: pricing("nano-banana-2", 30), costCredits: 30, realCost: 0 }),
  row({ slug: "nano-banana-2-image-to-image", name: "Nano Banana 2 — Image to Image", type: "IMAGE", apiModelId: "nano-banana-2", supportsImageInput: true, supportsVideoInput: false, supportsNegativePrompt: false, supportsSeed: false, maxDuration: null, metadata: meta("Nano Banana 2", "image-to-image", "https://docs.kie.ai/market/google/nanobanana2", "https://kie.ai/nano-banana-2"), description: "Nano Banana 2 image_input concrete mode.", availableAspectRatios: RATIO_IMAGE_AUTO, availableResolutions: ["1K", "2K", "4K"], settingsSchema: imageGenSettings(14, true), payloadMapping: imageGenPayload(true), pricingSchema: pricing("nano-banana-2", 30), costCredits: 30, realCost: 0 }),
  row({ slug: "nano-banana-pro-image-to-image", name: "Nano Banana Pro — Image to Image", type: "IMAGE", apiModelId: "nano-banana-pro", supportsImageInput: true, supportsVideoInput: false, supportsNegativePrompt: false, supportsSeed: false, maxDuration: null, metadata: meta("Nano Banana Pro", "image-to-image", "https://docs.kie.ai/market/google/pro-image-to-image", "https://kie.ai/nano-banana-pro"), description: "Nano Banana Pro image_input concrete mode.", availableAspectRatios: RATIO_IMAGE_AUTO, availableResolutions: ["1K", "2K", "4K"], settingsSchema: imageGenSettings(8, true), payloadMapping: imageGenPayload(true), pricingSchema: pricing("nano-banana-pro", 40), costCredits: 40, realCost: 0 }),
  row({ slug: "seedream-5-lite-image-to-image", name: "Seedream 5.0 Lite — Image to Image", type: "IMAGE", apiModelId: "seedream/5-lite-image-to-image", supportsImageInput: true, supportsVideoInput: false, supportsNegativePrompt: false, supportsSeed: false, maxDuration: null, metadata: meta("Seedream 5.0 Lite", "image-to-image", "https://docs.kie.ai/market/seedream-5-lite-image-to-image", "https://kie.ai/seedream-5-lite"), description: "Seedream 5.0 Lite image-to-image.", availableAspectRatios: RATIO_IMAGE, availableResolutions: ["2K", "4K"], settingsSchema: seedreamI2ISettings, payloadMapping: seedreamI2IPayload, pricingSchema: pricing("seedream/5-lite-image-to-image", 30), costCredits: 30, realCost: 0 }),
  row({ slug: "seedream-4-5-text-to-image", name: "Seedream 4.5 — Text to Image", type: "IMAGE", apiModelId: "seedream/4.5-text-to-image", supportsImageInput: false, supportsVideoInput: false, supportsNegativePrompt: false, supportsSeed: false, maxDuration: null, metadata: meta("Seedream 4.5", "text-to-image", "https://docs.kie.ai/market/seedream/4-5-text-to-image", "https://kie.ai/seedream-4-5"), description: "Seedream 4.5 text-to-image.", availableAspectRatios: RATIO_IMAGE, availableResolutions: ["2K", "4K"], settingsSchema: seedreamT2ISettings, payloadMapping: seedreamT2IPayload, pricingSchema: pricing("seedream/4.5-text-to-image", 30), costCredits: 30, realCost: 0 }),
  row({ slug: "seedream-4-5-edit", name: "Seedream 4.5 — Edit", type: "IMAGE", apiModelId: "seedream/4.5-edit", supportsImageInput: true, supportsVideoInput: false, supportsNegativePrompt: false, supportsSeed: false, maxDuration: null, metadata: meta("Seedream 4.5", "edit", "https://docs.kie.ai/market/seedream/4-5-edit", "https://kie.ai/seedream-4-5"), description: "Seedream 4.5 image edit.", availableAspectRatios: RATIO_IMAGE, availableResolutions: ["2K", "4K"], settingsSchema: seedreamI2ISettings, payloadMapping: seedreamI2IPayload, pricingSchema: pricing("seedream/4.5-edit", 30), costCredits: 30, realCost: 0 }),
  row({
    slug: "flux-2-flex-text-to-image",
    name: "Flux 2 Flex — Text to Image",
    type: "IMAGE",
    apiModelId: "flux-2/flex-text-to-image",
    supportsImageInput: false,
    supportsVideoInput: false,
    supportsNegativePrompt: false,
    supportsSeed: false,
    maxDuration: null,
    metadata: {
      ...meta("Flux 2", "flex-text-to-image", "https://docs.kie.ai/market/flux2/flex-text-to-image", "https://kie.ai/flux-2"),
      docsCheckedAt: "2026-05-11",
    },
    description: "Flux 2 Flex text-to-image (Kie: prompt, aspect_ratio, resolution, nsfw_checker).",
    availableAspectRatios: [...FLUX_FLEX_IMAGE_ASPECT],
    availableResolutions: ["1K", "2K"],
    settingsSchema: fluxFlexT2ISettings,
    payloadMapping: fluxFlexT2IPayload,
    pricingSchema: pricing("flux-2/flex-text-to-image", 30),
    costCredits: 30,
    realCost: 0,
  }),
  row({
    slug: "flux-2-flex-image-to-image",
    name: "Flux 2 Flex — Image to Image",
    type: "IMAGE",
    apiModelId: "flux-2/flex-image-to-image",
    supportsImageInput: true,
    supportsVideoInput: false,
    supportsNegativePrompt: false,
    supportsSeed: false,
    maxDuration: null,
    metadata: {
      ...meta("Flux 2", "flex-image-to-image", "https://docs.kie.ai/market/flux2/flex-image-to-image", "https://kie.ai/flux-2"),
      docsCheckedAt: "2026-05-11",
    },
    description: "Flux 2 Flex image-to-image: input_urls (1–8), prompt, aspect_ratio, resolution, nsfw_checker.",
    availableAspectRatios: [...FLUX_FLEX_I2I_ASPECT],
    availableResolutions: ["1K", "2K"],
    settingsSchema: fluxFlexI2ISettings,
    payloadMapping: fluxFlexI2IPayload,
    pricingSchema: pricing("flux-2/flex-image-to-image", 30),
    costCredits: 30,
    realCost: 0,
  }),
  row({ slug: "grok-imagine-text-to-image", name: "Grok Imagine — Text to Image", type: "IMAGE", apiModelId: "grok-imagine/text-to-image", supportsImageInput: false, supportsVideoInput: false, supportsNegativePrompt: false, supportsSeed: false, maxDuration: null, metadata: meta("Grok Imagine", "text-to-image", "https://docs.kie.ai/market/grok-imagine/text-to-image", "https://kie.ai/grok-imagine"), description: "Grok Imagine text-to-image.", availableAspectRatios: RATIO_GROK, availableResolutions: [], settingsSchema: grokImageSettings, payloadMapping: grokT2IPayload, pricingSchema: pricing("grok-imagine/text-to-image", 30), costCredits: 30, realCost: 0 }),
  row({ slug: "grok-imagine-image-to-image", name: "Grok Imagine — Image to Image", type: "IMAGE", apiModelId: "grok-imagine/image-to-image", supportsImageInput: true, supportsVideoInput: false, supportsNegativePrompt: false, supportsSeed: false, maxDuration: null, metadata: meta("Grok Imagine", "image-to-image", "https://docs.kie.ai/market/grok-imagine/image-to-image", "https://kie.ai/grok-imagine"), description: "Grok Imagine image-to-image.", availableAspectRatios: [], availableResolutions: [], settingsSchema: grokI2ISettings, payloadMapping: grokI2IPayload, pricingSchema: pricing("grok-imagine/image-to-image", 30), costCredits: 30, realCost: 0 }),
  row({ slug: "grok-imagine-text-to-video", name: "Grok Imagine — Text to Video", type: "VIDEO", apiModelId: "grok-imagine/text-to-video", supportsImageInput: false, supportsVideoInput: false, supportsNegativePrompt: false, supportsSeed: false, maxDuration: 30, metadata: meta("Grok Imagine", "text-to-video", "https://docs.kie.ai/market/grok-imagine/text-to-video", "https://kie.ai/grok-imagine"), description: "Grok Imagine text-to-video.", availableAspectRatios: RATIO_GROK, availableResolutions: ["480p", "720p"], settingsSchema: grokVideoSettings, payloadMapping: grokT2VPayload, pricingSchema: pricing("grok-imagine/text-to-video", 80), costCredits: 80, realCost: 0 }),
  row({ slug: "grok-imagine-image-to-video", name: "Grok Imagine — Image to Video", type: "VIDEO", apiModelId: "grok-imagine/image-to-video", supportsImageInput: true, supportsVideoInput: false, supportsNegativePrompt: false, supportsSeed: false, maxDuration: 30, metadata: meta("Grok Imagine", "image-to-video", "https://docs.kie.ai/market/grok-imagine/image-to-video", "https://kie.ai/grok-imagine"), description: "Grok Imagine image-to-video with external image_urls only.", availableAspectRatios: RATIO_GROK, availableResolutions: ["480p", "720p"], settingsSchema: grokI2VSettings, payloadMapping: grokI2VPayload, pricingSchema: pricing("grok-imagine/image-to-video", 80), costCredits: 80, realCost: 0 }),
  row({ slug: "qwen-text-to-image", name: "Qwen — Text to Image", type: "IMAGE", apiModelId: "qwen/text-to-image", supportsImageInput: false, supportsVideoInput: false, supportsNegativePrompt: true, supportsSeed: true, maxDuration: null, metadata: meta("Alibaba Qwen Image", "text-to-image", "https://docs.kie.ai/market/qwen/text-to-image", "https://kie.ai/qwen"), description: "Qwen text-to-image.", availableAspectRatios: [], availableResolutions: [], settingsSchema: qwenT2ISettings(), payloadMapping: qwenT2IPayload, pricingSchema: pricing("qwen/text-to-image", 30), costCredits: 30, realCost: 0 }),
  row({ slug: "qwen2-image-edit", name: "Qwen2 — Image Edit", type: "IMAGE", apiModelId: "qwen2/image-edit", supportsImageInput: true, supportsVideoInput: false, supportsNegativePrompt: false, supportsSeed: true, maxDuration: null, metadata: meta("Alibaba Qwen2 Image", "image-edit", "https://docs.kie.ai/market/qwen2/image-edit", "https://kie.ai/qwen"), description: "Qwen2 image edit.", availableAspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"], availableResolutions: [], settingsSchema: qwenEditSettings, payloadMapping: qwenEditPayload, pricingSchema: pricing("qwen2/image-edit", 30), costCredits: 30, realCost: 0 }),
  row({ slug: "ideogram-v3-edit", name: "Ideogram V3 — Edit", type: "IMAGE", apiModelId: "ideogram/v3-edit", supportsImageInput: true, supportsVideoInput: false, supportsNegativePrompt: false, supportsSeed: true, maxDuration: null, metadata: meta("Ideogram V3", "edit", "https://docs.kie.ai/market/ideogram/v3-edit", "https://kie.ai/ideogram-v3"), description: "Ideogram V3 edit with image_url and mask_url.", availableAspectRatios: [], availableResolutions: [], settingsSchema: ideogramSettings("edit"), payloadMapping: ideogramEditPayload, pricingSchema: pricing("ideogram/v3-edit", 30), costCredits: 30, realCost: 0 }),
  row({ slug: "ideogram-v3-remix", name: "Ideogram V3 — Remix", type: "IMAGE", apiModelId: "ideogram/v3-remix", supportsImageInput: true, supportsVideoInput: false, supportsNegativePrompt: true, supportsSeed: true, maxDuration: null, metadata: meta("Ideogram V3", "remix", "https://docs.kie.ai/market/ideogram/v3-remix", "https://kie.ai/ideogram-v3"), description: "Ideogram V3 remix.", availableAspectRatios: [], availableResolutions: [], settingsSchema: ideogramSettings("remix"), payloadMapping: ideogramRemixPayload, pricingSchema: pricing("ideogram/v3-remix", 30), costCredits: 30, realCost: 0 }),
];
