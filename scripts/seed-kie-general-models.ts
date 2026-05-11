/**
 * Актуальные GENERAL-модели Kie.ai (GPT Image 2 T2I/I2I + Kling 2.6 T2V/I2V).
 * Идемпотентный upsert по slug. Запуск: npm run seed:kie-general-models
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

const GPT_T2I_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "aspectRatio",
      label: "Формат",
      type: "select",
      required: true,
      default: "auto",
      options: [
        { label: "Auto", value: "auto" },
        { label: "1:1", value: "1:1" },
        { label: "9:16", value: "9:16" },
        { label: "16:9", value: "16:9" },
        { label: "4:3", value: "4:3" },
        { label: "3:4", value: "3:4" },
      ],
    },
  ],
} as const;

const GPT_I2I_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "inputUrls",
      label: "Исходные изображения",
      type: "upload-list",
      required: true,
      maxItems: 16,
      accept: "image/*",
      purpose: "generation_input",
    },
    ...GPT_T2I_SETTINGS.fields,
  ],
} as const;

const GPT_T2I_PAYLOAD = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["aspect_ratio"],
  input: {
    aspect_ratio: "$settings.aspectRatio",
  },
  coerce: {
    aspect_ratio: "string",
  },
} as const;

const GPT_I2I_PAYLOAD = {
  adapter: "market-create-task",
  omitNull: true,
  required: ["input_urls", "aspect_ratio"],
  input: {
    input_urls: "$settings.inputUrls",
    aspect_ratio: "$settings.aspectRatio",
  },
  coerce: {
    input_urls: "stringArray",
    aspect_ratio: "string",
  },
} as const;

/** Стоимость берётся из costCredits; тип не `matrix`, чтобы не требовать скрытых полей в settings. */
const FLAT_PRICING_NOTE = {
  type: "fixed_by_model_costCredits",
  note: "Кредиты = costCredits модели, без матрицы по settings",
} as const;

const KLING_26_T2V_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "duration",
      label: "Длительность",
      type: "select",
      required: true,
      default: "5",
      options: [
        { label: "5 сек", value: "5" },
        { label: "10 сек", value: "10" },
      ],
    },
    {
      name: "aspectRatio",
      label: "Формат",
      type: "select",
      required: true,
      default: "1:1",
      options: [
        { label: "1:1", value: "1:1" },
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
      ],
    },
    {
      name: "sound",
      label: "Звук",
      type: "boolean",
      required: true,
      default: false,
    },
  ],
} as const;

const KLING_26_I2V_SETTINGS = {
  version: 1,
  fields: [
    {
      name: "imageUrls",
      label: "Исходное изображение",
      type: "upload-list",
      required: true,
      maxItems: 1,
      accept: "image/*",
      purpose: "generation_input",
    },
    {
      name: "duration",
      label: "Длительность",
      type: "select",
      required: true,
      default: "5",
      options: [
        { label: "5 сек", value: "5" },
        { label: "10 сек", value: "10" },
      ],
    },
    {
      name: "sound",
      label: "Звук",
      type: "boolean",
      required: true,
      default: false,
    },
  ],
} as const;

const KLING_26_T2V_PAYLOAD = {
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

const KLING_26_I2V_PAYLOAD = {
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

const KLING_26_PRICING_BASE = {
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
    },
    std_sound: {
      "5": 33,
      "10": 66,
    },
    pro_no_sound: {
      "5": 30,
      "10": 59,
    },
    pro_sound: {
      "5": 44,
      "10": 88,
    },
    "4K": {
      "5": 110,
      "10": 219,
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

function pricingSchemaFor(providerModel: string): Record<string, unknown> {
  return {
    ...KLING_26_PRICING_BASE,
    providerModel,
  };
}

async function main() {
  const gptT2iSlug = "gpt-image-2-text-to-image";
  const g2g = await prisma.aiModel.findUnique({
    where: { slug: gptT2iSlug },
    select: { pricingSchema: true },
  });
  const gptT2i = await prisma.aiModel.upsert({
    where: { slug: gptT2iSlug },
    create: {
      name: "GPT Image 2 — текст → изображение",
      slug: gptT2iSlug,
      scope: "GENERAL",
      productCardModelType: null,
      provider: "KIE_AI",
      type: "IMAGE",
      apiModelId: "gpt-image-2-text-to-image",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 20,
      realCost: 0.03,
      isActive: true,
      supportsImageInput: false,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      description:
        "Генерация изображения по тексту (Kie: gpt-image-2-text-to-image).",
      availableAspectRatios: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      availableResolutions: [],
      settingsSchema: { ...GPT_T2I_SETTINGS },
      pricingSchema: { ...FLAT_PRICING_NOTE },
      payloadMapping: { ...GPT_T2I_PAYLOAD },
    },
    update: omitSeedPricingWhenPinned(g2g, {
      name: "GPT Image 2 — текст → изображение",
      scope: "GENERAL",
      productCardModelType: null,
      provider: "KIE_AI",
      type: "IMAGE",
      apiModelId: "gpt-image-2-text-to-image",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 20,
      realCost: 0.03,
      isActive: true,
      supportsImageInput: false,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      description:
        "Генерация изображения по тексту (Kie: gpt-image-2-text-to-image).",
      availableAspectRatios: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      availableResolutions: [],
      settingsSchema: { ...GPT_T2I_SETTINGS },
      pricingSchema: { ...FLAT_PRICING_NOTE },
      payloadMapping: { ...GPT_T2I_PAYLOAD },
    }),
  });

  const gptI2iSlug = "gpt-image-2-image-to-image";
  const gi2g = await prisma.aiModel.findUnique({
    where: { slug: gptI2iSlug },
    select: { pricingSchema: true },
  });
  const gptI2i = await prisma.aiModel.upsert({
    where: { slug: gptI2iSlug },
    create: {
      name: "GPT Image 2 — изображение → изображение",
      slug: gptI2iSlug,
      scope: "GENERAL",
      productCardModelType: null,
      provider: "KIE_AI",
      type: "IMAGE",
      apiModelId: "gpt-image-2-image-to-image",
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
        "Референсы + текст (Kie: gpt-image-2-image-to-image).",
      availableAspectRatios: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      availableResolutions: [],
      settingsSchema: { ...GPT_I2I_SETTINGS },
      pricingSchema: { ...FLAT_PRICING_NOTE },
      payloadMapping: { ...GPT_I2I_PAYLOAD },
    },
    update: omitSeedPricingWhenPinned(gi2g, {
      name: "GPT Image 2 — изображение → изображение",
      scope: "GENERAL",
      productCardModelType: null,
      provider: "KIE_AI",
      type: "IMAGE",
      apiModelId: "gpt-image-2-image-to-image",
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
        "Референсы + текст (Kie: gpt-image-2-image-to-image).",
      availableAspectRatios: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      availableResolutions: [],
      settingsSchema: { ...GPT_I2I_SETTINGS },
      pricingSchema: { ...FLAT_PRICING_NOTE },
      payloadMapping: { ...GPT_I2I_PAYLOAD },
    }),
  });

  const klingT2vSlug = "kling-2-6-text-to-video";
  const ktGuard = await prisma.aiModel.findUnique({
    where: { slug: klingT2vSlug },
    select: { pricingSchema: true },
  });
  const klingT2vPricing = omitSeedPricingWhenPinned(
    ktGuard,
    pricingSchemaFor("kling-2.6/text-to-video"),
  ) as object;

  const klingT2v = await prisma.aiModel.upsert({
    where: { slug: klingT2vSlug },
    create: {
      name: "Kling 2.6 Text to Video",
      slug: klingT2vSlug,
      scope: "GENERAL",
      productCardModelType: null,
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "kling-2.6/text-to-video",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 46,
      realCost: 0,
      isActive: true,
      supportsImageInput: false,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      maxDuration: 10,
      description:
        "Kling 2.6 Text→Video (Kie: kling-2.6/text-to-video).",
      availableAspectRatios: ["1:1", "16:9", "9:16"],
      availableResolutions: [],
      settingsSchema: { ...KLING_26_T2V_SETTINGS },
      pricingSchema: klingT2vPricing as object,
      payloadMapping: { ...KLING_26_T2V_PAYLOAD },
    },
    update: omitSeedPricingWhenPinned(ktGuard, {
      name: "Kling 2.6 Text to Video",
      scope: "GENERAL",
      productCardModelType: null,
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "kling-2.6/text-to-video",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 46,
      realCost: 0,
      isActive: true,
      supportsImageInput: false,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      maxDuration: 10,
      description:
        "Kling 2.6 Text→Video (Kie: kling-2.6/text-to-video).",
      availableAspectRatios: ["1:1", "16:9", "9:16"],
      availableResolutions: [],
      settingsSchema: { ...KLING_26_T2V_SETTINGS },
      pricingSchema: pricingSchemaFor("kling-2.6/text-to-video") as object,
      payloadMapping: { ...KLING_26_T2V_PAYLOAD },
    }),
  });

  const klingI2vSlug = "kling-2-6-image-to-video";
  const kiGuard = await prisma.aiModel.findUnique({
    where: { slug: klingI2vSlug },
    select: { pricingSchema: true },
  });
  const klingI2vPricing = omitSeedPricingWhenPinned(
    kiGuard,
    pricingSchemaFor("kling-2.6/image-to-video"),
  ) as object;

  const klingI2v = await prisma.aiModel.upsert({
    where: { slug: klingI2vSlug },
    create: {
      name: "Kling 2.6 Image to Video",
      slug: klingI2vSlug,
      scope: "GENERAL",
      productCardModelType: null,
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "kling-2.6/image-to-video",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 46,
      realCost: 0,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      maxDuration: 10,
      description:
        "Kling 2.6 Image→Video (Kie: kling-2.6/image-to-video).",
      availableAspectRatios: [],
      availableResolutions: [],
      settingsSchema: { ...KLING_26_I2V_SETTINGS },
      pricingSchema: klingI2vPricing as object,
      payloadMapping: { ...KLING_26_I2V_PAYLOAD },
    },
    update: omitSeedPricingWhenPinned(kiGuard, {
      name: "Kling 2.6 Image to Video",
      scope: "GENERAL",
      productCardModelType: null,
      provider: "KIE_AI",
      type: "VIDEO",
      apiModelId: "kling-2.6/image-to-video",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: 46,
      realCost: 0,
      isActive: true,
      supportsImageInput: true,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
      maxDuration: 10,
      description:
        "Kling 2.6 Image→Video (Kie: kling-2.6/image-to-video).",
      availableAspectRatios: [],
      availableResolutions: [],
      settingsSchema: { ...KLING_26_I2V_SETTINGS },
      pricingSchema: pricingSchemaFor("kling-2.6/image-to-video") as object,
      payloadMapping: { ...KLING_26_I2V_PAYLOAD },
    }),
  });

  console.log("[seed:kie-general-models] OK");
  console.log("  GPT T2I:", gptT2i.id, gptT2i.slug);
  console.log("  GPT I2I:", gptI2i.id, gptI2i.slug);
  console.log("  Kling T2V:", klingT2v.id, klingT2v.slug);
  console.log("  Kling I2V:", klingI2v.id, klingI2v.slug);
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
