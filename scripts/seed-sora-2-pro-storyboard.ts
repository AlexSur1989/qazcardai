/**
 * Sora 2 Pro Storyboard (Kie Market).
 * Запуск: npm run seed:sora-2-pro-storyboard
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

const ENDPOINT = "/api/v1/jobs/createTask";
const STATUS_ENDPOINT = "/api/v1/jobs/recordInfo";

const SETTINGS_SCHEMA = {
  fields: [
    {
      name: "shots",
      type: "json",
      label: "Кадры (JSON): Scene и duration (сек) для каждого",
      default:
        '[{"Scene":"Первый кадр: краткое описание сцены","duration":5}]',
      required: true,
    },
    {
      name: "n_frames",
      type: "select",
      label: "Итоговая длительность ролика",
      default: "15",
      options: ["10", "15", "25"],
      required: true,
    },
    {
      name: "aspect_ratio",
      type: "select",
      label: "Ориентация",
      default: "landscape",
      options: ["portrait", "landscape"],
      required: true,
    },
    {
      name: "upload_method",
      type: "select",
      label: "Метод загрузки (Kie)",
      default: "s3",
      options: ["s3", "oss"],
      required: true,
    },
    {
      name: "imageUrls",
      type: "url-list",
      label: "Референс-изображение (опционально, 1 URL)",
      maxItems: 1,
      required: false,
    },
  ],
} as const;

const PRICING_SCHEMA = {
  type: "matrix",
  matrixKeyStrategy: "sora_storyboard_n_frames",
  currency: "KZT",
  internalTokenValueKzt: 10,
  provider: "KIE_AI",
  providerModel: "sora-2-pro-storyboard",
  defaultCredits: 320,
  fallbackCredits: 320,
  matrix: {
    "10": 220,
    "15": 320,
    "25": 480,
  },
} as const;

async function main() {
  const guard = await prisma.aiModel.findUnique({
    where: { slug: "sora-2-pro-storyboard" },
    select: { pricingSchema: true },
  });
  const row = await prisma.aiModel.upsert({
    where: { slug: "sora-2-pro-storyboard" },
    create: {
      name: "Sora 2 Pro Storyboard",
      slug: "sora-2-pro-storyboard",
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "sora-2-pro-storyboard",
      endpoint: ENDPOINT,
      statusEndpoint: STATUS_ENDPOINT,
      costCredits: 320,
      realCost: 0,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      maxDuration: 25,
      description:
        "Сториборд: массив shots (Scene + duration), n_frames 10/15/25, опционально 1 image_urls. Kie: sora-2-pro-storyboard.",
      availableAspectRatios: ["portrait", "landscape"],
      availableResolutions: ["10", "15", "25"],
      settingsSchema: { ...SETTINGS_SCHEMA } as object,
      pricingSchema: PRICING_SCHEMA as object,
    },
      update: omitSeedPricingWhenPinned(guard, {
        name: "Sora 2 Pro Storyboard",
        provider: "KIE_AI",
        type: "VIDEO",
        apiModelId: "sora-2-pro-storyboard",
        endpoint: ENDPOINT,
        statusEndpoint: STATUS_ENDPOINT,
        costCredits: 320,
        realCost: 0,
        isActive: true,
        supportsImageInput: true,
        supportsVideoInput: false,
        supportsNegativePrompt: false,
        supportsSeed: false,
        maxDuration: 25,
        description:
          "Сториборд: массив shots (Scene + duration), n_frames 10/15/25, опционально 1 image_urls. Kie: sora-2-pro-storyboard.",
        availableAspectRatios: ["portrait", "landscape"],
        availableResolutions: ["10", "15", "25"],
        settingsSchema: { ...SETTINGS_SCHEMA } as object,
        pricingSchema: PRICING_SCHEMA as object,
      }),
  });
  console.log("[seed:sora-2-pro-storyboard]", row.slug, row.id);
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
