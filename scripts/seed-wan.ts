/**
 * Wan 2.7 / 2.6 (Kie Market): записи AiModel (2.7 — text / image / R2V / video edit; 2.6 — text / image / video-to-video).
 * Запуск: npm run seed:wan
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { omitSeedPricingWhenPinned } from "./lib/omit-seed-pricing";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("В .env нужен DATABASE_URL");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const WAN_SHARED_ENDPOINT = "/api/v1/jobs/createTask";
const WAN_SHARED_STATUS_ENDPOINT = "/api/v1/jobs/recordInfo";

const MATRIX_T2V = {
  "720p": {
    "5": 80,
    "10": 95,
    "15": 110,
  },
  "1080p": {
    "5": 120,
    "10": 140,
    "15": 165,
  },
} as const;

const MATRIX_VARIANT = {
  "720p": {
    "5": 85,
    "10": 100,
    "15": 115,
  },
  "1080p": {
    "5": 125,
    "10": 150,
    "15": 172,
  },
} as const;

const SETTINGS_T2V = {
  fields: [
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "1080p",
      options: ["720p", "1080p"],
      required: true,
    },
    {
      name: "ratio",
      type: "select",
      label: "Соотношение сторон",
      default: "16:9",
      options: ["16:9", "9:16", "1:1", "4:3", "3:4"],
      required: true,
    },
    {
      name: "duration",
      type: "select",
      label: "Длительность (с)",
      default: "5",
      options: ["2", "5", "8", "10", "15"],
      required: true,
    },
    {
      name: "negativePrompt",
      type: "textarea",
      label: "Negative prompt",
      default: "blurry, low quality, flicker, distorted characters",
      required: false,
    },
    {
      name: "audioUrl",
      type: "url",
      label: "Audio URL (необязательно)",
      required: false,
    },
    {
      name: "promptExtend",
      type: "boolean",
      label: "Улучшить промпт",
      default: true,
      required: false,
    },
    {
      name: "watermark",
      type: "boolean",
      label: "Watermark",
      default: false,
      required: false,
    },
    {
      name: "seed",
      type: "number",
      label: "Seed",
      required: false,
    },
  ],
} as const;

const SETTINGS_I2V = {
  fields: [
    {
      name: "firstFrameUrl",
      type: "url",
      label: "URL первого кадра",
      required: false,
    },
    {
      name: "lastFrameUrl",
      type: "url",
      label: "URL последнего кадра",
      required: false,
    },
    {
      name: "firstClipUrl",
      type: "url",
      label: "URL клипа для продолжения",
      required: false,
    },
    {
      name: "drivingAudioUrl",
      type: "url",
      label: "Driving audio URL",
      required: false,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "1080p",
      options: ["720p", "1080p"],
      required: true,
    },
    {
      name: "duration",
      type: "select",
      label: "Длительность (с)",
      default: "5",
      options: ["2", "5", "8", "10", "15"],
      required: true,
    },
    {
      name: "negativePrompt",
      type: "textarea",
      label: "Negative prompt",
      required: false,
    },
    {
      name: "promptExtend",
      type: "boolean",
      label: "Улучшить промпт",
      default: true,
      required: false,
    },
    {
      name: "watermark",
      type: "boolean",
      label: "Watermark",
      default: false,
      required: false,
    },
    {
      name: "seed",
      type: "number",
      label: "Seed",
      required: false,
    },
  ],
} as const;

const SETTINGS_R2V = {
  fields: [
    {
      name: "referenceImageUrls",
      type: "url-list",
      label: "Reference image URLs (до 5)",
      maxItems: 5,
      required: false,
    },
    {
      name: "referenceVideoUrls",
      type: "video-upload-list",
      label: "Reference video URLs (до 5 всего с картинками)",
      maxItems: 5,
      required: false,
    },
    {
      name: "firstFrame",
      type: "url",
      label: "First frame URL",
      required: false,
    },
    {
      name: "referenceVoiceUrl",
      type: "url",
      label: "Reference voice / timbre audio URL",
      required: false,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "1080p",
      options: ["720p", "1080p"],
      required: true,
    },
    {
      name: "aspectRatio",
      type: "select",
      label: "Aspect ratio выхода",
      default: "16:9",
      options: ["16:9", "9:16", "1:1", "4:3", "3:4"],
      required: true,
    },
    {
      name: "duration",
      type: "select",
      label: "Длительность (с)",
      default: "5",
      options: ["2", "5", "8", "10"],
      required: true,
    },
    {
      name: "negativePrompt",
      type: "textarea",
      label: "Negative prompt",
      required: false,
    },
    {
      name: "promptExtend",
      type: "boolean",
      label: "Улучшить промпт",
      default: true,
      required: false,
    },
    {
      name: "watermark",
      type: "boolean",
      label: "Watermark",
      default: false,
      required: false,
    },
    {
      name: "seed",
      type: "number",
      label: "Seed",
      required: false,
    },
  ],
} as const;

const SETTINGS_EDIT = {
  fields: [
    {
      name: "videoUrl",
      type: "url",
      label: "URL исходного видео (обязательно)",
      required: true,
    },
    {
      name: "referenceImageUrl",
      type: "url",
      label: "Reference image (опционально)",
      required: false,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение выхода",
      default: "1080p",
      options: ["720p", "1080p"],
      required: true,
    },
    {
      name: "aspectRatio",
      type: "select",
      label: "Aspect ratio (опционально, иначе как у входного ролика)",
      default: "",
      options: ["", "16:9", "9:16", "1:1", "4:3", "3:4"],
      required: false,
    },
    {
      name: "duration",
      type: "select",
      label:
        "Выходная длительность: 0 = весь входной ролик; иначе обрезка до N с.",
      default: "0",
      options: ["0", "2", "5", "10"],
      required: true,
    },
    {
      name: "audioSetting",
      type: "select",
      label: "Звук",
      default: "auto",
      options: ["auto", "origin"],
      required: false,
    },
    {
      name: "negativePrompt",
      type: "textarea",
      label: "Negative prompt",
      required: false,
    },
    {
      name: "promptExtend",
      type: "boolean",
      label: "Улучшить промпт",
      default: true,
      required: false,
    },
    {
      name: "watermark",
      type: "boolean",
      label: "Watermark",
      default: false,
      required: false,
    },
    {
      name: "seed",
      type: "number",
      label: "Seed",
      required: false,
    },
  ],
} as const;

type WanSpec = {
  slug: string;
  name: string;
  apiModelId: string;
  description: string;
  supportsImageInput: boolean;
  supportsVideoInput: boolean;
  maxDuration: number;
  settingsSchema: { fields: readonly unknown[] };
  pricingSchema: Record<string, unknown>;
  payloadMapping?: Record<string, unknown>;
};

const WAN_MODELS: WanSpec[] = [
  {
    slug: "wan-2-7-text-to-video",
    name: "Wan 2.7 Text to Video",
    apiModelId: "wan/2-7-text-to-video",
    description:
      "Wan 2.7 Text→Video (Kie: wan/2-7-text-to-video). Ratio, аудио, negative prompt.",
    supportsImageInput: false,
    supportsVideoInput: false,
    maxDuration: 15,
    settingsSchema: SETTINGS_T2V,
    pricingSchema: {
      type: "matrix",
      currency: "KZT",
      internalTokenValueKzt: 10,
      provider: "KIE_AI",
      providerModel: "wan/2-7-text-to-video",
      defaultCredits: 100,
      matrix: { ...MATRIX_T2V },
      fallbackCredits: 100,
    },
    payloadMapping: {
      prompt: "input.prompt",
      negativePrompt: "input.negative_prompt",
      audioUrl: "input.audio_url",
      resolution: "input.resolution",
      ratio: "input.ratio",
      duration: "input.duration",
      promptExtend: "input.prompt_extend",
      watermark: "input.watermark",
      seed: "input.seed",
    },
  },
  {
    slug: "wan-2-7-image-to-video",
    name: "Wan 2.7 Image to Video",
    apiModelId: "wan/2-7-image-to-video",
    description:
      "Wan 2.7 Image→Video (wan/2-7-image-to-video): first/last frame, clip continuation, driving audio.",
    supportsImageInput: true,
    supportsVideoInput: true,
    maxDuration: 15,
    settingsSchema: SETTINGS_I2V,
    pricingSchema: {
      type: "matrix",
      currency: "KZT",
      internalTokenValueKzt: 10,
      provider: "KIE_AI",
      providerModel: "wan/2-7-image-to-video",
      defaultCredits: 100,
      matrix: { ...MATRIX_VARIANT },
      fallbackCredits: 100,
    },
  },
  {
    slug: "wan-2-7-r2v",
    name: "Wan 2.7 Reference to Video",
    apiModelId: "wan/2-7-r2v",
    description:
      "Wan 2.7 Reference→Video (wan/2-7-r2v): reference images/videos, first frame, voice.",
    supportsImageInput: true,
    supportsVideoInput: true,
    maxDuration: 10,
    settingsSchema: SETTINGS_R2V,
    pricingSchema: {
      type: "matrix",
      currency: "KZT",
      internalTokenValueKzt: 10,
      provider: "KIE_AI",
      providerModel: "wan/2-7-r2v",
      defaultCredits: 100,
      matrix: { ...MATRIX_VARIANT },
      fallbackCredits: 100,
    },
  },
  {
    slug: "wan-2-7-videoedit",
    name: "Wan 2.7 Video Edit",
    apiModelId: "wan/2-7-videoedit",
    description:
      "Wan 2.7 Video Edit (wan/2-7-videoedit): исходный ролик, промпт и опционально референс-кадр.",
    supportsImageInput: true,
    supportsVideoInput: true,
    maxDuration: 10,
    settingsSchema: SETTINGS_EDIT,
    pricingSchema: {
      type: "matrix",
      currency: "KZT",
      internalTokenValueKzt: 10,
      provider: "KIE_AI",
      providerModel: "wan/2-7-videoedit",
      defaultCredits: 100,
      matrix: { ...MATRIX_VARIANT },
      fallbackCredits: 100,
    },
  },
  {
    slug: "wan-2-6-text-to-video",
    name: "Wan 2.6 Text to Video",
    apiModelId: "wan/2-6-text-to-video",
    description:
      "Wan 2.6 Text→Video (Kie: wan/2-6-text-to-video). Поля как у Wan 2.7 T2V: ratio, аудио, negative prompt.",
    supportsImageInput: false,
    supportsVideoInput: false,
    maxDuration: 15,
    settingsSchema: SETTINGS_T2V,
    pricingSchema: {
      type: "matrix",
      currency: "KZT",
      internalTokenValueKzt: 10,
      provider: "KIE_AI",
      providerModel: "wan/2-6-text-to-video",
      defaultCredits: 100,
      matrix: { ...MATRIX_T2V },
      fallbackCredits: 100,
    },
    payloadMapping: {
      prompt: "input.prompt",
      negativePrompt: "input.negative_prompt",
      audioUrl: "input.audio_url",
      resolution: "input.resolution",
      ratio: "input.ratio",
      duration: "input.duration",
      promptExtend: "input.prompt_extend",
      watermark: "input.watermark",
      seed: "input.seed",
    },
  },
  {
    slug: "wan-2-6-image-to-video",
    name: "Wan 2.6 Image to Video",
    apiModelId: "wan/2-6-image-to-video",
    description:
      "Wan 2.6 Image→Video (wan/2-6-image-to-video): first/last frame, clip continuation, driving audio — как Wan 2.7 I2V.",
    supportsImageInput: true,
    supportsVideoInput: true,
    maxDuration: 15,
    settingsSchema: SETTINGS_I2V,
    pricingSchema: {
      type: "matrix",
      currency: "KZT",
      internalTokenValueKzt: 10,
      provider: "KIE_AI",
      providerModel: "wan/2-6-image-to-video",
      defaultCredits: 100,
      matrix: { ...MATRIX_VARIANT },
      fallbackCredits: 100,
    },
  },
  {
    slug: "wan-2-6-video-to-video",
    name: "Wan 2.6 Video to Video",
    apiModelId: "wan/2-6-video-to-video",
    description:
      "Wan 2.6 Video→Video (wan/2-6-video-to-video): исходный ролик + промпт (поля input как у Wan 2.7 Video Edit).",
    supportsImageInput: true,
    supportsVideoInput: true,
    maxDuration: 10,
    settingsSchema: SETTINGS_EDIT,
    pricingSchema: {
      type: "matrix",
      currency: "KZT",
      internalTokenValueKzt: 10,
      provider: "KIE_AI",
      providerModel: "wan/2-6-video-to-video",
      defaultCredits: 100,
      matrix: { ...MATRIX_VARIANT },
      fallbackCredits: 100,
    },
  },
];

async function main() {
  for (const spec of WAN_MODELS) {
    const guard = await prisma.aiModel.findUnique({
      where: { slug: spec.slug },
      select: { pricingSchema: true },
    });
    const row = await prisma.aiModel.upsert({
      where: { slug: spec.slug },
      create: {
        name: spec.name,
        slug: spec.slug,
        provider: "KIE_AI",
        type: "VIDEO",
        apiModelId: spec.apiModelId,
        endpoint: WAN_SHARED_ENDPOINT,
        statusEndpoint: WAN_SHARED_STATUS_ENDPOINT,
        costCredits: 100,
        realCost: 0,
        isActive: true,
        supportsImageInput: spec.supportsImageInput,
        supportsVideoInput: spec.supportsVideoInput,
        supportsNegativePrompt: true,
        supportsSeed: true,
        maxDuration: spec.maxDuration,
        description: spec.description,
        availableAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
        availableResolutions: ["720p", "1080p"],
        settingsSchema: { fields: [...spec.settingsSchema.fields] } as object,
        pricingSchema: spec.pricingSchema as object,
        ...(spec.payloadMapping != null
          ? { payloadMapping: spec.payloadMapping as object }
          : {}),
      },
      update: omitSeedPricingWhenPinned(guard, {
        name: spec.name,
        provider: "KIE_AI",
        type: "VIDEO",
        apiModelId: spec.apiModelId,
        endpoint: WAN_SHARED_ENDPOINT,
        statusEndpoint: WAN_SHARED_STATUS_ENDPOINT,
        costCredits: 100,
        realCost: 0,
        isActive: true,
        supportsImageInput: spec.supportsImageInput,
        supportsVideoInput: spec.supportsVideoInput,
        supportsNegativePrompt: true,
        supportsSeed: true,
        maxDuration: spec.maxDuration,
        description: spec.description,
        availableAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
        availableResolutions: ["720p", "1080p"],
        settingsSchema: { fields: [...spec.settingsSchema.fields] } as object,
        pricingSchema: spec.pricingSchema as object,
        payloadMapping:
          spec.payloadMapping != null
            ? (spec.payloadMapping as object)
            : Prisma.DbNull,
      }) as Prisma.AiModelUpdateInput,
    });
    console.log("[seed:wan]", row.slug, row.id);
  }
  console.log("[seed:wan] OK", WAN_MODELS.length, "моделей");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
