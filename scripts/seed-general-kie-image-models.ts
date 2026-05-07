/**
 * Kie.ai: модели scope GENERAL для /dashboard/create/image (не карточки товара).
 * Запуск: npm run seed:general-kie-image-models
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

const GPT_T2I_SLUG = "gpt-image-2-text-to-image-general";
const SEEDREAM_T2I_SLUG = "seedream-v4-text-to-image-general";

const GPT_PRICING = {
  type: "matrix",
  currency: "KZT",
  provider: "KIE_AI",
  providerModel: GPT_T2I_SLUG,
  resolutions: ["1K", "2K", "4K"],
  durations: [1],
  internalTokenValueKzt: 10,
  usdToKzt: 500,
  markupPercent: 150,
  defaultCredits: 20,
  matrix: {
    "1K": { "1": 20 },
    "2K": { "1": 25 },
    "4K": { "1": 35 },
  },
  providerCost: {
    noVideo: {
      "1K": { kieCreditsPerSecond: 6, usdPerSecond: 0.03 },
      "2K": { kieCreditsPerSecond: 10, usdPerSecond: 0.05 },
      "4K": { kieCreditsPerSecond: 16, usdPerSecond: 0.08 },
    },
  },
  manualOverrides: {
    matrix: {
      "1K": { "1": 20 },
      "2K": { "1": 25 },
      "4K": { "1": 35 },
    },
  },
  fallbackCredits: 20,
} as const;

const GPT_SETTINGS = {
  fields: [
    {
      name: "aspectRatio",
      type: "select",
      label: "Соотношение сторон",
      default: "1:1",
      options: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      required: true,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "1K",
      options: ["1K", "2K", "4K"],
      required: true,
    },
    {
      name: "duration",
      type: "hidden",
      label: "Pricing unit",
      default: "1",
      required: true,
    },
  ],
} as const;

const GPT_PAYLOAD = {
  prompt: "input.prompt",
  aspectRatio: "input.aspect_ratio",
  resolution: "input.resolution",
} as const;

const SEEDREAM_PRICING = {
  type: "matrix",
  currency: "KZT",
  provider: "KIE_AI",
  providerModel: SEEDREAM_T2I_SLUG,
  resolutions: ["1K", "2K", "4K"],
  durations: [1],
  internalTokenValueKzt: 10,
  usdToKzt: 500,
  markupPercent: 150,
  defaultCredits: 18,
  matrix: {
    "1K": { "1": 18 },
    "2K": { "1": 24 },
    "4K": { "1": 32 },
  },
  providerCost: {
    noVideo: {
      "1K": { kieCreditsPerSecond: 5, usdPerSecond: 0.025 },
      "2K": { kieCreditsPerSecond: 8, usdPerSecond: 0.04 },
      "4K": { kieCreditsPerSecond: 14, usdPerSecond: 0.07 },
    },
  },
  manualOverrides: {
    matrix: {
      "1K": { "1": 18 },
      "2K": { "1": 24 },
      "4K": { "1": 32 },
    },
  },
  fallbackCredits: 18,
} as const;

const SEEDREAM_SETTINGS = {
  fields: [
    {
      name: "size",
      type: "select",
      label: "Формат (image_size)",
      default: "square_hd",
      options: [
        "square",
        "square_hd",
        "portrait_4_3",
        "portrait_3_2",
        "portrait_16_9",
        "landscape_4_3",
        "landscape_3_2",
        "landscape_16_9",
        "landscape_21_9",
      ],
      required: true,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "1K",
      options: ["1K", "2K", "4K"],
      required: true,
    },
    {
      name: "numberOfImages",
      type: "select",
      label: "Число картинок",
      default: "1",
      options: ["1", "2", "3", "4", "5", "6"],
      required: true,
    },
    {
      name: "seed",
      type: "number",
      label: "Seed (необязательно)",
      required: false,
    },
    {
      name: "nsfwChecker",
      type: "boolean",
      label: "NSFW checker",
      default: false,
      required: false,
    },
    {
      name: "duration",
      type: "hidden",
      label: "Pricing unit",
      default: "1",
      required: true,
    },
  ],
} as const;

const SEEDREAM_PAYLOAD = {
  prompt: "input.prompt",
  size: "input.image_size",
  resolution: "input.image_resolution",
  numberOfImages: "input.max_images",
  seed: "input.seed",
  nsfwChecker: "input.nsfw_checker",
} as const;

async function main() {
  const gpt = await prisma.aiModel.upsert({
    where: { slug: GPT_T2I_SLUG },
    create: {
      name: "GPT Image 2 — текст → изображение",
      slug: GPT_T2I_SLUG,
      scope: "GENERAL",
      productCardModelType: null,
      provider: "KIE_AI",
      type: "IMAGE",
      apiModelId: "gpt-image-2-text-to-image",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 20,
      realCost: 0.03,
      isActive: true,
      supportsImageInput: false,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      description:
        "Генерация изображения по тексту через Kie.ai (модель gpt-image-2-text-to-image). Для раздела «Создать фото», не для карточек товара.",
      availableAspectRatios: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      availableResolutions: ["1K", "2K", "4K"],
      settingsSchema: { ...GPT_SETTINGS },
      pricingSchema: { ...GPT_PRICING },
      payloadMapping: { ...GPT_PAYLOAD },
    },
    update: {
      name: "GPT Image 2 — текст → изображение",
      scope: "GENERAL",
      productCardModelType: null,
      provider: "KIE_AI",
      type: "IMAGE",
      apiModelId: "gpt-image-2-text-to-image",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 20,
      realCost: 0.03,
      isActive: true,
      supportsImageInput: false,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      description:
        "Генерация изображения по тексту через Kie.ai (модель gpt-image-2-text-to-image). Для раздела «Создать фото», не для карточек товара.",
      availableAspectRatios: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      availableResolutions: ["1K", "2K", "4K"],
      settingsSchema: { ...GPT_SETTINGS },
      pricingSchema: { ...GPT_PRICING },
      payloadMapping: { ...GPT_PAYLOAD },
    },
  });

  const seedream = await prisma.aiModel.upsert({
    where: { slug: SEEDREAM_T2I_SLUG },
    create: {
      name: "Seedream 4.0 — текст → изображение",
      slug: SEEDREAM_T2I_SLUG,
      scope: "GENERAL",
      productCardModelType: null,
      provider: "KIE_AI",
      type: "IMAGE",
      apiModelId: "bytedance/seedream-v4-text-to-image",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 18,
      realCost: 0.025,
      isActive: true,
      supportsImageInput: false,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: true,
      description:
        "Фотореалистичные картинки по тексту (bytedance/seedream-v4-text-to-image). Для раздела «Создать фото».",
      availableAspectRatios: [],
      availableResolutions: ["1K", "2K", "4K"],
      settingsSchema: { ...SEEDREAM_SETTINGS },
      pricingSchema: { ...SEEDREAM_PRICING },
      payloadMapping: { ...SEEDREAM_PAYLOAD },
    },
    update: {
      name: "Seedream 4.0 — текст → изображение",
      scope: "GENERAL",
      productCardModelType: null,
      provider: "KIE_AI",
      type: "IMAGE",
      apiModelId: "bytedance/seedream-v4-text-to-image",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 18,
      realCost: 0.025,
      isActive: true,
      supportsImageInput: false,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: true,
      description:
        "Фотореалистичные картинки по тексту (bytedance/seedream-v4-text-to-image). Для раздела «Создать фото».",
      availableAspectRatios: [],
      availableResolutions: ["1K", "2K", "4K"],
      settingsSchema: { ...SEEDREAM_SETTINGS },
      pricingSchema: { ...SEEDREAM_PRICING },
      payloadMapping: { ...SEEDREAM_PAYLOAD },
    },
  });

  console.log("[seed:general-kie-image-models] OK");
  console.log("  GPT Image 2 T2I:", gpt.id, gpt.slug);
  console.log("  Seedream 4 T2I:", seedream.id, seedream.slug);
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
