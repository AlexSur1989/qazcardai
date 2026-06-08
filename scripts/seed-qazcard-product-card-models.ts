/**
 * Inactive PRODUCT_CARD model stubs for QazCard rebuild.
 * npm run seed:qazcard-product-card-models
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("В .env нужен DATABASE_URL");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const STUBS = [
  {
    slug: "product-classifier-kie",
    name: "Product Classifier (Kie stub)",
    productCardModelType: "PRODUCT_CLASSIFIER" as const,
    type: "IMAGE" as const,
    supportsImageInput: false,
  },
  {
    slug: "product-concept-image-kie",
    name: "Product Concept Image (Kie stub)",
    productCardModelType: "PRODUCT_CONCEPT_IMAGE" as const,
    type: "IMAGE" as const,
    supportsImageInput: false,
  },
  {
    slug: "product-marketplace-card-kie",
    name: "Product Marketplace Card (Kie stub)",
    productCardModelType: "PRODUCT_MARKETPLACE_CARD" as const,
    type: "IMAGE" as const,
    supportsImageInput: true,
  },
  {
    slug: "product-video-kie",
    name: "Product Video (Kie stub)",
    productCardModelType: "PRODUCT_VIDEO" as const,
    type: "VIDEO" as const,
    supportsImageInput: true,
  },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const stub of STUBS) {
    const existing = await prisma.aiModel.findUnique({
      where: { slug: stub.slug },
      select: { id: true },
    });

    await prisma.aiModel.upsert({
      where: { slug: stub.slug },
      create: {
        name: stub.name,
        slug: stub.slug,
        provider: "KIE_AI",
        scope: "PRODUCT_CARD",
        productCardModelType: stub.productCardModelType,
        type: stub.type,
        apiModelId: "PLACEHOLDER",
        endpoint: null,
        statusEndpoint: null,
        costCredits: 0,
        isActive: false,
        isPublic: false,
        supportsImageInput: stub.supportsImageInput,
        supportsVideoInput: stub.type === "VIDEO",
        supportsNegativePrompt: false,
        supportsSeed: false,
        settingsSchema: { fields: [] },
        payloadMapping: { adapter: "market-create-task", input: {}, omitNull: true },
        pricingSchema: { type: "fixed", credits: 0 },
        metadata: {
          source: "seed:qazcard-product-card-models",
          warning: "Заполните apiModelId и endpoint из docs.kie.ai, затем активируйте модель.",
          stub: true,
        },
      },
      update: {
        name: stub.name,
        scope: "PRODUCT_CARD",
        productCardModelType: stub.productCardModelType,
        type: stub.type,
        supportsImageInput: stub.supportsImageInput,
        supportsVideoInput: stub.type === "VIDEO",
      },
    });

    if (existing) updated++;
    else created++;
  }

  console.log(
    `[seed:qazcard-product-card-models] done: created=${created}, updated=${updated} (inactive stubs, no deletes)`,
  );
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
