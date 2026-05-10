/**
 * Kling 3.0 Motion Control (Kie.ai Market).
 * Запуск: npm run seed:kling-motion-control
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { isAdminPricingPinned } from "../src/lib/admin-pricing-pinned";
import { omitSeedPricingWhenPinned } from "./lib/omit-seed-pricing";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("В .env нужен DATABASE_URL");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

const SETTINGS_SCHEMA = {
  fields: [
    {
      name: "resolution",
      type: "select",
      label: "Качество",
      default: "720p",
      options: ["720p", "1080p"],
      required: true,
    },
    {
      name: "characterOrientation",
      type: "select",
      label: "Ориентация персонажа",
      default: "image",
      options: ["image"],
      required: true,
    },
    {
      name: "backgroundSource",
      type: "select",
      label: "Источник фона",
      default: "input_video",
      options: ["input_video", "input_image"],
      required: true,
    },
    {
      name: "inputUrls",
      type: "url-list",
      label: "Reference image URL",
      required: false,
      description: "Заполняется после загрузки файла. JPEG/PNG, до 10MB.",
    },
    {
      name: "videoUrls",
      type: "url-list",
      label: "Motion video URL",
      required: false,
      description: "Заполняется после загрузки. MP4/MOV, 3–30с, до 100MB.",
    },
  ],
} as const;

const PRICING_SCHEMA_NEW = {
  type: "per_second",
  pricingSource: "provider_cost_calculator",
  provider: "KIE_AI",
  providerModel: "kling-3.0/motion-control",
  currency: "KZT",
  internalTokenValueKzt: 10,
  usdToKzt: 458,
  markupPercent: 40,
  resolutions: ["720p", "1080p"],
  durationSource: "uploaded_video",
  durationRounding: "ceil",
  providerCost: {
    motionControl: {
      "720p": {
        kieCreditsPerSecond: 20,
        usdPerSecond: 0.1,
      },
      "1080p": {
        kieCreditsPerSecond: 27,
        usdPerSecond: 0.135,
      },
    },
  },
  manualOverrides: {
    perSecondTokens: {},
  },
  defaultCredits: 33,
  fallbackCredits: 120,
  notes:
    "Kling Motion Control price depends on uploaded reference video duration. Billing duration uses ceil(videoDurationSeconds).",
} as const;

const PAYLOAD_MAPPING = {
  prompt: "input.prompt",
  inputUrls: "input.input_urls",
  videoUrls: "input.video_urls",
  mode: "input.mode",
  characterOrientation: "input.character_orientation",
  backgroundSource: "input.background_source",
} as const;

const DESCRIPTION =
  "Kling 3.0 Motion Control — модель для переноса движения из reference video на персонажа или объект из reference image. Подходит для анимации персонажей, танцев, motion transfer, performance video и управляемого движения.";

async function main() {
  const guard = await prisma.aiModel.findUnique({
    where: { slug: "kling-3-0-motion-control" },
    select: { pricingSchema: true },
  });

  let mergedPricing: Record<string, unknown> = {
    ...PRICING_SCHEMA_NEW,
  };
  if (
    guard?.pricingSchema &&
    isRecord(guard.pricingSchema) &&
    !isAdminPricingPinned(guard.pricingSchema)
  ) {
    const prevMan = guard.pricingSchema.manualOverrides;
    const nextMan = mergedPricing.manualOverrides;
    if (isRecord(prevMan) && isRecord(nextMan)) {
      mergedPricing = {
        ...mergedPricing,
        manualOverrides: {
          ...nextMan,
          perSecondTokens: {
            ...(isRecord(prevMan.perSecondTokens) ? prevMan.perSecondTokens : {}),
            ...(isRecord(nextMan.perSecondTokens) ? nextMan.perSecondTokens : {}),
          },
        },
      };
    }
  }

  const row = await prisma.aiModel.upsert({
    where: { slug: "kling-3-0-motion-control" },
    create: {
      name: "Kling 3.0 Motion Control",
      slug: "kling-3-0-motion-control",
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "kling-3.0/motion-control",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 120,
      realCost: 0,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: true,
      supportsNegativePrompt: false,
      supportsSeed: false,
      maxDuration: 30,
      description: DESCRIPTION,
      availableAspectRatios: ["2:5", "9:16", "1:1", "16:9", "5:2"],
      availableResolutions: ["720p", "1080p"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: mergedPricing as Prisma.InputJsonValue,
      payloadMapping: { ...PAYLOAD_MAPPING },
    },
    update: omitSeedPricingWhenPinned(guard, {
      name: "Kling 3.0 Motion Control",
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "kling-3.0/motion-control",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 120,
      realCost: 0,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: true,
      supportsNegativePrompt: false,
      supportsSeed: false,
      maxDuration: 30,
      description: DESCRIPTION,
      availableAspectRatios: ["2:5", "9:16", "1:1", "16:9", "5:2"],
      availableResolutions: ["720p", "1080p"],
      settingsSchema: { ...SETTINGS_SCHEMA },
      pricingSchema: mergedPricing as Prisma.InputJsonValue,
      payloadMapping: { ...PAYLOAD_MAPPING },
    }),
  });
  console.log("[seed:kling-motion-control] OK", row.id, row.slug);
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
