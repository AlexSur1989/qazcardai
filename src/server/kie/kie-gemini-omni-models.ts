/**
 * Gemini Omni family — Kie docs + playground (2026-05-23).
 *
 * - Video: https://docs.kie.ai/market/gemini-omni-video (createTask)
 * - Audio: https://docs.kie.ai/market/gemini-omni-audio (sync omni/audio/create)
 * - Character: https://docs.kie.ai/market/gemini-omni-character (sync omni/character/create)
 * Playground: https://kie.ai/gemini-omni
 */

import type { KiePayloadMapping } from "@/server/services/kiePayloadMapping";

import {
  GENERAL_PHASE1_DOCS_CHECKED_AT,
  KIE_METADATA_SOURCE_LINE,
} from "@/server/kie/general-phase1-models";

const PLAYGROUND_URL = "https://kie.ai/gemini-omni";
const FAMILY = "Gemini Omni";
const PRICING_REASON =
  "Kie pricing page must be rechecked before public launch; conservative admin-only pricing is used.";

export const GEMINI_OMNI_SLUG_ORDER = [
  "gemini-omni-video",
  "gemini-omni-audio",
  "gemini-omni-character",
] as const;

export type GeminiOmniSlug = (typeof GEMINI_OMNI_SLUG_ORDER)[number];

export type GeminiOmniSeedRow = {
  slug: GeminiOmniSlug;
  name: string;
  type: "VIDEO";
  apiModelId: string;
  endpoint: string;
  statusEndpoint: string | null;
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

const VOICE_OPTIONS = [
  { label: "Achernar (female, soft)", value: "achernar" },
  { label: "Achird (male, friendly)", value: "achird" },
  { label: "Algenib (male, raspy)", value: "algenib" },
  { label: "Algieba (male, easygoing)", value: "algieba" },
  { label: "Alnilam (male, steady)", value: "alnilam" },
  { label: "Aoede (female, brisk)", value: "aoede" },
  { label: "Autonoe (female, bright)", value: "autonoe" },
  { label: "Callirrhoe (female, easygoing)", value: "callirrhoe" },
  { label: "Charon (male, intellectual)", value: "charon" },
  { label: "Despina (female, smooth)", value: "despina" },
  { label: "Enceladus (male, breathy)", value: "enceladus" },
  { label: "Erinome (female, clear)", value: "erinome" },
  { label: "Fenrir (male, lively)", value: "fenrir" },
  { label: "Gacrux (female, mature)", value: "gacrux" },
  { label: "Iapetus (male, clear)", value: "iapetus" },
  { label: "Kore (female, capable)", value: "kore" },
  { label: "Laomedeia (female, cheerful)", value: "laomedeia" },
  { label: "Leda (female, young)", value: "leda" },
  { label: "Orus (male, steady)", value: "orus" },
  { label: "Puck (male, cheerful)", value: "puck" },
  { label: "Pulcherrima (neutral, forward)", value: "pulcherrima" },
  { label: "Rasalgethi (male, intellectual)", value: "rasalgethi" },
  { label: "Sadachbia (male, vivid)", value: "sadachbia" },
  { label: "Sadaltager (male, knowledgeable)", value: "sadaltager" },
  { label: "Schedar (male, smooth)", value: "schedar" },
  { label: "Sulafat (female, warm)", value: "sulafat" },
  { label: "Umbriel (male, smooth)", value: "umbriel" },
  { label: "Vindemiatrix (female, gentle)", value: "vindemiatrix" },
  { label: "Zephyr (female, bright)", value: "zephyr" },
  { label: "Zubenelgenubi (male, casual)", value: "zubenelgenubi" },
] as const;

const GEMINI_OMNI_PRICING_REVIEW = {
  type: "matrix",
  currency: "KZT",
  internalTokenValueKzt: 10,
  provider: "KIE_AI",
  providerCost: { pricingNeedsReview: true },
  pricingSource: "requires kie.ai/pricing recheck before publicReady=true",
  pricingNeedsReview: true,
  defaultCredits: 250,
  fallbackCredits: 400,
  matrix: {
    "720p": { "4": 120, "6": 180, "8": 240, "10": 300 },
    "1080p": { "4": 180, "6": 270, "8": 360, "10": 450 },
    "4k": { "4": 300, "6": 450, "8": 600, "10": 750 },
  },
} as const satisfies Record<string, unknown>;

function omniPricing(providerModel: string): Record<string, unknown> {
  return { ...GEMINI_OMNI_PRICING_REVIEW, providerModel };
}

function baseMetadata(
  docsUrl: string,
  mode: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kieModelFamily: FAMILY,
    docsUrl,
    playgroundUrl: PLAYGROUND_URL,
    docsCheckedAt: GENERAL_PHASE1_DOCS_CHECKED_AT,
    source: KIE_METADATA_SOURCE_LINE,
    kieMode: mode,
    publicReady: false,
    requiresManualKieTest: true,
    pricingNeedsReview: true,
    reason: PRICING_REASON,
    ...extra,
  };
}

const VIDEO_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "imageUrls",
      label: "Референс-изображения",
      type: "image-upload-list",
      required: false,
      maxItems: 7,
      helpText:
        "До 7 изображений (каждое = 1 ед. квоты). Загрузка через /api/uploads.",
    },
    {
      name: "videoList",
      label: "Исходное видео (фрагмент)",
      type: "json",
      required: false,
      defaultValue: "[]",
      helpText:
        'JSON-массив из одного объекта: {"url":"https://…","start":0,"ends":10}. Видео = 2 ед. квоты; ends − start ≤ 10 с.',
    },
    {
      name: "characterIds",
      label: "Character IDs",
      type: "url-list",
      required: false,
      maxItems: 3,
      helpText:
        "ID персонажей из gemini-omni-character (до 3, каждый = 1 ед. квоты).",
    },
    {
      name: "audioIds",
      label: "Audio IDs",
      type: "url-list",
      required: false,
      maxItems: 3,
      helpText:
        "ID голосов из gemini-omni-audio (до 3). Не расходуют квоту изображений.",
    },
    {
      name: "duration",
      label: "Длительность",
      type: "select",
      required: true,
      defaultValue: "8",
      options: [
        { label: "4 с", value: "4" },
        { label: "6 с", value: "6" },
        { label: "8 с", value: "8" },
        { label: "10 с", value: "10" },
      ],
      helpText:
        "При списке видео длительность может определяться моделью автоматически.",
    },
    {
      name: "aspectRatio",
      label: "Формат",
      type: "select",
      required: false,
      defaultValue: "16:9",
      options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
      ],
    },
    {
      name: "resolution",
      label: "Разрешение",
      type: "select",
      required: false,
      defaultValue: "720p",
      options: [
        { label: "720p", value: "720p" },
        { label: "1080p", value: "1080p" },
        { label: "4K", value: "4k" },
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

const VIDEO_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["duration"],
  coerce: {
    image_urls: "stringArray",
    audio_ids: "stringArray",
    character_ids: "stringArray",
    duration: "string",
    aspect_ratio: "string",
    resolution: "string",
    seed: "number",
  },
  input: {
    image_urls: "$settings.imageUrls",
    audio_ids: "$settings.audioIds",
    character_ids: "$settings.characterIds",
    duration: "$settings.duration",
    aspect_ratio: "$settings.aspectRatio",
    resolution: "$settings.resolution",
    seed: "$settings.seed",
  },
};

const AUDIO_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "audioId",
      label: "Базовый голос (audio_id)",
      type: "select",
      required: true,
      defaultValue: "achernar",
      options: [...VOICE_OPTIONS],
    },
    {
      name: "name",
      label: "Имя голоса",
      type: "text",
      required: true,
      maxLength: 210,
      helpText: "До 210 символов. После генерации получите идентификатор голоса для видео.",
    },
    {
      name: "voiceDescription",
      label: "Описание голоса",
      type: "textarea",
      required: false,
      maxLength: 20000,
    },
    {
      name: "exampleDialogue",
      label: "Пример диалога",
      type: "textarea",
      required: false,
      maxLength: 120,
      helpText: 'Например: «Hello, I am Adam».',
    },
  ],
} as const satisfies Record<string, unknown>;

const CHARACTER_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "descriptions",
      label: "Описание персонажа",
      type: "textarea",
      required: true,
      helpText: "Внешность, стиль, одежда, характер персонажа.",
    },
    {
      name: "imageUrls",
      label: "Референс персонажа",
      type: "image-upload-list",
      required: true,
      maxItems: 1,
      helpText: "Ровно 1 изображение до 20 MB, публичный HTTPS URL.",
    },
    {
      name: "audioIds",
      label: "Голос персонажа (опционально)",
      type: "url-list",
      required: false,
      maxItems: 3,
      helpText: "Идентификатор голоса из шага синтеза голоса (если нужен свой голос).",
    },
    {
      name: "characterName",
      label: "Имя персонажа",
      type: "text",
      required: false,
    },
  ],
} as const satisfies Record<string, unknown>;

export const GEMINI_OMNI_MODELS: readonly GeminiOmniSeedRow[] = [
  {
    slug: "gemini-omni-video",
    name: "Gemini Omni Video",
    type: "VIDEO",
    apiModelId: "gemini-omni-video",
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    supportsImageInput: true,
    supportsVideoInput: true,
    supportsNegativePrompt: false,
    supportsSeed: true,
    maxDuration: 10,
    metadata: baseMetadata(
      "https://docs.kie.ai/market/gemini-omni-video",
      "video",
    ),
    description:
      "Gemini Omni: мультимодальное видео — prompt, image_urls, video_list, audio_ids, character_ids.",
    availableAspectRatios: ["16:9", "9:16"],
    availableResolutions: ["720p", "1080p", "4k"],
    settingsSchema: { ...VIDEO_SETTINGS },
    payloadMapping: VIDEO_PAYLOAD,
    pricingSchema: omniPricing("gemini-omni-video"),
    costCredits: 250,
    realCost: null,
  },
  {
    slug: "gemini-omni-audio",
    name: "Gemini Omni Audio",
    type: "VIDEO",
    apiModelId: "gemini-omni-audio",
    endpoint: "/api/v1/omni/audio/create",
    statusEndpoint: null,
    supportsImageInput: false,
    supportsVideoInput: false,
    supportsNegativePrompt: false,
    supportsSeed: false,
    maxDuration: null,
    metadata: baseMetadata(
      "https://docs.kie.ai/market/gemini-omni-audio",
      "audio-helper",
      { kieOmniSync: true, helperFor: "gemini-omni-video" },
    ),
    description:
      "Gemini Omni Audio: синхронное создание голоса (kieAudioId) для audio_ids в видео.",
    availableAspectRatios: [],
    availableResolutions: [],
    settingsSchema: { ...AUDIO_SETTINGS },
    payloadMapping: { adapter: "custom", input: {} },
    pricingSchema: {
      ...omniPricing("gemini-omni-audio"),
      defaultCredits: 30,
      fallbackCredits: 50,
    },
    costCredits: 30,
    realCost: null,
  },
  {
    slug: "gemini-omni-character",
    name: "Gemini Omni Character",
    type: "VIDEO",
    apiModelId: "gemini-omni-character",
    endpoint: "/api/v1/omni/character/create",
    statusEndpoint: null,
    supportsImageInput: true,
    supportsVideoInput: false,
    supportsNegativePrompt: false,
    supportsSeed: false,
    maxDuration: null,
    metadata: baseMetadata(
      "https://docs.kie.ai/market/gemini-omni-character",
      "character-helper",
      { kieOmniSync: true, helperFor: "gemini-omni-video" },
    ),
    description:
      "Gemini Omni Character: синхронное создание персонажа (characterId) для character_ids в видео.",
    availableAspectRatios: [],
    availableResolutions: [],
    settingsSchema: { ...CHARACTER_SETTINGS },
    payloadMapping: { adapter: "custom", input: {} },
    pricingSchema: {
      ...omniPricing("gemini-omni-character"),
      defaultCredits: 40,
      fallbackCredits: 60,
    },
    costCredits: 40,
    realCost: null,
  },
];
