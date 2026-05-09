/**
 * Создаёт или обновляет видео-модель Bytedance Seedance 1.5 Pro (Kie.ai).
 * Запуск: npm run seed:seedance-1-5-pro
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("В .env нужен DATABASE_URL");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SLUG = "seedance-1-5-pro";

const SETTINGS_SCHEMA = {
  fields: [
    {
      name: "scenario",
      type: "select",
      label: "Сценарий генерации",
      default: "text-to-video",
      options: [
        "text-to-video",
        "first-frame",
        "first-last-frame",
        "reference-to-video",
      ],
      required: true,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "720p",
      options: ["480p", "720p", "1080p"],
      required: true,
    },
    {
      name: "aspectRatio",
      type: "select",
      label: "Соотношение сторон (aspect_ratio)",
      default: "16:9",
      options: [
        "1:1",
        "4:3",
        "3:4",
        "16:9",
        "9:16",
        "21:9",
        "adaptive",
      ],
      required: true,
    },
    {
      name: "duration",
      type: "select",
      label: "Длительность",
      default: 5,
      options: [4, 5, 6, 8, 10, 12, 15],
      required: true,
    },
    {
      name: "firstFrameUrl",
      type: "image-upload",
      label: "Первый кадр (first_frame_url)",
      required: false,
    },
    {
      name: "lastFrameUrl",
      type: "image-upload",
      label: "Последний кадр (last_frame_url)",
      required: false,
    },
    {
      name: "referenceImageUrls",
      type: "image-upload-list",
      label: "Референс-изображения (JPEG, PNG, WEBP, до 10 МБ, до 9 файлов — как в Kie)",
      maxItems: 9,
      required: false,
    },
    {
      name: "referenceVideoUrls",
      type: "video-upload-list",
      label: "Референс-видео (с компьютера, до 3 файлов, до 50 МБ каждый)",
      maxItems: 3,
      required: false,
    },
    {
      name: "referenceAudioUrls",
      type: "audio-upload-list",
      label: "Референс-аудио (MP3, WAV, AAC, OGG, до 15 МБ, до 3 файлов)",
      maxItems: 3,
      required: false,
    },
    {
      name: "returnLastFrame",
      type: "boolean",
      label: "Вернуть последний кадр (return_last_frame)",
      default: false,
      required: false,
    },
    {
      name: "generateAudio",
      type: "boolean",
      label: "Сгенерировать звук (в Kie API по умолчанию true; выше стоимость при включении)",
      default: false,
      required: false,
    },
    {
      name: "webSearch",
      type: "boolean",
      label: "Web search (web_search)",
      default: false,
      required: false,
    },
    {
      name: "nsfwChecker",
      type: "boolean",
      label: "Kie-фильтр контента (nsfw_checker; false — фильтр отключён)",
      default: false,
      required: false,
    },
  ],
} as const;

const PRICING_SCHEMA = {
  type: "matrix",
  currency: "KZT",
  internalTokenValueKzt: 10,
  usdToKzt: 500,
  markupPercent: 40,
  provider: "KIE_AI",
  providerModel: "bytedance/seedance-1.5-pro",
  pricingSource: "provider_cost_calculator",
  durations: [4, 5, 6, 8, 10, 12, 15],
  resolutions: ["480p", "720p", "1080p"],
  defaultCredits: 67,
  manualOverrides: {
    matrix: {} as Record<string, Record<string, number>>,
    videoInputMatrix: {} as Record<string, Record<string, number>>,
  },
  matrix: {
    "480p": {
      "4": 25,
      "5": 31,
      "6": 38,
      "8": 50,
      "10": 62,
      "12": 75,
      "15": 93,
    },
    "720p": {
      "4": 54,
      "5": 67,
      "6": 81,
      "8": 107,
      "10": 134,
      "12": 161,
      "15": 201,
    },
    "1080p": {
      "4": 133,
      "5": 167,
      "6": 200,
      "8": 266,
      "10": 333,
      "12": 400,
      "15": 499,
    },
  },
  videoInputMatrix: {
    "480p": {
      "4": 15,
      "5": 19,
      "6": 23,
      "8": 31,
      "10": 38,
      "12": 46,
      "15": 57,
    },
    "720p": {
      "4": 33,
      "5": 41,
      "6": 50,
      "8": 66,
      "10": 82,
      "12": 99,
      "15": 123,
    },
    "1080p": {
      "4": 81,
      "5": 101,
      "6": 121,
      "8": 162,
      "10": 202,
      "12": 242,
      "15": 303,
    },
  },
  addOns: {
    generateAudio: 0,
    returnLastFrame: 1,
    webSearch: 0,
    nsfwChecker: 0,
  },
  providerCost: {
    withVideo: {
      "480p": { kieCreditsPerSecond: 11.5, usdPerSecond: 0.0575 },
      "720p": { kieCreditsPerSecond: 25, usdPerSecond: 0.125 },
      "1080p": { kieCreditsPerSecond: 62, usdPerSecond: 0.31 },
    },
    noVideo: {
      "480p": { kieCreditsPerSecond: 19, usdPerSecond: 0.095 },
      "720p": { kieCreditsPerSecond: 41, usdPerSecond: 0.205 },
      "1080p": { kieCreditsPerSecond: 102, usdPerSecond: 0.51 },
    },
  },
  fallbackCredits: 67,
} as const;

const PAYLOAD_MAPPING = {
  prompt: "input.prompt",
  firstFrameUrl: "input.first_frame_url",
  lastFrameUrl: "input.last_frame_url",
  referenceImageUrls: "input.reference_image_urls",
  referenceVideoUrls: "input.reference_video_urls",
  referenceAudioUrls: "input.reference_audio_urls",
  returnLastFrame: "input.return_last_frame",
  generateAudio: "input.generate_audio",
  resolution: "input.resolution",
  aspectRatio: "input.aspect_ratio",
  duration: "input.duration",
  webSearch: "input.web_search",
  nsfwChecker: "input.nsfw_checker",
} as const;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function manualOverridesNonEmpty(mo: unknown): boolean {
  if (!isRecord(mo)) return false;
  for (const b of [mo.matrix, mo.videoInputMatrix]) {
    if (!isRecord(b)) continue;
    for (const row of Object.values(b)) {
      if (!isRecord(row)) continue;
      for (const v of Object.values(row)) {
        if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
          return true;
        }
      }
    }
  }
  return false;
}

function mergeSeedancePricing(
  existing: unknown,
  next: typeof PRICING_SCHEMA,
) {
  if (!existing || !isRecord(existing)) {
    return { ...next };
  }
  if (!manualOverridesNonEmpty(existing.manualOverrides)) {
    return { ...next };
  }
  return {
    ...next,
    manualOverrides: isRecord(existing.manualOverrides)
      ? existing.manualOverrides
      : next.manualOverrides,
  };
}

const DESCRIPTION =
  "Bytedance Seedance 1.5 Pro (Kie: bytedance/seedance-1.5-pro). Тот же профиль полей input, что Seedance 2.0: text-to-video, first/last frame, reference; resolution 480p/720p/1080p; 4–15 с.";

async function main() {
  const existing = await prisma.aiModel.findUnique({
    where: { slug: SLUG },
    select: { pricingSchema: true },
  });
  const pricingForUpdate = mergeSeedancePricing(existing?.pricingSchema, PRICING_SCHEMA);
  const row = await prisma.aiModel.upsert({
    where: { slug: SLUG },
    create: {
      name: "Seedance 1.5 Pro",
      slug: SLUG,
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "bytedance/seedance-1.5-pro",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 67,
      realCost: 0,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: true,
      supportsNegativePrompt: false,
      supportsSeed: false,
      maxDuration: 15,
      description: DESCRIPTION,
      availableAspectRatios: [
        "1:1",
        "4:3",
        "3:4",
        "16:9",
        "9:16",
        "21:9",
        "adaptive",
      ],
      availableResolutions: ["480p", "720p", "1080p"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: { ...PRICING_SCHEMA } as object,
      payloadMapping: { ...PAYLOAD_MAPPING },
    },
    update: {
      name: "Seedance 1.5 Pro",
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "bytedance/seedance-1.5-pro",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 67,
      realCost: 0,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: true,
      supportsNegativePrompt: false,
      supportsSeed: false,
      maxDuration: 15,
      description: DESCRIPTION,
      availableAspectRatios: [
        "1:1",
        "4:3",
        "3:4",
        "16:9",
        "9:16",
        "21:9",
        "adaptive",
      ],
      availableResolutions: ["480p", "720p", "1080p"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: pricingForUpdate as object,
      payloadMapping: { ...PAYLOAD_MAPPING },
    },
  });
  console.log("[seed:seedance-1-5-pro] OK", row.id, row.slug);
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
