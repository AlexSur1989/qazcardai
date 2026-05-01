/**
 * Создаёт или обновляет тестовую видео-модель Wan 2.7 Text-to-Video (Kie.ai).
 * Запуск: npm run seed:wan
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
      options: ["16:9", "9:16", "1:1"],
      required: true,
    },
    {
      name: "duration",
      type: "select",
      label: "Длительность",
      default: "5",
      options: ["5"],
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
      label: "Audio URL",
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

const PRICING_SCHEMA = {
  type: "matrix",
  currency: "KZT",
  internalTokenValueKzt: 10,
  provider: "KIE_AI",
  providerModel: "wan/2-7-text-to-video",
  defaultCredits: 100,
  matrix: {
    "720p": {
      "5": 80,
    },
    "1080p": {
      "5": 120,
    },
  },
  fallbackCredits: 100,
} as const;

const PAYLOAD_MAPPING = {
  prompt: "input.prompt",
  negativePrompt: "input.negative_prompt",
  audioUrl: "input.audio_url",
  resolution: "input.resolution",
  ratio: "input.ratio",
  duration: "input.duration",
  promptExtend: "input.prompt_extend",
  watermark: "input.watermark",
  seed: "input.seed",
} as const;

async function main() {
  const row = await prisma.aiModel.upsert({
    where: { slug: "wan-2-7-text-to-video" },
    create: {
      name: "Wan 2.7 Text to Video",
      slug: "wan-2-7-text-to-video",
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "wan/2-7-text-to-video",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 100,
      realCost: 0,
      isActive: true,
      supportsImageInput: false,
      supportsVideoInput: false,
      supportsNegativePrompt: true,
      supportsSeed: true,
      maxDuration: 5,
      description:
        "Wan 2.7 Text-to-Video — модель для генерации видео по текстовому описанию. Поддерживает negative prompt, audio URL, разрешение, формат кадра, prompt extend, watermark и seed.",
      availableAspectRatios: ["16:9", "9:16", "1:1"],
      availableResolutions: ["720p", "1080p"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: { ...PRICING_SCHEMA },
      payloadMapping: { ...PAYLOAD_MAPPING },
    },
    update: {
      name: "Wan 2.7 Text to Video",
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "wan/2-7-text-to-video",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 100,
      realCost: 0,
      isActive: true,
      supportsImageInput: false,
      supportsVideoInput: false,
      supportsNegativePrompt: true,
      supportsSeed: true,
      maxDuration: 5,
      description:
        "Wan 2.7 Text-to-Video — модель для генерации видео по текстовому описанию. Поддерживает negative prompt, audio URL, разрешение, формат кадра, prompt extend, watermark и seed.",
      availableAspectRatios: ["16:9", "9:16", "1:1"],
      availableResolutions: ["720p", "1080p"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: { ...PRICING_SCHEMA },
      payloadMapping: { ...PAYLOAD_MAPPING },
    },
  });
  console.log("[seed:wan] OK", row.id, row.slug);
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
