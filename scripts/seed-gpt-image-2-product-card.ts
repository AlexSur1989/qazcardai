/**
 * Создаёт или обновляет Kie GPT Image 2 image-to-image для Product Card.
 * Запуск: npm run seed:gpt-image-2-product-card
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

const MODEL_SLUG = "gpt-image-2-image-to-image";

const SETTINGS_SCHEMA = {
  fields: [
    {
      name: "inputUrls",
      type: "url-list",
      label: "Reference image URLs",
      required: true,
      maxItems: 4,
    },
    {
      name: "aspectRatio",
      type: "select",
      label: "Aspect ratio",
      default: "1:1",
      options: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      required: true,
    },
    {
      name: "resolution",
      type: "select",
      label: "Resolution",
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

const PRICING_SCHEMA = {
  type: "matrix",
  currency: "KZT",
  provider: "KIE_AI",
  providerModel: MODEL_SLUG,
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

const PAYLOAD_MAPPING = {
  prompt: "input.prompt",
  inputUrls: "input.input_urls",
  aspectRatio: "input.aspect_ratio",
  resolution: "input.resolution",
} as const;

async function main() {
  const guard = await prisma.aiModel.findUnique({
    where: { slug: MODEL_SLUG },
    select: { pricingSchema: true },
  });
  const row = await prisma.aiModel.upsert({
    where: { slug: MODEL_SLUG },
    create: {
      name: "GPT Image 2 Image-to-Image",
      slug: MODEL_SLUG,
      provider: "KIE_AI",
      type: "IMAGE",
      apiModelId: MODEL_SLUG,
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 20,
      realCost: 0.03,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      description:
        "Основная модель для создания карточек товара по загруженным фото. Используется image-to-image режим, чтобы сохранять форму, цвет и детали товара.",
      availableAspectRatios: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      availableResolutions: ["1K", "2K", "4K"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: { ...PRICING_SCHEMA },
      payloadMapping: { ...PAYLOAD_MAPPING },
    },
    update: omitSeedPricingWhenPinned(guard, {
      name: "GPT Image 2 Image-to-Image",
      provider: "KIE_AI",
      type: "IMAGE",
      apiModelId: MODEL_SLUG,
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 20,
      realCost: 0.03,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      description:
        "Основная модель для создания карточек товара по загруженным фото. Используется image-to-image режим, чтобы сохранять форму, цвет и детали товара.",
      availableAspectRatios: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      availableResolutions: ["1K", "2K", "4K"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: { ...PRICING_SCHEMA },
      payloadMapping: { ...PAYLOAD_MAPPING },
    }),
  });

  await prisma.appSetting.upsert({
    where: { key: "DEFAULT_MARKETPLACE_CARD_MODEL_SLUG" },
    create: {
      key: "DEFAULT_MARKETPLACE_CARD_MODEL_SLUG",
      value: MODEL_SLUG,
      type: "string",
      description: "Default IMAGE model for Product Card marketplace-card generation.",
    },
    update: {
      value: MODEL_SLUG,
      type: "string",
      description: "Default IMAGE model for Product Card marketplace-card generation.",
    },
  });

  console.log("[seed:gpt-image-2-product-card] OK", row.id, row.slug);
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
