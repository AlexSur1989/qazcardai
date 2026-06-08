/**
 * Gemini 3 Flash — Product Classifier (PRODUCT_CARD / PRODUCT_CLASSIFIER).
 * Идемпотентный upsert, dry-run chat payload, AppSetting. Без вызова Kie.ai.
 * npm run seed:gemini-3-flash-product-classifier
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { buildFixedPricingSchema } from "../src/lib/kie-import-wizard";
import {
  buildDryRunClassifierPayloadForModel,
  isCriticalClassifierDryRunWarning,
} from "../src/server/services/adminClassifierPayloadDryRun";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("В .env нужен DATABASE_URL");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SLUG = "gemini-3-flash-product-classifier";
const API_MODEL_ID = "gemini-3-flash";
const ENDPOINT = "/gemini-3-flash/v1/chat/completions";
const COST_CREDITS = 1;
const APP_SETTING_KEY = "PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG";

function fail(msg: string): never {
  console.error(`[seed:gemini-3-flash-product-classifier] FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  const metadata = {
    docsUrl: "https://docs.kie.ai/market/gemini/gemini-3-flash",
    playgroundUrl: "https://kie.ai/gemini-3-flash",
    docsCheckedAt: new Date().toISOString().slice(0, 10),
    source: "docs.kie.ai + kie.ai playground",
    purpose: "product_classifier",
    adapter: "chat-completions",
    kieNotes: {
      inputImageField: "messages[1].content[image_url].url",
      syncResponse: "choices[0].message.content JSON",
      stream: false,
    },
  };

  const payloadMapping = {
    adapter: "chat-completions",
    modelField: "model",
    imageUrlField: "messages[1].content[image_url].url",
    stream: false,
  };

  const pricingSchema = buildFixedPricingSchema(COST_CREDITS);
  const settingsSchema = { fields: [] };

  const common = {
    name: "Gemini 3 Flash — Product Classifier",
    provider: "KIE_AI" as const,
    type: "IMAGE" as const,
    scope: "PRODUCT_CARD" as const,
    productCardModelType: "PRODUCT_CLASSIFIER" as const,
    apiModelId: API_MODEL_ID,
    endpoint: ENDPOINT,
    statusEndpoint: null,
    costCredits: COST_CREDITS,
    isPublic: false,
    supportsImageInput: true,
    supportsVideoInput: false,
    supportsNegativePrompt: false,
    supportsSeed: false,
    settingsSchema: settingsSchema as Prisma.InputJsonValue,
    payloadMapping: payloadMapping as Prisma.InputJsonValue,
    pricingSchema: pricingSchema as Prisma.InputJsonValue,
    metadata: metadata as Prisma.InputJsonValue,
  };

  const existing = await prisma.aiModel.findUnique({ where: { slug: SLUG } });

  const model = await prisma.aiModel.upsert({
    where: { slug: SLUG },
    create: {
      slug: SLUG,
      ...common,
      isActive: false,
    },
    update: {
      ...common,
      isActive: existing?.isActive === true ? true : false,
    },
  });

  console.log(
    `[seed:gemini-3-flash-product-classifier] upserted ${SLUG} id=${model.id} isActive=${model.isActive}`,
  );

  const genBefore = await prisma.generation.count();
  const txBefore = await prisma.creditTransaction.count();

  const dryRun = await buildDryRunClassifierPayloadForModel(model);
  if (!dryRun.ok) fail(`dry-run build failed: ${dryRun.error}`);

  const critical = dryRun.warnings.filter(isCriticalClassifierDryRunWarning);
  console.log("[seed:gemini-3-flash-product-classifier] dry-run payload:");
  console.log(JSON.stringify(dryRun.payload, null, 2));
  console.log(
    `[seed:gemini-3-flash-product-classifier] dry-run warnings: ${dryRun.warnings.join("; ") || "none"}`,
  );

  const genAfter = await prisma.generation.count();
  const txAfter = await prisma.creditTransaction.count();
  if (genAfter !== genBefore) fail("dry-run must not create Generation");
  if (txAfter !== txBefore) fail("dry-run must not create CreditTransaction");

  if (critical.length > 0) {
    fail(`critical dry-run issues: ${critical.join("; ")}`);
  }

  await prisma.appSetting.upsert({
    where: { key: APP_SETTING_KEY },
    create: {
      key: APP_SETTING_KEY,
      type: "string",
      value: SLUG,
      description: "PRODUCT_CLASSIFIER модель для карточки товара (Gemini 3 Flash).",
    },
    update: {
      type: "string",
      value: SLUG,
    },
  });

  console.log(`[seed:gemini-3-flash-product-classifier] ${APP_SETTING_KEY}=${SLUG}`);
  console.log(
    "[seed:gemini-3-flash-product-classifier] done — model inactive until manual activation + real test",
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
