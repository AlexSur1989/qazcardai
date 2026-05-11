/**
 * Создаёт или обновляет видео-модели Kling 3.0 и Kling 2.6 (Kie.ai Market).
 * Запуск: npm run seed:kling
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

const SETTINGS_SCHEMA = {
  fields: [
    {
      name: "mode",
      type: "select",
      label: "Качество модели",
      default: "std",
      options: ["std", "pro", "4K"],
      required: true,
    },
    {
      name: "duration",
      type: "select",
      label: "Длительность",
      default: "5",
      options: ["5", "10", "15"],
      required: true,
    },
    {
      name: "sound",
      type: "boolean",
      label: "Сгенерировать звук",
      default: false,
      required: false,
    },
    {
      name: "aspectRatio",
      type: "select",
      label: "Соотношение сторон",
      default: "16:9",
      options: ["16:9", "9:16", "1:1"],
      required: true,
    },
    {
      name: "imageUrls",
      type: "url-list",
      label: "URL первого/последнего кадра",
      required: false,
    },
    {
      name: "multiShots",
      type: "boolean",
      label: "Multi-shot режим",
      default: false,
      required: false,
    },
  ],
} as const;

const PRICING_MATRIX = {
  type: "matrix",
  matrixKeyStrategy: "kling_mode_sound",
  currency: "KZT",
  internalTokenValueKzt: 10,
  provider: "KIE_AI",
  markupPercent: 40,
  defaultCredits: 46,
  matrix: {
    std_no_sound: {
      "5": 23,
      "10": 46,
      "15": 69,
    },
    std_sound: {
      "5": 33,
      "10": 66,
      "15": 98,
    },
    pro_no_sound: {
      "5": 30,
      "10": 59,
      "15": 88,
    },
    pro_sound: {
      "5": 44,
      "10": 88,
      "15": 132,
    },
    "4K": {
      "5": 110,
      "10": 219,
      "15": 328,
    },
  },
  providerCost: {
    std_no_sound: {
      kieCreditsPerSecond: 14,
      usdPerSecond: 0.07,
    },
    std_sound: {
      kieCreditsPerSecond: 20,
      usdPerSecond: 0.1,
    },
    pro_no_sound: {
      kieCreditsPerSecond: 18,
      usdPerSecond: 0.09,
    },
    pro_sound: {
      kieCreditsPerSecond: 27,
      usdPerSecond: 0.135,
    },
    "4K": {
      kieCreditsPerSecond: 67,
      usdPerSecond: 0.335,
    },
  },
  fallbackCredits: 46,
} as const satisfies Record<string, unknown>;

const PAYLOAD_MAPPING = {
  prompt: "input.prompt",
  mode: "input.mode",
  duration: "input.duration",
  sound: "input.sound",
  aspectRatio: "input.aspect_ratio",
  imageUrls: "input.image_urls",
  multiShots: "input.multi_shots",
} as const;

const KLING_26_T2V_SETTINGS_SCHEMA = {
  fields: [
    {
      name: "duration",
      type: "select",
      label: "Длительность",
      default: "5",
      options: ["5", "10"],
      required: true,
    },
    {
      name: "aspectRatio",
      type: "select",
      label: "Формат",
      default: "1:1",
      options: ["1:1", "16:9", "9:16"],
      required: true,
    },
    {
      name: "sound",
      type: "boolean",
      label: "Звук",
      default: false,
      required: true,
    },
  ],
} as const;

const KLING_26_I2V_SETTINGS_SCHEMA = {
  fields: [
    {
      name: "imageUrls",
      type: "upload-list",
      label: "Исходное изображение",
      required: true,
      maxItems: 1,
      accept: "image/*",
    },
    {
      name: "duration",
      type: "select",
      label: "Длительность",
      default: "5",
      options: ["5", "10"],
      required: true,
    },
    {
      name: "sound",
      type: "boolean",
      label: "Звук",
      default: false,
      required: true,
    },
  ],
} as const;

const KLING_26_T2V_PAYLOAD_MAPPING = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["sound", "aspect_ratio", "duration"],
  input: {
    sound: "$settings.sound",
    aspect_ratio: "$settings.aspectRatio",
    duration: "$settings.duration",
  },
  coerce: {
    sound: "boolean",
    aspect_ratio: "string",
    duration: "string",
  },
} as const;

const KLING_26_I2V_PAYLOAD_MAPPING = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["image_urls", "sound", "duration"],
  input: {
    image_urls: "$settings.imageUrls",
    sound: "$settings.sound",
    duration: "$settings.duration",
  },
  coerce: {
    image_urls: "stringArray",
    sound: "boolean",
    duration: "string",
  },
} as const;

const VARIANTS = [
  {
    slug: "kling-3-0",
    name: "Kling 3.0",
    apiModelId: "kling-3.0",
    description:
      "Kling 3.0 — видео по тексту и изображениям (Kie: kling-3.0): std/pro/4K, звук, single/multi-shot.",
  },
  {
    slug: "kling-3-0-video",
    name: "Kling 3.0 Video",
    apiModelId: "kling-3.0/video",
    description:
      "Kling 3.0 Video — тот же набор параметров, модель Kie: kling-3.0/video (createTask).",
  },
  {
    slug: "kling-2-6-text-to-video",
    name: "Kling 2.6 Text to Video",
    apiModelId: "kling-2.6/text-to-video",
    description:
      "Kling 2.6 Text→Video (Kie: kling-2.6/text-to-video): prompt, sound, aspect_ratio, duration.",
  },
  {
    slug: "kling-2-6-image-to-video",
    name: "Kling 2.6 Image to Video",
    apiModelId: "kling-2.6/image-to-video",
    description:
      "Kling 2.6 Image→Video (Kie: kling-2.6/image-to-video): prompt, image_urls, sound, duration.",
  },
] as const;

function pricingSchemaFor(providerModel: string): Record<string, unknown> {
  return {
    ...PRICING_MATRIX,
    providerModel,
  };
}

/** Управляются только `seed:kie-general-models` + общий реестр phase1 */
const PHASE1_REGISTRY_SLUGS = new Set<string>([
  "kling-2-6-text-to-video",
  "kling-2-6-image-to-video",
]);

async function main() {
  for (const v of VARIANTS) {
    if (PHASE1_REGISTRY_SLUGS.has(v.slug)) {
      console.log("[seed:kling] skip — реестрируется через seed:kie-general-models:", v.slug);
      continue;
    }
    const isKling26T2V = v.apiModelId === "kling-2.6/text-to-video";
    const isKling26I2V = v.apiModelId === "kling-2.6/image-to-video";
    const settingsSchema = isKling26T2V
      ? KLING_26_T2V_SETTINGS_SCHEMA
      : isKling26I2V
        ? KLING_26_I2V_SETTINGS_SCHEMA
        : SETTINGS_SCHEMA;
    const payloadMapping = isKling26T2V
      ? KLING_26_T2V_PAYLOAD_MAPPING
      : isKling26I2V
        ? KLING_26_I2V_PAYLOAD_MAPPING
        : PAYLOAD_MAPPING;
    const supportsImageInput = isKling26T2V ? false : true;
    const maxDuration = isKling26T2V || isKling26I2V ? 10 : 15;
    const availableAspectRatios = isKling26I2V ? [] : ["16:9", "9:16", "1:1"];
    const availableResolutions = isKling26T2V || isKling26I2V ? [] : ["std", "pro", "4K"];
    const guard = await prisma.aiModel.findUnique({
      where: { slug: v.slug },
      select: { pricingSchema: true },
    });
    const pricingSchema = pricingSchemaFor(v.apiModelId);
    const row = await prisma.aiModel.upsert({
      where: { slug: v.slug },
      create: {
        name: v.name,
        slug: v.slug,
        scope: "GENERAL",
        productCardModelType: null,
        provider: "KIE_AI",
        type: "VIDEO",
        apiModelId: v.apiModelId,
        endpoint: "/api/v1/jobs/createTask",
        statusEndpoint: "/api/v1/jobs/recordInfo",
        costCredits: 46,
        realCost: 0,
        isActive: true,
        supportsImageInput,
        supportsVideoInput: false,
        supportsNegativePrompt: false,
        supportsSeed: false,
        maxDuration,
        description: v.description,
        availableAspectRatios,
        availableResolutions,
        settingsSchema: { ...settingsSchema },
        pricingSchema: pricingSchema as object,
        payloadMapping: { ...payloadMapping },
      },
      update: omitSeedPricingWhenPinned(guard, {
        name: v.name,
        scope: "GENERAL",
        productCardModelType: null,
        provider: "KIE_AI",
        type: "VIDEO",
        apiModelId: v.apiModelId,
        endpoint: "/api/v1/jobs/createTask",
        statusEndpoint: "/api/v1/jobs/recordInfo",
        costCredits: 46,
        realCost: 0,
        isActive: true,
        supportsImageInput,
        supportsVideoInput: false,
        supportsNegativePrompt: false,
        supportsSeed: false,
        maxDuration,
        description: v.description,
        availableAspectRatios,
        availableResolutions,
        settingsSchema: { ...settingsSchema },
        pricingSchema: pricingSchema as object,
        payloadMapping: { ...payloadMapping },
      }),
    });
    console.log("[seed:kling]", v.slug, row.id);
  }
  console.log("[seed:kling] OK", VARIANTS.length, "variants");
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
