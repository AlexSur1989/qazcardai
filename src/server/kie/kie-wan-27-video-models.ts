/**
 * Wan 2.7 Video family from official Kie docs + Kie Playground.
 *
 * Docs checked:
 * - https://docs.kie.ai/market/wan/2-7-text-to-video
 * - https://docs.kie.ai/market/wan/2-7-image-to-video
 * - https://docs.kie.ai/market/wan/2-7-r2v
 * - https://docs.kie.ai/market/wan/2-7-videoedit
 * Playground: https://kie.ai/wan-2-7-video
 */

import type { KiePayloadMapping } from "@/server/services/kiePayloadMapping";

import {
  GENERAL_PHASE1_DOCS_CHECKED_AT,
  KIE_METADATA_SOURCE_LINE,
} from "@/server/kie/general-phase1-models";

const PLAYGROUND_URL = "https://kie.ai/wan-2-7-video";
const PRICING_REVIEW_REASON =
  "Kie pricing page must be rechecked before public launch; conservative admin-only pricing is used.";

export const WAN_27_VIDEO_SLUG_ORDER = [
  "wan-2-7-text-to-video",
  "wan-2-7-image-to-video",
  "wan-2-7-r2v",
  "wan-2-7-videoedit",
] as const;

export type Wan27VideoSlug = (typeof WAN_27_VIDEO_SLUG_ORDER)[number];

export type Wan27VideoSeedRow = {
  slug: Wan27VideoSlug;
  name: string;
  type: "VIDEO";
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

const RESOLUTION_OPTIONS = [
  { label: "720p", value: "720p" },
  { label: "1080p", value: "1080p" },
] as const;

const ASPECT_OPTIONS = [
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "1:1", value: "1:1" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
] as const;

const SEED_FIELD = {
  name: "seed",
  label: "Seed",
  type: "number",
  required: false,
  min: 0,
  max: 2147483647,
  step: 1,
  helpText: "Необязательно. Если не указано, Kie сгенерирует seed автоматически.",
} as const;

const NEGATIVE_PROMPT_FIELD = {
  name: "negativePrompt",
  label: "Negative prompt",
  type: "textarea",
  required: false,
  maxLength: 500,
} as const;

const PROMPT_EXTEND_FIELD = {
  name: "promptExtend",
  label: "Улучшить промпт",
  type: "boolean",
  required: false,
  defaultValue: true,
} as const;

const WATERMARK_FIELD = {
  name: "watermark",
  label: "Watermark",
  type: "boolean",
  required: false,
  defaultValue: false,
} as const;

const NSFW_CHECKER_FIELD = {
  name: "nsfwChecker",
  label: "NSFW checker",
  type: "boolean",
  required: false,
  defaultValue: true,
  helpText: "Playground defaults to true; Kie docs allow disabling if needed.",
} as const;

const WAN_27_PRICING_REVIEW = {
  type: "matrix",
  currency: "KZT",
  internalTokenValueKzt: 10,
  provider: "KIE_AI",
  providerCost: {
    pricingNeedsReview: true,
  },
  pricingSource: "requires kie.ai/pricing recheck before publicReady=true",
  pricingNeedsReview: true,
  defaultCredits: 200,
  fallbackCredits: 300,
  matrix: {
    "720p": {
      "2": 80,
      "5": 150,
      "8": 240,
      "10": 300,
      "15": 450,
    },
    "1080p": {
      "2": 120,
      "5": 220,
      "8": 350,
      "10": 440,
      "15": 660,
    },
  },
} as const satisfies Record<string, unknown>;

function wan27Pricing(providerModel: string): Record<string, unknown> {
  return {
    ...WAN_27_PRICING_REVIEW,
    providerModel,
  };
}

const WAN_T2V_SETTINGS = {
  version: 1,
  fields: [
    {
      ...NEGATIVE_PROMPT_FIELD,
      defaultValue: "blurry, low quality, flicker, distorted characters",
    },
    {
      name: "audioUrl",
      label: "Audio",
      type: "audio-upload-list",
      required: false,
      maxItems: 1,
      accept: "audio/*",
      purpose: "generation_input",
      helpText: "Optional custom audio URL. Upload via /api/uploads.",
    },
    {
      name: "resolution",
      label: "Разрешение",
      type: "select",
      required: true,
      defaultValue: "1080p",
      options: [...RESOLUTION_OPTIONS],
    },
    {
      name: "ratio",
      label: "Формат",
      type: "select",
      required: true,
      defaultValue: "16:9",
      options: [...ASPECT_OPTIONS],
    },
    {
      name: "duration",
      label: "Длительность",
      type: "number",
      required: true,
      defaultValue: 5,
      min: 2,
      max: 15,
      step: 1,
    },
    PROMPT_EXTEND_FIELD,
    WATERMARK_FIELD,
    SEED_FIELD,
    NSFW_CHECKER_FIELD,
  ],
} as const satisfies Record<string, unknown>;

const WAN_T2V_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["resolution", "ratio", "duration"],
  input: {
    negative_prompt: "$settings.negativePrompt",
    audio_url: "$settings.audioUrl.0",
    resolution: "$settings.resolution",
    ratio: "$settings.ratio",
    duration: "$settings.duration",
    prompt_extend: "$settings.promptExtend",
    watermark: "$settings.watermark",
    seed: "$settings.seed",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: {
    negative_prompt: "string",
    audio_url: "string",
    resolution: "string",
    ratio: "string",
    duration: "number",
    prompt_extend: "boolean",
    watermark: "boolean",
    seed: "number",
    nsfw_checker: "boolean",
  },
};

const WAN_I2V_SETTINGS = {
  version: 1,
  fields: [
    NEGATIVE_PROMPT_FIELD,
    {
      name: "firstFrameUrl",
      label: "Первый кадр",
      type: "image-upload-list",
      required: false,
      maxItems: 1,
      accept: "image/*",
      purpose: "generation_input",
      helpText: "First-frame-to-video или first-and-last-frame-to-video.",
    },
    {
      name: "lastFrameUrl",
      label: "Последний кадр",
      type: "image-upload-list",
      required: false,
      maxItems: 1,
      accept: "image/*",
      purpose: "generation_input",
    },
    {
      name: "firstClipUrl",
      label: "First clip",
      type: "video-upload-list",
      required: false,
      maxItems: 1,
      accept: "video/*",
      purpose: "generation_input",
      helpText: "Video continuation mode. Do not combine with first/last frame.",
    },
    {
      name: "drivingAudioUrl",
      label: "Driving audio",
      type: "audio-upload-list",
      required: false,
      maxItems: 1,
      accept: "audio/*",
      purpose: "generation_input",
    },
    {
      name: "resolution",
      label: "Разрешение",
      type: "select",
      required: true,
      defaultValue: "1080p",
      options: [...RESOLUTION_OPTIONS],
    },
    {
      name: "duration",
      label: "Длительность",
      type: "number",
      required: true,
      defaultValue: 5,
      min: 2,
      max: 15,
      step: 1,
    },
    PROMPT_EXTEND_FIELD,
    WATERMARK_FIELD,
    SEED_FIELD,
    NSFW_CHECKER_FIELD,
  ],
} as const satisfies Record<string, unknown>;

const WAN_I2V_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["resolution", "duration"],
  input: {
    negative_prompt: "$settings.negativePrompt",
    first_frame_url: "$settings.firstFrameUrl.0",
    last_frame_url: "$settings.lastFrameUrl.0",
    first_clip_url: "$settings.firstClipUrl.0",
    driving_audio_url: "$settings.drivingAudioUrl.0",
    resolution: "$settings.resolution",
    duration: "$settings.duration",
    prompt_extend: "$settings.promptExtend",
    watermark: "$settings.watermark",
    seed: "$settings.seed",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: {
    negative_prompt: "string",
    first_frame_url: "string",
    last_frame_url: "string",
    first_clip_url: "string",
    driving_audio_url: "string",
    resolution: "string",
    duration: "number",
    prompt_extend: "boolean",
    watermark: "boolean",
    seed: "number",
    nsfw_checker: "boolean",
  },
};

const WAN_R2V_SETTINGS = {
  version: 1,
  fields: [
    NEGATIVE_PROMPT_FIELD,
    {
      name: "referenceImage",
      label: "Reference images",
      type: "image-upload-list",
      required: false,
      maxItems: 5,
      accept: "image/*",
      purpose: "generation_input",
      helpText: "At least one reference image or reference video is required.",
    },
    {
      name: "referenceVideo",
      label: "Reference videos",
      type: "video-upload-list",
      required: false,
      maxItems: 5,
      accept: "video/*",
      purpose: "generation_input",
      helpText: "Total images + videos cannot exceed 5.",
    },
    {
      name: "firstFrame",
      label: "First frame",
      type: "image-upload-list",
      required: false,
      maxItems: 1,
      accept: "image/*",
      purpose: "generation_input",
      helpText: "If supplied, aspect_ratio is ignored by Kie.",
    },
    {
      name: "referenceVoice",
      label: "Reference voice",
      type: "audio-upload-list",
      required: false,
      maxItems: 1,
      accept: "audio/*",
      purpose: "generation_input",
      helpText: "wav/mp3, 1 to 10 seconds according to Kie docs.",
    },
    {
      name: "resolution",
      label: "Разрешение",
      type: "select",
      required: true,
      defaultValue: "1080p",
      options: [...RESOLUTION_OPTIONS],
    },
    {
      name: "aspectRatio",
      label: "Формат",
      type: "select",
      required: true,
      defaultValue: "16:9",
      options: [...ASPECT_OPTIONS],
    },
    {
      name: "duration",
      label: "Длительность",
      type: "number",
      required: true,
      defaultValue: 5,
      min: 2,
      max: 10,
      step: 1,
    },
    PROMPT_EXTEND_FIELD,
    WATERMARK_FIELD,
    SEED_FIELD,
    NSFW_CHECKER_FIELD,
  ],
} as const satisfies Record<string, unknown>;

const WAN_R2V_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["resolution", "aspect_ratio", "duration"],
  input: {
    negative_prompt: "$settings.negativePrompt",
    reference_image: "$settings.referenceImage",
    reference_video: "$settings.referenceVideo",
    first_frame: "$settings.firstFrame.0",
    reference_voice: "$settings.referenceVoice.0",
    resolution: "$settings.resolution",
    aspect_ratio: "$settings.aspectRatio",
    duration: "$settings.duration",
    prompt_extend: "$settings.promptExtend",
    watermark: "$settings.watermark",
    seed: "$settings.seed",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: {
    negative_prompt: "string",
    reference_image: "stringArray",
    reference_video: "stringArray",
    first_frame: "string",
    reference_voice: "string",
    resolution: "string",
    aspect_ratio: "string",
    duration: "number",
    prompt_extend: "boolean",
    watermark: "boolean",
    seed: "number",
    nsfw_checker: "boolean",
  },
};

const WAN_EDIT_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "videoUrl",
      label: "Исходное видео",
      type: "video-upload-list",
      required: true,
      maxItems: 1,
      accept: "video/*",
      purpose: "generation_input",
      helpText: "mp4/mov, 2 to 10 seconds, up to 100MB.",
    },
    {
      name: "referenceImage",
      label: "Reference image",
      type: "image-upload-list",
      required: false,
      maxItems: 1,
      accept: "image/*",
      purpose: "generation_input",
    },
    NEGATIVE_PROMPT_FIELD,
    {
      name: "resolution",
      label: "Разрешение",
      type: "select",
      required: true,
      defaultValue: "1080p",
      options: [...RESOLUTION_OPTIONS],
    },
    {
      name: "duration",
      label: "Длительность",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      max: 10,
      step: 1,
      helpText: "0 = использовать полную длительность входного видео; иначе 2-10 сек.",
    },
    {
      name: "aspectRatio",
      label: "Формат",
      type: "select",
      required: false,
      defaultValue: "",
      options: [{ label: "Как у входного видео", value: "" }, ...ASPECT_OPTIONS],
    },
    {
      name: "audioSetting",
      label: "Аудио",
      type: "select",
      required: true,
      defaultValue: "auto",
      options: [
        { label: "Auto", value: "auto" },
        { label: "Original", value: "origin" },
      ],
    },
    PROMPT_EXTEND_FIELD,
    WATERMARK_FIELD,
    SEED_FIELD,
    NSFW_CHECKER_FIELD,
  ],
} as const satisfies Record<string, unknown>;

const WAN_EDIT_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["video_url", "resolution", "duration", "audio_setting"],
  input: {
    video_url: "$settings.videoUrl.0",
    reference_image: "$settings.referenceImage.0",
    negative_prompt: "$settings.negativePrompt",
    resolution: "$settings.resolution",
    duration: "$settings.duration",
    aspect_ratio: "$settings.aspectRatio",
    audio_setting: "$settings.audioSetting",
    prompt_extend: "$settings.promptExtend",
    watermark: "$settings.watermark",
    seed: "$settings.seed",
    nsfw_checker: "$settings.nsfwChecker",
  },
  coerce: {
    video_url: "string",
    reference_image: "string",
    negative_prompt: "string",
    resolution: "string",
    duration: "number",
    aspect_ratio: "string",
    audio_setting: "string",
    prompt_extend: "boolean",
    watermark: "boolean",
    seed: "number",
    nsfw_checker: "boolean",
  },
};

function baseMetadata(
  docsUrl: string,
  mode: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    docsUrl,
    playgroundUrl: PLAYGROUND_URL,
    docsCheckedAt: GENERAL_PHASE1_DOCS_CHECKED_AT,
    source: KIE_METADATA_SOURCE_LINE,
    kieModelFamily: "Wan 2.7 Video",
    kieMode: mode,
    publicReady: false,
    requiresManualKieTest: true,
    pricingNeedsReview: true,
    reason: PRICING_REVIEW_REASON,
    ...extra,
  };
}

export const WAN_27_VIDEO_MODELS: readonly Wan27VideoSeedRow[] = [
  {
    slug: "wan-2-7-text-to-video",
    name: "Wan 2.7 — Text to Video",
    type: "VIDEO",
    apiModelId: "wan/2-7-text-to-video",
    supportsImageInput: false,
    supportsVideoInput: false,
    supportsNegativePrompt: true,
    supportsSeed: true,
    maxDuration: 15,
    metadata: baseMetadata(
      "https://docs.kie.ai/market/wan/2-7-text-to-video",
      "text-to-video",
    ),
    description:
      "Wan 2.7 Text→Video (Kie: wan/2-7-text-to-video). Docs + Playground checked; public launch gated.",
    availableAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    availableResolutions: ["720p", "1080p"],
    settingsSchema: { ...WAN_T2V_SETTINGS },
    payloadMapping: WAN_T2V_PAYLOAD,
    pricingSchema: wan27Pricing("wan/2-7-text-to-video"),
    costCredits: 200,
    realCost: 0,
  },
  {
    slug: "wan-2-7-image-to-video",
    name: "Wan 2.7 — Image to Video",
    type: "VIDEO",
    apiModelId: "wan/2-7-image-to-video",
    supportsImageInput: true,
    supportsVideoInput: true,
    supportsNegativePrompt: true,
    supportsSeed: true,
    maxDuration: 15,
    metadata: baseMetadata(
      "https://docs.kie.ai/market/wan/2-7-image-to-video",
      "image-to-video",
      {
        publicReady: false,
        requiresManualKieTest: true,
        reason:
          "I2V has multiple upload modes (first/last frame or first_clip) and requires admin preview before public launch.",
      },
    ),
    description:
      "Wan 2.7 Image→Video: first frame, first+last frame, video continuation, driving audio.",
    availableAspectRatios: [],
    availableResolutions: ["720p", "1080p"],
    settingsSchema: { ...WAN_I2V_SETTINGS },
    payloadMapping: WAN_I2V_PAYLOAD,
    pricingSchema: wan27Pricing("wan/2-7-image-to-video"),
    costCredits: 200,
    realCost: 0,
  },
  {
    slug: "wan-2-7-r2v",
    name: "Wan 2.7 — Reference to Video",
    type: "VIDEO",
    apiModelId: "wan/2-7-r2v",
    supportsImageInput: true,
    supportsVideoInput: true,
    supportsNegativePrompt: true,
    supportsSeed: true,
    maxDuration: 10,
    metadata: baseMetadata(
      "https://docs.kie.ai/market/wan/2-7-r2v",
      "reference-to-video",
      {
        publicReady: false,
        requiresManualKieTest: true,
        reason:
          "R2V combines image/video/audio references; admin preview and real Kie test required before public launch.",
      },
    ),
    description:
      "Wan 2.7 Reference→Video: reference_image, reference_video, first_frame and reference_voice.",
    availableAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    availableResolutions: ["720p", "1080p"],
    settingsSchema: { ...WAN_R2V_SETTINGS },
    payloadMapping: WAN_R2V_PAYLOAD,
    pricingSchema: wan27Pricing("wan/2-7-r2v"),
    costCredits: 200,
    realCost: 0,
  },
  {
    slug: "wan-2-7-videoedit",
    name: "Wan 2.7 — Video Edit",
    type: "VIDEO",
    apiModelId: "wan/2-7-videoedit",
    supportsImageInput: true,
    supportsVideoInput: true,
    supportsNegativePrompt: true,
    supportsSeed: true,
    maxDuration: 10,
    metadata: baseMetadata(
      "https://docs.kie.ai/market/wan/2-7-videoedit",
      "video-edit",
      {
        publicReady: false,
        requiresManualKieTest: true,
        reason:
          "Video Edit requires source video and optional reference image; real Kie payload validation is required before public launch.",
      },
    ),
    description:
      "Wan 2.7 Video Edit: video_url, optional reference_image, aspect_ratio, audio_setting.",
    availableAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    availableResolutions: ["720p", "1080p"],
    settingsSchema: { ...WAN_EDIT_SETTINGS },
    payloadMapping: WAN_EDIT_PAYLOAD,
    pricingSchema: wan27Pricing("wan/2-7-videoedit"),
    costCredits: 200,
    realCost: 0,
  },
];

const WAN_27_ALLOWED = new Map<string, ReadonlySet<string>>(
  WAN_27_VIDEO_MODELS.map((m) => {
    const fields = (
      (m.settingsSchema as { fields?: { name?: string }[] }).fields ?? []
    ).map((f) => f.name).filter(Boolean) as string[];
    return [m.apiModelId, new Set(fields)] as const;
  }),
);

export function wan27AllowedSettingsKeysForApiModel(
  apiModelId: string,
): ReadonlySet<string> | null {
  return WAN_27_ALLOWED.get(apiModelId.trim()) ?? null;
}
