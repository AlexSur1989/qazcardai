/**
 * PRODUCT_CARD AiModel — реестр очищен для пересборки.
 * Запуск: npm run seed:product-card-models
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

const PRODUCT_CARD_DEFAULT_SETTING_KEYS = [
  "PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG",
  "PRODUCT_CARD_DEFAULT_CONCEPT_IMAGE_MODEL_SLUG",
  "PRODUCT_CARD_DEFAULT_MARKETPLACE_CARD_MODEL_SLUG",
  "PRODUCT_CARD_DEFAULT_VIDEO_MODEL_SLUG",
] as const;

async function clearProductCardDefaultSlugs() {
  for (const key of PRODUCT_CARD_DEFAULT_SETTING_KEYS) {
    await prisma.appSetting.upsert({
      where: { key },
      create: {
        key,
        value: "",
        type: "string",
        description: `Product Card default ${key} (очищено для пересборки каталога).`,
      },
      update: {
        value: "",
        type: "string",
        description: `Product Card default ${key} (очищено для пересборки каталога).`,
      },
    });
  }
}

async function main() {
  await clearProductCardDefaultSlugs();
  console.log(
    "[seed:product-card-models] SKIP — реестр PRODUCT_CARD моделей пуст. Slug defaults в AppSetting сброшены.",
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
