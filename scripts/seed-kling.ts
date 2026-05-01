/**
 * Создаёт или обновляет модель Kling 3.0 (Kie.ai Market).
 * Запуск: npm run seed:kling
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
      name: "mode",
      type: "select",
      label: "Качество модели",
      default: "std",
      options: ["std", "pro", "4K"],
      required: true,
    },
    {
      name: "duration",
      type: "select",
      label: "Длительность",
      default: "5",
      options: ["5", "10", "15"],
      required: true,
    },
    {
      name: "sound",
      type: "boolean",
      label: "Сгенерировать звук",
      default: false,
      required: false,
    },
    {
      name: "aspectRatio",
      type: "select",
      label: "Соотношение сторон",
      default: "16:9",
      options: ["16:9", "9:16", "1:1"],
      required: true,
    },
    {
      name: "imageUrls",
      type: "url-list",
      label: "URL первого/последнего кадра",
      required: false,
    },
    {
      name: "multiShots",
      type: "boolean",
      label: "Multi-shot режим",
      default: false,
      required: false,
    },
  ],
} as const;

const PRICING_SCHEMA = {
  type: "matrix",
  matrixKeyStrategy: "kling_mode_sound",
  currency: "KZT",
  internalTokenValueKzt: 10,
  provider: "KIE_AI",
  providerModel: "kling-3.0",
  markupPercent: 40,
  defaultCredits: 46,
  matrix: {
    std_no_sound: {
      "5": 23,
      "10": 46,
      "15": 69,
    },
    std_sound: {
      "5": 33,
      "10": 66,
      "15": 98,
    },
    pro_no_sound: {
      "5": 30,
      "10": 59,
      "15": 88,
    },
    pro_sound: {
      "5": 44,
      "10": 88,
      "15": 132,
    },
    "4K": {
      "5": 110,
      "10": 219,
      "15": 328,
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
} as const;

const PAYLOAD_MAPPING = {
  prompt: "input.prompt",
  mode: "input.mode",
  duration: "input.duration",
  sound: "input.sound",
  aspectRatio: "input.aspect_ratio",
  imageUrls: "input.image_urls",
  multiShots: "input.multi_shots",
} as const;

async function main() {
  const row = await prisma.aiModel.upsert({
    where: { slug: "kling-3-0" },
    create: {
      name: "Kling 3.0",
      slug: "kling-3-0",
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "kling-3.0",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 46,
      realCost: 0,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      maxDuration: 15,
      description:
        "Kling 3.0 — видео-модель для генерации AI-видео по тексту и изображениям. Поддерживает режимы Standard, Pro и 4K, звук, single-shot и multi-shot, aspect ratio 16:9, 9:16 и 1:1, а также длительность до 15 секунд.",
      availableAspectRatios: ["16:9", "9:16", "1:1"],
      availableResolutions: ["std", "pro", "4K"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: { ...PRICING_SCHEMA },
      payloadMapping: { ...PAYLOAD_MAPPING },
    },
    update: {
      name: "Kling 3.0",
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "kling-3.0",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 46,
      realCost: 0,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      maxDuration: 15,
      description:
        "Kling 3.0 — видео-модель для генерации AI-видео по тексту и изображениям. Поддерживает режимы Standard, Pro и 4K, звук, single-shot и multi-shot, aspect ratio 16:9, 9:16 и 1:1, а также длительность до 15 секунд.",
      availableAspectRatios: ["16:9", "9:16", "1:1"],
      availableResolutions: ["std", "pro", "4K"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: { ...PRICING_SCHEMA },
      payloadMapping: { ...PAYLOAD_MAPPING },
    },
  });
  console.log("[seed:kling] OK", row.id, row.slug);
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
