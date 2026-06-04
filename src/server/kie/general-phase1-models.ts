/**
 * Единый реестр GENERAL-моделей Kie фазы 1 (GPT Image 2 T2I/I2I, Kling 2.6 T2V/I2V).
 * Сид и verify импортируют только отсюда — не дублировать схемы в скриптах.
 */

import type { KiePayloadMapping } from "@/server/services/kiePayloadMapping";

export const GENERAL_PHASE1_DOCS_CHECKED_AT = "2026-05-11";

/** Единая строка для поля metadata.source (сверка каталога с Kie). */
export const KIE_METADATA_SOURCE_LINE = "docs.kie.ai + kie.ai playground";

/** Для Kie: без aspect допускается только 1K — в теле создаём согласованный aspect_ratio:auto. */
export function normalizeGptImage2AspectIfOmittedForKie(
  apiModelId: string,
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const id = apiModelId.trim();
  if (
    id !== "gpt-image-2-text-to-image" &&
    id !== "gpt-image-2-image-to-image"
  ) {
    return settings;
  }
  const r = String(settings.resolution ?? "").trim();
  const raw = settings.aspectRatio;
  const missing =
    raw === undefined || raw === null || String(raw).trim() === "";
  if (missing && r === "1K") {
    return { ...settings, aspectRatio: "auto" };
  }
  return settings;
}

export const GENERAL_PHASE1_SLUG_ORDER = [
  "gpt-image-2-text-to-image",
  "gpt-image-2-image-to-image",
  "kling-2-6-text-to-video",
  "kling-2-6-image-to-video",
] as const;

export type GeneralPhase1Slug =
  (typeof GENERAL_PHASE1_SLUG_ORDER)[number];

type Phase1SeedRow = {
  slug: GeneralPhase1Slug;
  name: string;
  type: "IMAGE" | "VIDEO";
  apiModelId: string;
  supportsImageInput: boolean;
  maxDuration?: number | null;
  metadata: Record<string, string>;
  description: string;
  availableAspectRatios: string[];
  availableResolutions: string[];
  settingsSchema: Record<string, unknown>;
  payloadMapping: KiePayloadMapping;
  pricingSchema: Record<string, unknown>;
  costCredits: number;
  realCost: number | null;
};

/** OpenAPI Kie: enum 1K | 2K | 4K; см. описание resolution (auto → только 1K; 1:1 → не 4K). */
const GPT_RESOLUTION_FIELD = {
  name: "resolution",
  label: "Разрешение",
  type: "select",
  required: true,
  defaultValue: "1K",
  helpText:
    "При формате Auto допустимо только 1K; для 1:1 недоступно 4K.",
  options: [
    { label: "1K", value: "1K" },
    { label: "2K", value: "2K" },
    { label: "4K", value: "4K" },
  ],
} as const satisfies Record<string, unknown>;

const GPT_T2I_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "aspectRatio",
      label: "Формат",
      type: "select",
      required: true,
      defaultValue: "auto",
      options: [
        { label: "Auto", value: "auto" },
        { label: "1:1", value: "1:1" },
        { label: "9:16", value: "9:16" },
        { label: "16:9", value: "16:9" },
        { label: "4:3", value: "4:3" },
        { label: "3:4", value: "3:4" },
      ],
    },
    { ...GPT_RESOLUTION_FIELD },
  ],
} as const satisfies Record<string, unknown>;

const GPT_I2I_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "inputUrls",
      label: "Исходные изображения",
      type: "upload-list",
      required: true,
      maxItems: 16,
      accept: "image/*",
      purpose: "generation_input",
    },
    ...GPT_T2I_SETTINGS.fields,
  ],
} as const satisfies Record<string, unknown>;

const GPT_T2I_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["aspect_ratio", "resolution"],
  input: {
    aspect_ratio: "$settings.aspectRatio",
    resolution: "$settings.resolution",
  },
  coerce: {
    aspect_ratio: "string",
    resolution: "string",
  },
};

const GPT_I2I_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["input_urls", "aspect_ratio", "resolution"],
  input: {
    input_urls: "$settings.inputUrls",
    aspect_ratio: "$settings.aspectRatio",
    resolution: "$settings.resolution",
  },
  coerce: {
    input_urls: "stringArray",
    aspect_ratio: "string",
    resolution: "string",
  },
};

const GPT_FORMULA_PRICING: Record<string, unknown> = {
  type: "formula",
  baseCredits: 50,
  rules: [
    { when: { field: "resolution", equals: "2K" }, multiply: 2 },
    { when: { field: "resolution", equals: "4K" }, multiply: 4 },
  ],
  round: "ceil",
  minCredits: 50,
};

const KLING_26_PRICING_BASE = {
  type: "matrix",
  matrixKeyStrategy: "kling_mode_sound",
  currency: "KZT",
  internalTokenValueKzt: 10,
  provider: "KIE_AI",
  markupPercent: 40,
  defaultCredits: 46,
  matrix: {
    std_no_sound: {
      "5": 23,
      "10": 46,
    },
    std_sound: {
      "5": 33,
      "10": 66,
    },
    pro_no_sound: {
      "5": 30,
      "10": 59,
    },
    pro_sound: {
      "5": 44,
      "10": 88,
    },
    "4K": {
      "5": 110,
      "10": 219,
    },
  },
  providerCost: {
    std_no_sound: {
      kieCreditsPerSecond: 14,
      usdPerSecond: 0.07,
    },
    std_sound: {
      kieCreditsPerSecond: 20,
      usdPerSecond: 0.1,
    },
    pro_no_sound: {
      kieCreditsPerSecond: 18,
      usdPerSecond: 0.09,
    },
    pro_sound: {
      kieCreditsPerSecond: 27,
      usdPerSecond: 0.135,
    },
    "4K": {
      kieCreditsPerSecond: 67,
      usdPerSecond: 0.335,
    },
  },
  fallbackCredits: 46,
} satisfies Record<string, unknown>;

function klingPricingFor(providerModel: string): Record<string, unknown> {
  return {
    ...KLING_26_PRICING_BASE,
    providerModel,
  };
}

const KLING_T2V_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "duration",
      label: "Длительность",
      type: "select",
      required: true,
      defaultValue: "5",
      options: [
        { label: "5 сек", value: "5" },
        { label: "10 сек", value: "10" },
      ],
    },
    {
      name: "aspectRatio",
      label: "Формат",
      type: "select",
      required: true,
      defaultValue: "1:1",
      options: [
        { label: "1:1", value: "1:1" },
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
      ],
    },
    {
      name: "sound",
      label: "Звук",
      type: "boolean",
      required: true,
      defaultValue: false,
    },
  ],
} as const satisfies Record<string, unknown>;

const KLING_I2V_SETTINGS = {
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
      name: "duration",
      label: "Длительность",
      type: "select",
      required: true,
      defaultValue: "5",
      options: [
        { label: "5 сек", value: "5" },
        { label: "10 сек", value: "10" },
      ],
    },
    {
      name: "sound",
      label: "Звук",
      type: "boolean",
      required: true,
      defaultValue: false,
    },
  ],
} as const satisfies Record<string, unknown>;

const KLING_T2V_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["sound", "aspect_ratio", "duration"],
  input: {
    sound: "$settings.sound",
    aspect_ratio: "$settings.aspectRatio",
    duration: "$settings.duration",
  },
  coerce: {
    sound: "boolean",
    aspect_ratio: "string",
    duration: "string",
  },
};

const KLING_I2V_PAYLOAD: KiePayloadMapping = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["image_urls", "sound", "duration"],
  input: {
    image_urls: "$settings.imageUrls",
    sound: "$settings.sound",
    duration: "$settings.duration",
  },
  coerce: {
    image_urls: "stringArray",
    sound: "boolean",
    duration: "string",
  },
};

/** Полные описания строк для prisma upsert seed. */
export const GENERAL_PHASE1_MODELS: readonly Phase1SeedRow[] = [
  {
    slug: "gpt-image-2-text-to-image",
    name: "GPT Image 2 — Text to Image",
    type: "IMAGE",
    apiModelId: "gpt-image-2-text-to-image",
    supportsImageInput: false,
    metadata: {
      docsUrl:
        "https://docs.kie.ai/market/gpt/gpt-image-2-text-to-image",
      playgroundUrl: "https://kie.ai/gpt-image-2",
      docsCheckedAt: GENERAL_PHASE1_DOCS_CHECKED_AT,
      source: KIE_METADATA_SOURCE_LINE,
      kieModelFamily: "GPT Image 2",
      kieMode: "text-to-image",
    },
    description:
      "Генерация изображения по тексту (Kie: gpt-image-2-text-to-image).",
    availableAspectRatios: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
    availableResolutions: ["1K", "2K", "4K"],
    settingsSchema: { ...GPT_T2I_SETTINGS },
    payloadMapping: GPT_T2I_PAYLOAD,
    pricingSchema: { ...GPT_FORMULA_PRICING },
    costCredits: 50,
    realCost: 0.03,
  },
  {
    slug: "gpt-image-2-image-to-image",
    name: "GPT Image 2 — Image to Image",
    type: "IMAGE",
    apiModelId: "gpt-image-2-image-to-image",
    supportsImageInput: true,
    metadata: {
      docsUrl:
        "https://docs.kie.ai/market/gpt/gpt-image-2-image-to-image",
      playgroundUrl: "https://kie.ai/gpt-image-2",
      docsCheckedAt: GENERAL_PHASE1_DOCS_CHECKED_AT,
      source: KIE_METADATA_SOURCE_LINE,
      kieModelFamily: "GPT Image 2",
      kieMode: "image-to-image",
    },
    description:
      "Референсы + текст (Kie: gpt-image-2-image-to-image, поле Kie input_urls).",
    availableAspectRatios: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
    availableResolutions: ["1K", "2K", "4K"],
    settingsSchema: { ...GPT_I2I_SETTINGS },
    payloadMapping: GPT_I2I_PAYLOAD,
    pricingSchema: { ...GPT_FORMULA_PRICING },
    costCredits: 50,
    realCost: 0.03,
  },
  {
    slug: "kling-2-6-text-to-video",
    name: "Kling 2.6 — Text to Video",
    type: "VIDEO",
    apiModelId: "kling-2.6/text-to-video",
    supportsImageInput: false,
    maxDuration: 10,
    metadata: {
      docsUrl: "https://docs.kie.ai/market/kling/text-to-video",
      playgroundUrl: "https://kie.ai/kling-2-6",
      docsCheckedAt: GENERAL_PHASE1_DOCS_CHECKED_AT,
      source: KIE_METADATA_SOURCE_LINE,
      kieModelFamily: "Kling 2.6",
      kieMode: "text-to-video",
    },
    description:
      "Kling 2.6 Text→Video (Kie: kling-2.6/text-to-video).",
    availableAspectRatios: ["1:1", "16:9", "9:16"],
    availableResolutions: [],
    settingsSchema: { ...KLING_T2V_SETTINGS },
    payloadMapping: KLING_T2V_PAYLOAD,
    pricingSchema: klingPricingFor("kling-2.6/text-to-video"),
    costCredits: 46,
    realCost: 0,
  },
  {
    slug: "kling-2-6-image-to-video",
    name: "Kling 2.6 — Image to Video",
    type: "VIDEO",
    apiModelId: "kling-2.6/image-to-video",
    supportsImageInput: true,
    maxDuration: 10,
    metadata: {
      docsUrl: "https://docs.kie.ai/market/kling/image-to-video",
      playgroundUrl: "https://kie.ai/kling-2-6",
      docsCheckedAt: GENERAL_PHASE1_DOCS_CHECKED_AT,
      source: KIE_METADATA_SOURCE_LINE,
      kieModelFamily: "Kling 2.6",
      kieMode: "image-to-video",
    },
    description:
      "Kling 2.6 Image→Video (Kie: kling-2.6/image-to-video).",
    availableAspectRatios: [],
    availableResolutions: [],
    settingsSchema: { ...KLING_I2V_SETTINGS },
    payloadMapping: KLING_I2V_PAYLOAD,
    pricingSchema: klingPricingFor("kling-2.6/image-to-video"),
    costCredits: 46,
    realCost: 0,
  },
];

const PHASE1_ALLOWED_SETTINGS_BY_API_MODEL = new Map<string, ReadonlySet<string>>(
  [
    [
      "gpt-image-2-text-to-image",
      new Set(["aspectRatio", "resolution"]),
    ],
    [
      "gpt-image-2-image-to-image",
      new Set(["inputUrls", "aspectRatio", "resolution"]),
    ],
    ["kling-2.6/text-to-video", new Set(["duration", "aspectRatio", "sound"])],
    ["kling-2.6/image-to-video", new Set(["imageUrls", "duration", "sound"])],
  ],
);

export function phase1AllowedSettingsKeysForApiModel(
  apiModelId: string,
): ReadonlySet<string> | null {
  const k = apiModelId.trim();
  return PHASE1_ALLOWED_SETTINGS_BY_API_MODEL.get(k) ?? null;
}

export function phase1SlugByApiModelId(
  apiModelId: string,
): GeneralPhase1Slug | null {
  const k = apiModelId.trim();
  const row = GENERAL_PHASE1_MODELS.find((m) => m.apiModelId === k);
  return row?.slug ?? null;
}

export function listingFieldNamesFromSettingsSchema(
  schema: unknown,
): string[] {
  const s = schema as { fields?: unknown };
  const f = s?.fields;
  if (!Array.isArray(f)) return [];
  return f
    .filter(
      (x): x is { name: string } =>
        typeof x === "object" &&
        x !== null &&
        "name" in x &&
        typeof (x as { name: unknown }).name === "string",
    )
    .map((x) => x.name);
}
