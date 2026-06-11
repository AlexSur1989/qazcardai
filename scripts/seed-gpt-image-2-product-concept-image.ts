/**
 * GPT Image 2 — Product Concept Photo (PRODUCT_CARD / PRODUCT_CONCEPT_IMAGE).
 * npm run seed:gpt-image-2-product-concept-image
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { buildProductCardImageResolutionPricingSchema } from "../src/config/product-card-image-resolution";
import {
  detectFieldsFromKieInput,
  parseKiePayloadJson,
} from "../src/lib/kie-import-wizard";
import { omitSeedPricingWhenPinned } from "./lib/omit-seed-pricing";
import {
  buildDryRunKiePayloadForModel,
  isCriticalModelDryRunWarning,
} from "../src/server/services/adminModelPayloadDryRun";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("В .env нужен DATABASE_URL");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SLUG = "gpt-image-2-product-concept-image";
const API_MODEL_ID = "gpt-image-2-image-to-image";
const ENDPOINT = "/api/v1/jobs/createTask";
const STATUS_ENDPOINT = "/api/v1/jobs/recordInfo";
const COST_CREDITS = 20;
const APP_SETTING_KEY = "PRODUCT_CARD_DEFAULT_CONCEPT_IMAGE_MODEL_SLUG";

const RAW_PAYLOAD_EXAMPLE = {
  model: API_MODEL_ID,
  callBackUrl: "https://app.qazcardai.kz/api/webhooks/kie",
  input: {
    prompt:
      "Create a commercial concept photo from the uploaded product image. Preserve exact product identity, shape, color and materials. Apply the selected photography concept with professional lighting and composition.",
    input_urls: ["https://example.com/product-image.png"],
    aspect_ratio: "1:1",
    resolution: "1K",
  },
};

function fail(msg: string): never {
  console.error(`[seed:gpt-image-2-product-concept-image] FAIL: ${msg}`);
  process.exit(1);
}

function buildSettingsSchema(
  detected: ReturnType<typeof detectFieldsFromKieInput>["settingsSchema"],
) {
  const fields = Array.isArray(detected.fields)
    ? [...(detected.fields as Array<Record<string, unknown>>)]
    : [];

  const aspectOpts = ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"].map((v) => ({
    value: v,
    label: v,
  }));
  const resolutionOpts = ["1K", "2K", "4K"].map((v) => ({ value: v, label: v }));

  for (const field of fields) {
    if (field.name === "aspectRatio") {
      field.type = "select";
      field.label = "Формат";
      field.default = "1:1";
      field.options = aspectOpts;
      field.helpText =
        "GPT Image 2: auto и отсутствие формата допускают только 1K; 1:1 не поддерживает 4K.";
    }
    if (field.name === "inputUrls") {
      field.type = "hidden";
      field.label = "Product photo (system)";
      field.maxItems = 4;
      field.helpText = "System: исходные фото товара. Hidden from USER.";
    }
    if (field.name === "resolution") {
      field.type = "select";
      field.label = "Разрешение";
      field.default = "1K";
      field.options = resolutionOpts;
    }
  }

  return { fields };
}

function validateModelData() {
  const parsed = parseKiePayloadJson(JSON.stringify(RAW_PAYLOAD_EXAMPLE));
  if (!parsed.ok) fail(`payload JSON invalid: ${parsed.error}`);

  const obj = parsed.parsed as Record<string, unknown>;
  if (!String(obj.model ?? "").trim()) fail("payload missing model");
  if (!String(obj.callBackUrl ?? "").trim()) fail("payload missing callBackUrl");

  const input = parsed.input;
  if (!String(input.prompt ?? "").trim()) fail("payload missing input.prompt");
  if (!("input_urls" in input)) fail("payload missing input.input_urls");
  if (!Array.isArray(input.input_urls)) fail("input_urls is not array");
  if (!String(input.aspect_ratio ?? "").trim()) fail("payload missing aspect_ratio");
  if (!String(input.resolution ?? "").trim()) fail("payload missing resolution");

  console.log("[seed:gpt-image-2-product-concept-image] model data OK");
  return parsed;
}

async function main() {
  const parsed = validateModelData();
  const detected = detectFieldsFromKieInput(parsed.input);
  const settingsSchema = buildSettingsSchema(detected.settingsSchema);
  const pricingSchema = buildProductCardImageResolutionPricingSchema(COST_CREDITS);

  const metadata = {
    docsUrl: "https://docs.kie.ai/market/gpt/gpt-image-2-image-to-image",
    playgroundUrl: "https://kie.ai/gpt-image-2?model=gpt-image-2-image-to-image",
    docsCheckedAt: new Date().toISOString().slice(0, 10),
    source: "docs.kie.ai + kie.ai playground",
    purpose: "product_concept_image",
    ownerHint: "Use for product photo → concept photo generation",
    seedAllowKieOverrides: true,
    rawPayloadExample: RAW_PAYLOAD_EXAMPLE,
    kieNotes: {
      inputImageField: "input.input_urls",
      inputImageType: "array",
      maxInputImages: 4,
      supportedAspectRatios: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      supportedResolutions: ["1K", "2K", "4K"],
    },
  };

  const common = {
    name: "GPT Image 2 — Product Concept Photo",
    provider: "KIE_AI" as const,
    type: "IMAGE" as const,
    scope: "PRODUCT_CARD" as const,
    productCardModelType: "PRODUCT_CONCEPT_IMAGE" as const,
    apiModelId: API_MODEL_ID,
    endpoint: ENDPOINT,
    statusEndpoint: STATUS_ENDPOINT,
    costCredits: COST_CREDITS,
    isPublic: false,
    supportsImageInput: true,
    supportsVideoInput: false,
    supportsNegativePrompt: false,
    supportsSeed: false,
    settingsSchema: settingsSchema as Prisma.InputJsonValue,
    payloadMapping: detected.payloadMapping as Prisma.InputJsonValue,
    pricingSchema: pricingSchema as Prisma.InputJsonValue,
    metadata: metadata as Prisma.InputJsonValue,
  };

  const existing = await prisma.aiModel.findUnique({
    where: { slug: SLUG },
    select: { isActive: true, pricingSchema: true, metadata: true },
  });

  let model = await prisma.aiModel.upsert({
    where: { slug: SLUG },
    create: {
      slug: SLUG,
      ...common,
      isActive: false,
    },
    update: omitSeedPricingWhenPinned(existing, {
      ...common,
      isActive: existing?.isActive === true ? true : false,
    }),
  });

  console.log(
    `[seed:gpt-image-2-product-concept-image] upserted ${SLUG} id=${model.id} isActive=${model.isActive}`,
  );

  const genBefore = await prisma.generation.count();
  const txBefore = await prisma.creditTransaction.count();

  const dryRun = await buildDryRunKiePayloadForModel(model);
  if (!dryRun.ok) fail(`dry-run build failed: ${dryRun.error}`);

  const critical = dryRun.warnings.filter(isCriticalModelDryRunWarning);
  const nonCritical = dryRun.warnings.filter((w) => !isCriticalModelDryRunWarning(w));

  console.log("[seed:gpt-image-2-product-concept-image] dry-run payload:");
  console.log(JSON.stringify(dryRun.payload, null, 2));

  const genAfter = await prisma.generation.count();
  const txAfter = await prisma.creditTransaction.count();
  if (genAfter !== genBefore) fail("dry-run must not create Generation");
  if (txAfter !== txBefore) fail("dry-run must not create CreditTransaction");

  const payloadInput = (dryRun.payload as { input?: Record<string, unknown> }).input;
  if (!payloadInput || !Array.isArray(payloadInput.input_urls)) {
    critical.push("dry-run payload input.input_urls is not an array");
  }

  if (critical.length > 0) {
    fail(`critical dry-run issues — model not activated: ${critical.join("; ")}`);
  }

  if (!model.isActive) {
    model = await prisma.aiModel.update({
      where: { id: model.id },
      data: { isActive: true },
    });
    console.log("[seed:gpt-image-2-product-concept-image] activated model");
  }

  await prisma.appSetting.upsert({
    where: { key: APP_SETTING_KEY },
    create: {
      key: APP_SETTING_KEY,
      type: "string",
      value: SLUG,
      description: "PRODUCT_CONCEPT_IMAGE модель для «Фото с conцепциями».",
    },
    update: {
      type: "string",
      value: SLUG,
    },
  });

  console.log(
    `[seed:gpt-image-2-product-concept-image] assigned ${APP_SETTING_KEY}=${SLUG} costCredits=${COST_CREDITS}`,
  );

  if (nonCritical.length > 0) {
    console.log(
      `[seed:gpt-image-2-product-concept-image] non-critical warnings: ${nonCritical.join("; ")}`,
    );
  }

  console.log("[seed:gpt-image-2-product-concept-image] OK");
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
