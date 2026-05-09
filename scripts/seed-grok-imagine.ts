/**
 * Grok Imagine (Kie Market): text/image → image/video.
 * Запуск: npm run seed:grok-imagine
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("В .env нужен DATABASE_URL");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ENDPOINT = "/api/v1/jobs/createTask";
const STATUS_ENDPOINT = "/api/v1/jobs/recordInfo";

const SETTINGS_IMAGE_T2I = {
  fields: [
    {
      name: "aspectRatio",
      type: "select",
      label: "Соотношение сторон",
      default: "1:1",
      options: ["1:1", "16:9", "9:16", "4:3", "3:4"],
      required: true,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "1K",
      options: ["1K", "2K", "4K"],
      required: true,
    },
    {
      name: "duration",
      type: "hidden",
      label: "Pricing",
      default: "1",
      required: true,
    },
  ],
} as const;

const SETTINGS_IMAGE_I2I = {
  fields: [
    {
      name: "imageUrls",
      type: "url-list",
      label: "URL изображений (референс)",
      maxItems: 8,
      required: false,
    },
    {
      name: "aspectRatio",
      type: "select",
      label: "Соотношение сторон",
      default: "1:1",
      options: ["1:1", "16:9", "9:16", "4:3", "3:4"],
      required: true,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "1K",
      options: ["1K", "2K", "4K"],
      required: true,
    },
    {
      name: "duration",
      type: "hidden",
      label: "Pricing",
      default: "1",
      required: true,
    },
  ],
} as const;

const SETTINGS_VIDEO = {
  fields: [
    {
      name: "imageUrls",
      type: "url-list",
      label: "URL изображений (для Image→Video)",
      maxItems: 4,
      required: false,
    },
    {
      name: "aspectRatio",
      type: "select",
      label: "Соотношение сторон",
      default: "16:9",
      options: ["16:9", "9:16", "1:1", "4:3", "3:4"],
      required: true,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "720p",
      options: ["720p", "1080p"],
      required: true,
    },
    {
      name: "duration",
      type: "select",
      label: "Длительность (с)",
      default: "5",
      options: ["5", "8", "10"],
      required: true,
    },
  ],
} as const;

const PRICING_IMAGE = {
  type: "matrix",
  currency: "KZT",
  internalTokenValueKzt: 10,
  provider: "KIE_AI",
  defaultCredits: 30,
  matrix: {
    "1K": { "1": 28 },
    "2K": { "1": 36 },
    "4K": { "1": 48 },
  },
  fallbackCredits: 30,
} as const;

const PRICING_VIDEO = {
  type: "matrix",
  currency: "KZT",
  internalTokenValueKzt: 10,
  provider: "KIE_AI",
  defaultCredits: 80,
  matrix: {
    "720p": {
      "5": 72,
      "8": 96,
      "10": 120,
    },
    "1080p": {
      "5": 108,
      "8": 144,
      "10": 180,
    },
  },
  fallbackCredits: 80,
} as const;

type GrokSpec = {
  slug: string;
  name: string;
  type: "IMAGE" | "VIDEO";
  apiModelId: string;
  supportsImageInput: boolean;
  supportsVideoInput: boolean;
  maxDuration: number | undefined;
  description: string;
  settingsSchema: { fields: readonly unknown[] };
  pricingSchema: Record<string, unknown>;
};

const MODELS: GrokSpec[] = [
  {
    slug: "grok-imagine-text-to-image",
    name: "Grok Imagine Text to Image",
    type: "IMAGE",
    apiModelId: "grok-imagine/text-to-image",
    supportsImageInput: false,
    supportsVideoInput: false,
    maxDuration: undefined,
    description:
      "Grok Imagine Text→Image (Kie: grok-imagine/text-to-image). Аспект и разрешение в settings.",
    settingsSchema: SETTINGS_IMAGE_T2I,
    pricingSchema: { ...PRICING_IMAGE, providerModel: "grok-imagine/text-to-image" },
  },
  {
    slug: "grok-imagine-image-to-image",
    name: "Grok Imagine Image to Image",
    type: "IMAGE",
    apiModelId: "grok-imagine/image-to-image",
    supportsImageInput: true,
    supportsVideoInput: false,
    maxDuration: undefined,
    description:
      "Grok Imagine Image→Image (Kie: grok-imagine/image-to-image). Минимум один imageUrls.",
    settingsSchema: SETTINGS_IMAGE_I2I,
    pricingSchema: { ...PRICING_IMAGE, providerModel: "grok-imagine/image-to-image" },
  },
  {
    slug: "grok-imagine-text-to-video",
    name: "Grok Imagine Text to Video",
    type: "VIDEO",
    apiModelId: "grok-imagine/text-to-video",
    supportsImageInput: false,
    supportsVideoInput: false,
    maxDuration: 15,
    description:
      "Grok Imagine Text→Video (Kie: grok-imagine/text-to-video). Длительность, aspect, resolution.",
    settingsSchema: SETTINGS_VIDEO,
    pricingSchema: { ...PRICING_VIDEO, providerModel: "grok-imagine/text-to-video" },
  },
  {
    slug: "grok-imagine-image-to-video",
    name: "Grok Imagine Image to Video",
    type: "VIDEO",
    apiModelId: "grok-imagine/image-to-video",
    supportsImageInput: true,
    supportsVideoInput: false,
    maxDuration: 15,
    description:
      "Grok Imagine Image→Video (Kie: grok-imagine/image-to-video). imageUrls + промпт.",
    settingsSchema: SETTINGS_VIDEO,
    pricingSchema: { ...PRICING_VIDEO, providerModel: "grok-imagine/image-to-video" },
  },
];

async function main() {
  for (const m of MODELS) {
    const row = await prisma.aiModel.upsert({
      where: { slug: m.slug },
      create: {
        name: m.name,
        slug: m.slug,
        provider: "KIE_AI",
        type: m.type,
        apiModelId: m.apiModelId,
        endpoint: ENDPOINT,
        statusEndpoint: STATUS_ENDPOINT,
        costCredits: m.type === "IMAGE" ? 30 : 80,
        realCost: 0,
        isActive: true,
        supportsImageInput: m.supportsImageInput,
        supportsVideoInput: m.supportsVideoInput,
        supportsNegativePrompt: false,
        supportsSeed: false,
        maxDuration: m.maxDuration ?? null,
        description: m.description,
        availableAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
        availableResolutions: m.type === "IMAGE" ? ["1K", "2K", "4K"] : ["720p", "1080p"],
        settingsSchema: { fields: [...m.settingsSchema.fields] } as object,
        pricingSchema: m.pricingSchema as object,
      },
      update: {
        name: m.name,
        provider: "KIE_AI",
        type: m.type,
        apiModelId: m.apiModelId,
        endpoint: ENDPOINT,
        statusEndpoint: STATUS_ENDPOINT,
        costCredits: m.type === "IMAGE" ? 30 : 80,
        realCost: 0,
        isActive: true,
        supportsImageInput: m.supportsImageInput,
        supportsVideoInput: m.supportsVideoInput,
        supportsNegativePrompt: false,
        supportsSeed: false,
        maxDuration: m.maxDuration ?? null,
        description: m.description,
        availableAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
        availableResolutions: m.type === "IMAGE" ? ["1K", "2K", "4K"] : ["720p", "1080p"],
        settingsSchema: { fields: [...m.settingsSchema.fields] } as object,
        pricingSchema: m.pricingSchema as object,
      },
    });
    console.log("[seed:grok-imagine]", row.slug, row.id);
  }
  console.log("[seed:grok-imagine] OK", MODELS.length);
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
