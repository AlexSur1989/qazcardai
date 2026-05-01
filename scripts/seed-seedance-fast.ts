/**
 * Создаёт или обновляет видео-модель Bytedance Seedance 2.0 Fast (Kie.ai).
 * Запуск: npm run seed:seedance-fast
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

const SETTINGS_SCHEMA = {
  fields: [
    {
      name: "scenario",
      type: "select",
      label: "Сценарий генерации",
      default: "text-to-video",
      options: ["text-to-video", "first-frame", "first-last-frame", "reference-to-video"],
      required: true,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "720p",
      options: ["480p", "720p"],
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
      label: "Референс-видео (с компьютера, до 3 файлов, до 50 МБ каждый, API Seedance 2.0)",
      maxItems: 3,
      required: false,
    },
    {
      name: "referenceAudioUrls",
      type: "audio-upload-list",
      label: "Референс-аудио (MP3, WAV, AAC, OGG, до 15 МБ, до 3 файлов — как в Kie)",
      maxItems: 3,
      required: false,
    },
    {
      name: "returnLastFrame",
      type: "boolean",
      label: "Вернуть последний кадр (return_last_frame; в API deprecated)",
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
      label: "Kie-фильтр контента (nsfw_checker)",
      default: false,
      required: false,
    },
  ],
} as const;

const PRICING_SCHEMA = {
  type: "matrix",
  currency: "KZT",
  internalTokenValueKzt: 10,
  provider: "KIE_AI",
  providerModel: "bytedance/seedance-2-fast",
  defaultCredits: 55,
  matrix: {
    "480p": {
      "4": 20,
      "5": 25,
      "6": 30,
      "8": 40,
      "10": 50,
      "12": 61,
      "15": 76,
    },
    "720p": {
      "4": 43,
      "5": 55,
      "6": 65,
      "8": 86,
      "10": 108,
      "12": 129,
      "15": 162,
    },
  },
  videoInputMatrix: {
    "480p": {
      "4": 12,
      "5": 15,
      "6": 18,
      "8": 24,
      "10": 30,
      "12": 36,
      "15": 44,
    },
    "720p": {
      "4": 26,
      "5": 33,
      "6": 40,
      "8": 53,
      "10": 66,
      "12": 79,
      "15": 98,
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
      "480p": { kieCreditsPerSecond: 9, usdPerSecond: 0.045 },
      "720p": { kieCreditsPerSecond: 20, usdPerSecond: 0.1 },
    },
    noVideo: {
      "480p": { kieCreditsPerSecond: 15.5, usdPerSecond: 0.0775 },
      "720p": { kieCreditsPerSecond: 33, usdPerSecond: 0.165 },
    },
  },
  fallbackCredits: 55,
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

const DESCRIPTION =
  "Seedance 2.0 Fast (Kie: bytedance/seedance-2-fast). Быстрый вариант той же линейки API, что и Seedance 2.0: text-to-video, first/last frame, reference, aspect_ratio в т.ч. adaptive, 4–15 с. Док семейства: docs.kie.ai/market/bytedance/seedance-2";

async function main() {
  const row = await prisma.aiModel.upsert({
    where: { slug: "seedance-2-0-fast" },
    create: {
      name: "Seedance 2.0 Fast",
      slug: "seedance-2-0-fast",
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "bytedance/seedance-2-fast",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 55,
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
      availableResolutions: ["480p", "720p"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: { ...PRICING_SCHEMA },
      payloadMapping: { ...PAYLOAD_MAPPING },
    },
    update: {
      name: "Seedance 2.0 Fast",
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "bytedance/seedance-2-fast",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 55,
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
      availableResolutions: ["480p", "720p"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: { ...PRICING_SCHEMA },
      payloadMapping: { ...PAYLOAD_MAPPING },
    },
  });
  console.log("[seed:seedance-fast] OK", row.id, row.slug);
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
