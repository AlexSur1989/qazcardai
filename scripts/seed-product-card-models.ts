import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("В .env нужен DATABASE_URL");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const productCardPricing = (baseTokens: number, providerCostUsd: number) => ({
  pricingScope: "PRODUCT_CARD",
  type: "product_card_matrix",
  baseTokens,
  providerCostUsd,
  manualOverrides: {},
  matrix: {
    "1x1": { tokens: baseTokens, providerCostUsd },
    square: { tokens: baseTokens, providerCostUsd },
    "720p": { tokens: baseTokens, providerCostUsd },
  },
});

async function preserveManualOverrides(slug: string, next: Record<string, unknown>) {
  const existing = await prisma.aiModel.findUnique({
    where: { slug },
    select: { pricingSchema: true },
  });
  const prev =
    existing?.pricingSchema &&
    typeof existing.pricingSchema === "object" &&
    !Array.isArray(existing.pricingSchema)
      ? (existing.pricingSchema as Record<string, unknown>)
      : null;
  return {
    ...next,
    manualOverrides: prev?.manualOverrides ?? next.manualOverrides ?? {},
  };
}

async function main() {
  const rows = [
    {
      name: "Gemini 2.5 Flash Product Classifier",
      slug: "gemini-2-5-flash-classifier",
      type: "IMAGE" as const,
      productCardModelType: "PRODUCT_CLASSIFIER",
      apiModelId: "gemini-2.5-flash",
      costCredits: 1,
      pricingSchema: productCardPricing(1, 0.001),
      supportsImageInput: true,
    },
    {
      name: "Seedream 4.0 Product Concept",
      slug: "seedream-4-0-product-concept",
      type: "IMAGE" as const,
      productCardModelType: "PRODUCT_CONCEPT_IMAGE",
      /** KIE Market: изображение товара + промпт → seedream-v4-edit */
      apiModelId: "bytedance/seedream-v4-edit",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 15,
      pricingSchema: productCardPricing(15, 0.03),
      supportsImageInput: true,
      payloadMapping: {
        prompt: "input.prompt",
        imageUrls: "input.image_urls",
      },
    },
    {
      name: "GPT Image 2 Product Card",
      slug: "gpt-image-2-product-card",
      type: "IMAGE" as const,
      productCardModelType: "PRODUCT_MARKETPLACE_CARD",
      apiModelId: "gpt-image-2-image-to-image",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 25,
      pricingSchema: productCardPricing(25, 0.05),
      supportsImageInput: true,
      settingsSchema: {
        fields: [
          { name: "inputUrls", type: "url-list", label: "Reference image URLs", required: true, maxItems: 4 },
          { name: "aspectRatio", type: "select", label: "Aspect ratio", default: "1:1", options: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"], required: true },
          { name: "resolution", type: "select", label: "Resolution", default: "1K", options: ["1K", "2K", "4K"], required: true },
        ],
      },
      payloadMapping: {
        prompt: "input.prompt",
        inputUrls: "input.input_urls",
        aspectRatio: "input.aspect_ratio",
        resolution: "input.resolution",
      },
    },
    {
      name: "Seedance 2.0 Fast Product Video",
      slug: "seedance-2-0-fast-product-video",
      type: "VIDEO" as const,
      productCardModelType: "PRODUCT_VIDEO",
      apiModelId: "bytedance/seedance-2-fast",
      costCredits: 40,
      pricingSchema: productCardPricing(40, 0.08),
      supportsImageInput: true,
      maxDuration: 10,
    },
  ];

  for (const row of rows) {
    const pricingSchema = await preserveManualOverrides(row.slug, row.pricingSchema);
    await prisma.aiModel.upsert({
      where: { slug: row.slug },
      create: {
        provider: "KIE_AI",
        isActive: true,
        scope: "PRODUCT_CARD",
        endpoint: row.endpoint ?? null,
        statusEndpoint: row.statusEndpoint ?? null,
        supportsVideoInput: false,
        supportsNegativePrompt: false,
        supportsSeed: false,
        description: "Dedicated Product Card model.",
        ...row,
        pricingSchema,
      },
      update: {
        name: row.name,
        provider: "KIE_AI",
        type: row.type,
        scope: "PRODUCT_CARD",
        productCardModelType: row.productCardModelType,
        apiModelId: row.apiModelId,
        endpoint: row.endpoint ?? null,
        statusEndpoint: row.statusEndpoint ?? null,
        costCredits: row.costCredits,
        isActive: true,
        supportsImageInput: row.supportsImageInput,
        supportsVideoInput: false,
        supportsNegativePrompt: false,
        supportsSeed: false,
        maxDuration: "maxDuration" in row ? row.maxDuration : null,
        settingsSchema: "settingsSchema" in row ? row.settingsSchema : undefined,
        payloadMapping: "payloadMapping" in row ? row.payloadMapping : undefined,
        pricingSchema,
      },
    });
  }

  const defaults = {
    PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG: "gemini-2-5-flash-classifier",
    PRODUCT_CARD_DEFAULT_CONCEPT_IMAGE_MODEL_SLUG: "seedream-4-0-product-concept",
    PRODUCT_CARD_DEFAULT_MARKETPLACE_CARD_MODEL_SLUG: "gpt-image-2-product-card",
    PRODUCT_CARD_DEFAULT_VIDEO_MODEL_SLUG: "seedance-2-0-fast-product-video",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value, type: "string", description: `Product Card default ${key}.` },
      update: { value, type: "string", description: `Product Card default ${key}.` },
    });
  }

  console.log("[seed:product-card-models] OK");
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
