/**
 * Hailuo 2.3 Standard / Pro Image→Video (Kie Market).
 * Запуск: npm run seed:hailuo-2-3
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
      name: "imageUrls",
      type: "url-list",
      label: "URL изображения (исходный кадр)",
      maxItems: 4,
      required: false,
    },
    {
      name: "duration",
      type: "select",
      label: "Длительность (с)",
      default: "6",
      options: ["6", "10"],
      required: true,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "768P",
      options: ["768P", "1080P"],
      required: true,
    },
    {
      name: "nsfwChecker",
      type: "boolean",
      label: "NSFW checker (фильтр контента Kie)",
      default: false,
      required: false,
    },
  ],
} as const;

function pricingFor(providerModel: string, pro: boolean): Record<string, unknown> {
  return {
    type: "matrix",
    currency: "KZT",
    internalTokenValueKzt: 10,
    provider: "KIE_AI",
    providerModel,
    defaultCredits: pro ? 68 : 55,
    matrix: pro
      ? {
          "768P": { "6": 62, "10": 98 },
          "1080P": { "6": 92 },
        }
      : {
          "768P": { "6": 50, "10": 82 },
          "1080P": { "6": 75 },
        },
    fallbackCredits: pro ? 68 : 55,
  };
}

const VARIANTS = [
  {
    slug: "hailuo-2-3-image-to-video-standard",
    name: "Hailuo 2.3 Image to Video (Standard)",
    apiModelId: "hailuo/2-3-image-to-video-standard",
    description:
      "Hailuo 2.3 Standard I2V (Kie: hailuo/2-3-image-to-video-standard). Поля: prompt, image_url, duration 6|10, resolution 768P|1080P.",
    pro: false,
  },
  {
    slug: "hailuo-2-3-image-to-video-pro",
    name: "Hailuo 2.3 Image to Video (Pro)",
    apiModelId: "hailuo/2-3-image-to-video-pro",
    description:
      "Hailuo 2.3 Pro I2V (Kie: hailuo/2-3-image-to-video-pro). Для 1080P — только 6 с.",
    pro: true,
  },
] as const;

async function main() {
  for (const v of VARIANTS) {
    const guard = await prisma.aiModel.findUnique({
      where: { slug: v.slug },
      select: { pricingSchema: true },
    });
    const pricingSchema = pricingFor(v.apiModelId, v.pro);
    const row = await prisma.aiModel.upsert({
      where: { slug: v.slug },
      create: {
        name: v.name,
        slug: v.slug,
        provider: "KIE_AI",
        type: "VIDEO",
        apiModelId: v.apiModelId,
        endpoint: ENDPOINT,
        statusEndpoint: STATUS_ENDPOINT,
        costCredits: v.pro ? 68 : 55,
        realCost: 0,
        isActive: true,
        supportsImageInput: true,
        supportsVideoInput: false,
        supportsNegativePrompt: false,
        supportsSeed: false,
        maxDuration: 10,
        description: v.description,
        availableAspectRatios: [],
        availableResolutions: ["768P", "1080P"],
        settingsSchema: { ...SETTINGS_SCHEMA } as object,
        pricingSchema: pricingSchema as object,
      },
      update: omitSeedPricingWhenPinned(guard, {
        name: v.name,
        provider: "KIE_AI",
        type: "VIDEO",
        apiModelId: v.apiModelId,
        endpoint: ENDPOINT,
        statusEndpoint: STATUS_ENDPOINT,
        costCredits: v.pro ? 68 : 55,
        realCost: 0,
        isActive: true,
        supportsImageInput: true,
        supportsVideoInput: false,
        supportsNegativePrompt: false,
        supportsSeed: false,
        maxDuration: 10,
        description: v.description,
        availableAspectRatios: [],
        availableResolutions: ["768P", "1080P"],
        settingsSchema: { ...SETTINGS_SCHEMA } as object,
        pricingSchema: pricingSchema as object,
      }),
    });
    console.log("[seed:hailuo-2-3]", row.slug, row.id);
  }
  console.log("[seed:hailuo-2-3] OK", VARIANTS.length);
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
