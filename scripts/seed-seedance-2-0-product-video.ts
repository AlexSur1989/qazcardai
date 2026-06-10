/**
 * Seedance 2.0 — Product Video (PRODUCT_CARD / PRODUCT_VIDEO, first-frame).
 * npm run seed:seedance-2-0-product-video
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { parseKiePayloadJson } from "../src/lib/kie-import-wizard";
import { productCardVideoMatrixCellsToSchemaMatrix } from "../src/lib/pricing-admin/product-card-video";
import type { KiePayloadMapping } from "../src/server/services/kiePayloadMapping";
import {
  buildDryRunKiePayloadForModel,
  DRY_RUN_FAKE_PRODUCT_IMAGE_URL,
  isCriticalModelDryRunWarning,
} from "../src/server/services/adminModelPayloadDryRun";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("В .env нужен DATABASE_URL");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SLUG = "seedance-2-0-product-video";
const API_MODEL_ID = "bytedance/seedance-2";
const ENDPOINT = "/api/v1/jobs/createTask";
const STATUS_ENDPOINT = "/api/v1/jobs/recordInfo";
const COST_CREDITS = 40;
const APP_SETTING_KEY = "PRODUCT_CARD_DEFAULT_VIDEO_MODEL_SLUG";

const MATRIX_CELLS = [
  { duration: 5, resolution: "720p", credits: 40 },
  { duration: 5, resolution: "1080p", credits: 55 },
  { duration: 10, resolution: "720p", credits: 70 },
  { duration: 10, resolution: "1080p", credits: 95 },
] as const;

const RAW_PAYLOAD_EXAMPLE = {
  model: API_MODEL_ID,
  callBackUrl: "https://app.qazcardai.kz/api/webhooks/kie",
  input: {
    prompt:
      "Smooth cinematic product video. Preserve exact product identity, shape, color and materials. Subtle camera motion and professional lighting.",
    first_frame_url: "https://example.com/product-first-frame.png",
    resolution: "720p",
    aspect_ratio: "16:9",
    duration: 5,
    generate_audio: false,
    web_search: false,
  },
};

const SETTINGS_SCHEMA = {
  fields: [
    {
      name: "scenario",
      type: "hidden",
      default: "first-frame",
      label: "Scenario (system)",
    },
    {
      name: "firstFrameUrl",
      type: "hidden",
      label: "First frame (system)",
      helpText: "System: исходное фото товара для first-frame. Hidden from USER.",
    },
    {
      name: "duration",
      type: "number",
      label: "Длительность (сек)",
      default: 5,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "720p",
      options: [
        { value: "720p", label: "720p" },
        { value: "1080p", label: "1080p" },
      ],
    },
    {
      name: "aspectRatio",
      type: "select",
      label: "Формат",
      default: "16:9",
      options: [
        { value: "16:9", label: "16:9" },
        { value: "9:16", label: "9:16" },
        { value: "1:1", label: "1:1" },
        { value: "4:3", label: "4:3" },
        { value: "3:4", label: "3:4" },
        { value: "21:9", label: "21:9" },
      ],
    },
    {
      name: "generateAudio",
      type: "hidden",
      default: false,
      label: "Generate audio",
    },
    {
      name: "webSearch",
      type: "hidden",
      default: false,
      label: "Web search",
    },
  ],
};

const PAYLOAD_MAPPING: KiePayloadMapping = {
  adapter: "market-create-task",
  input: {
    first_frame_url: "$settings.firstFrameUrl",
    resolution: "$settings.resolution",
    aspect_ratio: "$settings.aspectRatio",
    duration: "$settings.duration",
    generate_audio: "$settings.generateAudio",
    web_search: "$settings.webSearch",
  },
  omitNull: true,
  coerce: {
    duration: "number",
    generate_audio: "boolean",
    web_search: "boolean",
  },
};

function fail(msg: string): never {
  console.error(`[seed:seedance-2-0-product-video] FAIL: ${msg}`);
  process.exit(1);
}

function buildPricingSchema() {
  return {
    pricingScope: "PRODUCT_CARD",
    type: "product_card_matrix",
    baseTokens: COST_CREDITS,
    providerCostUsd: 0.08,
    matrix: productCardVideoMatrixCellsToSchemaMatrix(
      [...MATRIX_CELLS],
      {},
      COST_CREDITS,
      0.08,
    ),
  };
}

function validateModelData() {
  const parsed = parseKiePayloadJson(JSON.stringify(RAW_PAYLOAD_EXAMPLE));
  if (!parsed.ok) fail(`payload JSON invalid: ${parsed.error}`);

  const input = parsed.input;
  if (!String(input.prompt ?? "").trim()) fail("payload missing input.prompt");
  if (!String(input.first_frame_url ?? "").trim()) {
    fail("payload missing input.first_frame_url");
  }
  if (!String(input.resolution ?? "").trim()) fail("payload missing resolution");
  if (!String(input.aspect_ratio ?? "").trim()) fail("payload missing aspect_ratio");
  if (input.duration == null) fail("payload missing duration");

  console.log("[seed:seedance-2-0-product-video] model data OK");
}

async function main() {
  validateModelData();
  const pricingSchema = buildPricingSchema();

  const metadata = {
    docsUrl: "https://docs.kie.ai/market/bytedance/seedance-2",
    playgroundUrl: "https://kie.ai/seedance-2",
    docsCheckedAt: new Date().toISOString().slice(0, 10),
    source: "docs.kie.ai + kie.ai playground",
    purpose: "product_video_first_frame",
    ownerHint: "Product Card → Видео товара (first-frame / image-to-video)",
    rawPayloadExample: RAW_PAYLOAD_EXAMPLE,
    kieNotes: {
      scenario: "first-frame",
      inputImageField: "input.first_frame_url",
      supportedDurations: [5, 10],
      supportedResolutions: ["720p", "1080p"],
      generateAudioDefault: false,
    },
  };

  const common = {
    name: "Seedance 2.0 — Product Video",
    provider: "KIE_AI" as const,
    type: "VIDEO" as const,
    scope: "PRODUCT_CARD" as const,
    productCardModelType: "PRODUCT_VIDEO" as const,
    apiModelId: API_MODEL_ID,
    endpoint: ENDPOINT,
    statusEndpoint: STATUS_ENDPOINT,
    costCredits: COST_CREDITS,
    maxDuration: 10,
    isPublic: false,
    supportsImageInput: true,
    supportsVideoInput: true,
    supportsNegativePrompt: false,
    supportsSeed: false,
    settingsSchema: SETTINGS_SCHEMA as Prisma.InputJsonValue,
    payloadMapping: PAYLOAD_MAPPING as Prisma.InputJsonValue,
    pricingSchema: pricingSchema as Prisma.InputJsonValue,
    metadata: metadata as Prisma.InputJsonValue,
  };

  const existing = await prisma.aiModel.findUnique({ where: { slug: SLUG } });

  let model = await prisma.aiModel.upsert({
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
    `[seed:seedance-2-0-product-video] upserted ${SLUG} id=${model.id} isActive=${model.isActive}`,
  );

  const genBefore = await prisma.generation.count();
  const txBefore = await prisma.creditTransaction.count();

  const dryRun = await buildDryRunKiePayloadForModel(model, {
    settings: {
      scenario: "first-frame",
      firstFrameUrl: DRY_RUN_FAKE_PRODUCT_IMAGE_URL,
      duration: 5,
      resolution: "720p",
      aspectRatio: "16:9",
      generateAudio: false,
      webSearch: false,
    },
  });
  if (!dryRun.ok) fail(`dry-run build failed: ${dryRun.error}`);

  const critical = dryRun.warnings.filter(isCriticalModelDryRunWarning);
  const nonCritical = dryRun.warnings.filter((w) => !isCriticalModelDryRunWarning(w));

  console.log("[seed:seedance-2-0-product-video] dry-run payload:");
  console.log(JSON.stringify(dryRun.payload, null, 2));

  const genAfter = await prisma.generation.count();
  const txAfter = await prisma.creditTransaction.count();
  if (genAfter !== genBefore) fail("dry-run must not create Generation");
  if (txAfter !== txBefore) fail("dry-run must not create CreditTransaction");

  const dryPayload = dryRun.payload as { model?: string; input?: Record<string, unknown> };
  if (dryPayload.model !== API_MODEL_ID) {
    critical.push(`dry-run payload model=${String(dryPayload.model)}`);
  }
  const payloadInput = dryPayload.input;
  if (!payloadInput || !String(payloadInput.first_frame_url ?? "").trim()) {
    critical.push("dry-run payload missing input.first_frame_url");
  }
  if (String(payloadInput?.resolution ?? "") !== "720p") {
    critical.push(`dry-run payload resolution=${String(payloadInput?.resolution)}`);
  }
  if (Number(payloadInput?.duration) !== 5) {
    critical.push(`dry-run payload duration=${String(payloadInput?.duration)}`);
  }
  if (payloadInput?.generate_audio !== false) {
    critical.push("dry-run payload generate_audio must be false");
  }

  if (critical.length > 0) {
    fail(`critical dry-run issues — model not activated: ${critical.join("; ")}`);
  }

  if (!model.isActive) {
    model = await prisma.aiModel.update({
      where: { id: model.id },
      data: { isActive: true },
    });
    console.log("[seed:seedance-2-0-product-video] activated model");
  }

  await prisma.appSetting.upsert({
    where: { key: APP_SETTING_KEY },
    create: {
      key: APP_SETTING_KEY,
      type: "string",
      value: SLUG,
      description: "PRODUCT_VIDEO модель для «Видео товара» (Seedance 2.0 first-frame).",
    },
    update: {
      type: "string",
      value: SLUG,
    },
  });

  console.log(
    `[seed:seedance-2-0-product-video] assigned ${APP_SETTING_KEY}=${SLUG} costCredits=${COST_CREDITS}`,
  );

  if (nonCritical.length > 0) {
    console.log(
      `[seed:seedance-2-0-product-video] non-critical warnings: ${nonCritical.join("; ")}`,
    );
  }

  console.log("[seed:seedance-2-0-product-video] OK");
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
