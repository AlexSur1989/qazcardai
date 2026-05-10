/**
 * Happy Horse 1.0 (Kie Market): text / image / reference / video edit — один slug БД,
 * переключение сценария через settings.scenario и разные apiModelId в createTask на стороне kie.ts.
 * Запуск: npm run seed:happyhorse
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { omitSeedPricingWhenPinned } from "./lib/omit-seed-pricing";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("В .env нужен DATABASE_URL");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DURATION_OPTS = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
];

function matrixRow(
  baseLow: number,
  slope: number,
): Record<string, number> {
  const o: Record<string, number> = {};
  for (const d of DURATION_OPTS) {
    o[String(d)] = Math.max(1, Math.round(baseLow + slope * (d - 3)));
  }
  return o;
}

const SETTINGS_SCHEMA = {
  fields: [
    {
      name: "scenario",
      type: "select",
      label: "Режим генерации",
      default: "text-to-video",
      options: [
        "text-to-video",
        "image-to-video",
        "reference-to-video",
        "video-edit",
      ],
      required: true,
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
      label: "Соотношение сторон (text-to-video и reference-to-video)",
      default: "16:9",
      options: ["16:9", "9:16", "1:1", "4:3", "3:4"],
      required: true,
    },
    {
      name: "duration",
      type: "select",
      label: "Длительность, с (3–15; для video-edit игнорируется API, но участвует в оценке)",
      default: 5,
      options: DURATION_OPTS,
      required: true,
    },
    {
      name: "audioSetting",
      type: "select",
      label: "Аудио (только video-edit)",
      default: "auto",
      options: ["auto", "origin"],
      required: true,
    },
    {
      name: "imageUrls",
      type: "image-upload-list",
      label: "Изображение для I2V (ровно 1 файл — загрузка с компьютера)",
      maxItems: 1,
      required: false,
    },
    {
      name: "referenceImageUrls",
      type: "image-upload-list",
      label: "Референсы (reference-to-video, 1–9 файлов)",
      maxItems: 9,
      required: false,
    },
    {
      name: "videoUrls",
      type: "video-upload-list",
      label: "Исходное видео для редактирования (ровно 1 файл)",
      maxItems: 1,
      required: false,
    },
    {
      name: "editReferenceImageUrls",
      type: "image-upload-list",
      label: "Опциональные референсы для video-edit (до 5)",
      maxItems: 5,
      required: false,
    },
    {
      name: "seed",
      type: "number",
      label: "Seed (необязательно)",
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
  providerModel: "happyhorse/text-to-video",
  pricingSource: "manual_placeholder",
  defaultCredits: 100,
  fallbackCredits: 100,
  matrix: {
    "720p": matrixRow(52, 9),
    "1080p": matrixRow(78, 14),
  },
} as const;

async function main() {
  const guard = await prisma.aiModel.findUnique({
    where: { slug: "happyhorse-1-0" },
    select: { pricingSchema: true },
  });
  const row = await prisma.aiModel.upsert({
    where: { slug: "happyhorse-1-0" },
    create: {
      name: "Happy Horse 1.0",
      slug: "happyhorse-1-0",
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "happyhorse/text-to-video",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 100,
      realCost: 0,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: true,
      supportsNegativePrompt: false,
      supportsSeed: true,
      maxDuration: 15,
      description:
        "Happy Horse 1.0 (Alibaba ATH, Kie Market). Режимы: text-to-video, image-to-video, reference-to-video, video-edit. Загрузка изображений/видео с компьютера через поля формы (публичные URL). Док.: docs.kie.ai/market/happyhorse/",
      availableAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
      availableResolutions: ["720p", "1080p"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: { ...PRICING_SCHEMA } as object,
    },
      update: omitSeedPricingWhenPinned(guard, {
      name: "Happy Horse 1.0",
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "happyhorse/text-to-video",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 100,
      realCost: 0,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: true,
      supportsNegativePrompt: false,
      supportsSeed: true,
      maxDuration: 15,
      description:
        "Happy Horse 1.0 (Alibaba ATH, Kie Market). Режимы: text-to-video, image-to-video, reference-to-video, video-edit. Загрузка изображений/видео с компьютера через поля формы (публичные URL). Док.: docs.kie.ai/market/happyhorse/",
      availableAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
      availableResolutions: ["720p", "1080p"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: { ...PRICING_SCHEMA } as object,
    }),
  });
  console.log("[seed:happyhorse] OK", row.id, row.slug);
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
