/**
 * Рестр GENERAL-моделей Kie HappyHorse-1.0: отдельная AiModel на каждый режим.
 * @see https://kie.ai/happyhorse-1-0
 */

import type { KiePayloadMapping } from "@/server/services/kiePayloadMapping";

import {
  GENERAL_PHASE1_DOCS_CHECKED_AT,
  KIE_METADATA_SOURCE_LINE,
} from "@/server/kie/general-phase1-models";

const PLAYGROUND_URL = "https://kie.ai/happyhorse-1-0";

/** Kie.ai/pricing HappyHorse-1.0 — 53 credits/s, USD 0.265/s (снимок от 2026-05-11). */
const USD_PER_SECOND = 0.265;
const USD_TO_KZT = 500;
const INTERNAL_TOKEN_VALUE_KZT = 10;
const MARKUP_PERCENT = 40;

const TOKENS_PER_SECOND_BASE =
  (USD_PER_SECOND * USD_TO_KZT * (1 + MARKUP_PERCENT / 100)) /
  INTERNAL_TOKEN_VALUE_KZT;

function durationKeysMatrix(scale: number): Record<string, number> {
  const o: Record<string, number> = {};
  for (let d = 3; d <= 15; d++) {
    o[String(d)] = Math.max(
      1,
      Math.round(TOKENS_PER_SECOND_BASE * d * scale),
    );
  }
  return o;
}

/** 720p ниже через отношение Fal/Kie строк на странице pricing (31 vs 53). */
const SCALE_720 = 31 / 53;

export function happyHorsePricingMatrixSchema(providerModel: string): Record<string, unknown> {
  const defaultCredits = Math.max(
    1,
    Math.round(TOKENS_PER_SECOND_BASE * 5 * SCALE_720),
  );
  const fallbackCredits = Math.max(
    1,
    Math.round(TOKENS_PER_SECOND_BASE * 15),
  );

  return {
    type: "matrix",
    currency: "KZT",
    internalTokenValueKzt: INTERNAL_TOKEN_VALUE_KZT,
    usdToKzt: USD_TO_KZT,
    markupPercent: MARKUP_PERCENT,
    provider: "KIE_AI",
    providerModel,
    pricingSource:
      "kie.ai/pricing HappyHorse-1.0 — 53 credits/s, USD 0.265/s (2026-05-11)",
    providerCost: {
      kieCreditsPerSecond: 53,
      usdPerSecond: USD_PER_SECOND,
    },
    defaultCredits,
    fallbackCredits,
    matrix: {
      "720p": durationKeysMatrix(SCALE_720),
      "1080p": durationKeysMatrix(1),
    },
  };
}

export const HAPPYHORSE_SLUG_ORDER = [
  "happyhorse-1-0-text-to-video",
  "happyhorse-1-0-image-to-video",
  "happyhorse-1-0-reference-to-video",
  "happyhorse-1-0-video-edit",
] as const;

export type HappyHorseSlug = (typeof HAPPYHORSE_SLUG_ORDER)[number];

export type HappyHorseSeedRow = {
  slug: HappyHorseSlug;
  name: string;
  type: "VIDEO";
  apiModelId: string;
  supportsImageInput: boolean;
  supportsVideoInput: boolean;
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

const HH_T2V_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "resolution",
      label: "Разрешение",
      type: "select",
      required: true,
      defaultValue: "1080p",
      options: [
        { label: "720p", value: "720p" },
        { label: "1080p", value: "1080p" },
      ],
    },
    {
      name: "aspectRatio",
      label: "Формат",
      type: "select",
      required: true,
      defaultValue: "16:9",
      options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
        { label: "4:3", value: "4:3" },
        { label: "3:4", value: "3:4" },
      ],
    },
    {
      name: "duration",
      label: "Длительность",
      type: "number",
      required: true,
      defaultValue: 5,
      min: 3,
      max: 15,
      step: 1,
      helpText: "От 3 до 15 секунд.",
    },
    {
      name: "seed",
      label: "Seed",
      type: "number",
      required: false,
      min: 0,
      max: 2147483647,
      step: 1,
      helpText:
        "Необязательно. Если не указано, Kie сгенерирует seed автоматически.",
    },
  ],
} as const satisfies Record<string, unknown>;

const HH_T2V_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["resolution", "aspect_ratio", "duration"],
  input: {
    resolution: "$settings.resolution",
    aspect_ratio: "$settings.aspectRatio",
    duration: "$settings.duration",
    seed: "$settings.seed",
  },
  coerce: {
    resolution: "string",
    aspect_ratio: "string",
    duration: "number",
    seed: "number",
  },
};

const HH_I2V_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "imageUrls",
      label: "Исходное изображение",
      type: "upload-list",
      required: true,
      maxItems: 1,
      accept: "image/*",
      purpose: "generation_input",
    },
    {
      name: "resolution",
      label: "Разрешение",
      type: "select",
      required: true,
      defaultValue: "1080p",
      options: [
        { label: "720p", value: "720p" },
        { label: "1080p", value: "1080p" },
      ],
    },
    {
      name: "duration",
      label: "Длительность",
      type: "number",
      required: true,
      defaultValue: 5,
      min: 3,
      max: 15,
      step: 1,
      helpText: "От 3 до 15 секунд.",
    },
    {
      name: "seed",
      label: "Seed",
      type: "number",
      required: false,
      min: 0,
      max: 2147483647,
      step: 1,
    },
  ],
} as const satisfies Record<string, unknown>;

const HH_I2V_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["image_urls", "resolution", "duration"],
  input: {
    image_urls: "$settings.imageUrls",
    resolution: "$settings.resolution",
    duration: "$settings.duration",
    seed: "$settings.seed",
  },
  coerce: {
    image_urls: "stringArray",
    resolution: "string",
    duration: "number",
    seed: "number",
  },
};

const HH_RTV_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "referenceImage",
      label: "Референс-изображения",
      type: "upload-list",
      required: true,
      maxItems: 5,
      accept: "image/*",
      purpose: "generation_input",
      helpText:
        "Загрузите изображения-референсы для персонажей, стиля или сцены.",
    },
    {
      name: "resolution",
      label: "Разрешение",
      type: "select",
      required: true,
      defaultValue: "1080p",
      options: [
        { label: "720p", value: "720p" },
        { label: "1080p", value: "1080p" },
      ],
    },
    {
      name: "aspectRatio",
      label: "Формат",
      type: "select",
      required: true,
      defaultValue: "16:9",
      options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
        { label: "4:3", value: "4:3" },
        { label: "3:4", value: "3:4" },
      ],
    },
    {
      name: "duration",
      label: "Длительность",
      type: "number",
      required: true,
      defaultValue: 5,
      min: 3,
      max: 15,
      step: 1,
    },
    {
      name: "seed",
      label: "Seed",
      type: "number",
      required: false,
      min: 0,
      max: 2147483647,
      step: 1,
    },
  ],
} as const satisfies Record<string, unknown>;

const HH_RTV_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["reference_image", "resolution", "aspect_ratio", "duration"],
  input: {
    reference_image: "$settings.referenceImage",
    resolution: "$settings.resolution",
    aspect_ratio: "$settings.aspectRatio",
    duration: "$settings.duration",
    seed: "$settings.seed",
  },
  coerce: {
    reference_image: "stringArray",
    resolution: "string",
    aspect_ratio: "string",
    duration: "number",
    seed: "number",
  },
};

const HH_VE_SETTINGS = {
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
    },
    {
      name: "referenceImage",
      label: "Референс-изображения",
      type: "upload-list",
      required: false,
      maxItems: 5,
      accept: "image/*",
      purpose: "generation_input",
    },
    {
      name: "resolution",
      label: "Разрешение",
      type: "select",
      required: true,
      defaultValue: "1080p",
      options: [
        { label: "720p", value: "720p" },
        { label: "1080p", value: "1080p" },
      ],
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
    {
      name: "seed",
      label: "Seed",
      type: "number",
      required: false,
      min: 0,
      max: 2147483647,
      step: 1,
    },
  ],
} as const satisfies Record<string, unknown>;

const HH_VE_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["video_url", "resolution", "audio_setting"],
  input: {
    video_url: "$settings.videoUrl.0",
    reference_image: "$settings.referenceImage",
    resolution: "$settings.resolution",
    audio_setting: "$settings.audioSetting",
    seed: "$settings.seed",
  },
  coerce: {
    video_url: "string",
    audio_setting: "string",
    resolution: "string",
    seed: "number",
    reference_image: "stringArray",
  },
};

const HH_COST_FALLBACK = Math.max(
  1,
  Math.round(TOKENS_PER_SECOND_BASE * 5),
);

export const HAPPYHORSE_MODELS: readonly HappyHorseSeedRow[] = [
  {
    slug: "happyhorse-1-0-text-to-video",
    name: "HappyHorse-1.0 — Text to Video",
    type: "VIDEO",
    apiModelId: "happyhorse/text-to-video",
    supportsImageInput: false,
    supportsVideoInput: false,
    supportsSeed: true,
    maxDuration: 15,
    metadata: {
      docsUrl:
        "https://docs.kie.ai/market/happyhorse/text-to-video",
      playgroundUrl: PLAYGROUND_URL,
      docsCheckedAt: GENERAL_PHASE1_DOCS_CHECKED_AT,
      source: KIE_METADATA_SOURCE_LINE,
      kieModelFamily: "HappyHorse-1.0",
      kieMode: "text-to-video",
    },
    description:
      "HappyHorse-1.0 Text→Video (Kie happyhorse/text-to-video). Док.: docs.kie.ai/market/happyhorse/text-to-video.",
    availableAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    availableResolutions: ["720p", "1080p"],
    settingsSchema: { ...HH_T2V_SETTINGS },
    payloadMapping: HH_T2V_PAYLOAD,
    pricingSchema: happyHorsePricingMatrixSchema("happyhorse/text-to-video"),
    costCredits: HH_COST_FALLBACK,
    realCost: 0,
  },
  {
    slug: "happyhorse-1-0-image-to-video",
    name: "HappyHorse-1.0 — Image to Video",
    type: "VIDEO",
    apiModelId: "happyhorse/image-to-video",
    supportsImageInput: true,
    supportsVideoInput: false,
    supportsSeed: true,
    maxDuration: 15,
    metadata: {
      docsUrl:
        "https://docs.kie.ai/market/happyhorse/image-to-video",
      playgroundUrl: PLAYGROUND_URL,
      docsCheckedAt: GENERAL_PHASE1_DOCS_CHECKED_AT,
      source: KIE_METADATA_SOURCE_LINE,
      kieModelFamily: "HappyHorse-1.0",
      kieMode: "image-to-video",
    },
    description:
      "HappyHorse-1.0 Image→Video (Kie happyhorse/image-to-video, image_urls).",
    availableAspectRatios: [],
    availableResolutions: ["720p", "1080p"],
    settingsSchema: { ...HH_I2V_SETTINGS },
    payloadMapping: HH_I2V_PAYLOAD,
    pricingSchema:
      happyHorsePricingMatrixSchema("happyhorse/image-to-video"),
    costCredits: HH_COST_FALLBACK,
    realCost: 0,
  },
  {
    slug: "happyhorse-1-0-reference-to-video",
    name: "HappyHorse-1.0 — Reference to Video",
    type: "VIDEO",
    apiModelId: "happyhorse/reference-to-video",
    supportsImageInput: true,
    supportsVideoInput: false,
    supportsSeed: true,
    maxDuration: 15,
    metadata: {
      docsUrl:
        "https://docs.kie.ai/market/happyhorse/reference-to-video",
      playgroundUrl: PLAYGROUND_URL,
      docsCheckedAt: GENERAL_PHASE1_DOCS_CHECKED_AT,
      source: KIE_METADATA_SOURCE_LINE,
      kieModelFamily: "HappyHorse-1.0",
      kieMode: "reference-to-video",
    },
    description:
      "HappyHorse-1.0 Reference→Video (Kie happyhorse/reference-to-video).",
    availableAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    availableResolutions: ["720p", "1080p"],
    settingsSchema: { ...HH_RTV_SETTINGS },
    payloadMapping: HH_RTV_PAYLOAD,
    pricingSchema:
      happyHorsePricingMatrixSchema("happyhorse/reference-to-video"),
    costCredits: HH_COST_FALLBACK,
    realCost: 0,
  },
  {
    slug: "happyhorse-1-0-video-edit",
    name: "HappyHorse-1.0 — Video Edit",
    type: "VIDEO",
    apiModelId: "happyhorse/video-edit",
    supportsImageInput: true,
    supportsVideoInput: true,
    supportsSeed: true,
    maxDuration: null,
    metadata: {
      docsUrl: "https://docs.kie.ai/market/happyhorse/video-edit",
      playgroundUrl: PLAYGROUND_URL,
      docsCheckedAt: GENERAL_PHASE1_DOCS_CHECKED_AT,
      source: KIE_METADATA_SOURCE_LINE,
      kieModelFamily: "HappyHorse-1.0",
      kieMode: "video-edit",
      /** Kie docs sample мог содержать опечатку с пробелом в ключе; API — reference_image без пробела. */
      kieDocsNote:
        "API input key reference_image (no trailing space); verified vs Playground.",
      publicReady: false,
      requiresManualKieTest: true,
      reason: "Video Edit requires real Kie payload validation before public launch",
    },
    description:
      "HappyHorse-1.0 Video Edit (Kie happyhorse/video-edit): video_url, optional reference_image, audio_setting.",
    availableAspectRatios: [],
    availableResolutions: ["720p", "1080p"],
    settingsSchema: { ...HH_VE_SETTINGS },
    payloadMapping: HH_VE_PAYLOAD,
    pricingSchema: happyHorsePricingMatrixSchema("happyhorse/video-edit"),
    costCredits: HH_COST_FALLBACK,
    realCost: 0,
  },
];

const HAPPY_HORSE_ALLOWED = new Map<string, ReadonlySet<string>>(
  HAPPYHORSE_MODELS.map((m) => {
    const fields = (
      (m.settingsSchema as { fields?: { name?: string }[] }).fields ?? []
    ).map((f) => f.name).filter(Boolean) as string[];
    return [m.apiModelId, new Set(fields)] as const;
  }),
);

export function happyHorseAllowedSettingsKeysForApiModel(
  apiModelId: string,
): ReadonlySet<string> | null {
  const k = apiModelId.trim();
  return HAPPY_HORSE_ALLOWED.get(k) ?? null;
}
