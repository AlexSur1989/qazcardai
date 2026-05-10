/**
 * Google Veo 3.1 через Kie (`/api/v1/veo/*`, не jobs/createTask).
 * Запуск: npm run seed:veo-3-1
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

const STATUS_ENDPOINT = "/api/v1/veo/record-info";

const SETTINGS_SCHEMA_GENERATE = {
  fields: [
    {
      name: "veoModel",
      type: "select",
      label: "Модель Veo (Kie)",
      default: "veo3_fast",
      options: ["veo3", "veo3_fast", "veo3_lite"],
      required: true,
    },
    {
      name: "aspect_ratio",
      type: "select",
      label: "Соотношение сторон",
      default: "16:9",
      options: ["16:9", "9:16", "Auto"],
      required: true,
    },
    {
      name: "resolution",
      type: "select",
      label: "Разрешение",
      default: "720p",
      options: ["720p", "1080p", "4k"],
      required: true,
    },
    {
      name: "generationType",
      type: "select",
      label: "Режим генерации",
      default: "TEXT_2_VIDEO",
      options: [
        "TEXT_2_VIDEO",
        "FIRST_AND_LAST_FRAMES_2_VIDEO",
        "REFERENCE_2_VIDEO",
      ],
      required: true,
    },
    {
      name: "imageUrls",
      type: "url-list",
      label: "Изображения-референсы (до 3 URL, опционально)",
      maxItems: 3,
      required: false,
    },
    {
      name: "seeds",
      type: "number",
      label: "Seed 10000–99999 (опционально)",
      required: false,
    },
    {
      name: "watermark",
      type: "text",
      label: "Watermark (опционально)",
      required: false,
    },
    {
      name: "enableTranslation",
      type: "boolean",
      label: "Перевод промпта (Kie)",
      default: true,
      required: false,
    },
  ],
} as const;

const SETTINGS_SCHEMA_EXTEND = {
  fields: [
    {
      name: "sourceTaskId",
      type: "text",
      label: "TaskId исходного ролика Veo (обязательно)",
      required: true,
    },
    {
      name: "extendModel",
      type: "select",
      label: "Режим продолжения",
      default: "fast",
      options: ["fast", "quality", "lite"],
      required: true,
    },
    {
      name: "seeds",
      type: "number",
      label: "Seed 10000–99999 (опционально)",
      required: false,
    },
    {
      name: "watermark",
      type: "text",
      label: "Watermark (опционально)",
      required: false,
    },
  ],
} as const;

const SETTINGS_SCHEMA_GET_4K = {
  fields: [
    {
      name: "sourceTaskId",
      type: "text",
      label: "TaskId задачи Veo (обязательно)",
      required: true,
    },
    {
      name: "videoIndex",
      type: "number",
      label: "Индекс видео index (опционально)",
      required: false,
    },
  ],
} as const;

const SETTINGS_SCHEMA_GET_1080P = {
  fields: [
    {
      name: "sourceTaskId",
      type: "text",
      label: "TaskId задачи Veo (обязательно)",
      required: true,
    },
  ],
} as const;

function pricingStub(
  providerModel: string,
  defaultCredits: number,
): Record<string, unknown> {
  return {
    type: "matrix",
    matrixKeyStrategy: "veo_flat",
    currency: "KZT",
    internalTokenValueKzt: 10,
    provider: "KIE_AI",
    providerModel,
    defaultCredits,
    fallbackCredits: defaultCredits,
    matrix: {},
  };
}

const VARIANTS = [
  {
    slug: "veo-3-1",
    name: "Google Veo 3.1",
    apiModelId: "veo-3-1",
    endpoint: "/api/v1/veo/generate",
    description:
      "Veo 3.1 generate (Kie: veo-3-1 → POST /api/v1/veo/generate). veoModel, aspect_ratio, resolution, generationType, imageUrls.",
    settingsSchema: SETTINGS_SCHEMA_GENERATE,
    costCredits: 180,
    supportsImageInput: true,
    supportsSeed: true,
    availableAspectRatios: ["16:9", "9:16", "Auto"],
    availableResolutions: ["720p", "1080p", "4k"],
  },
  {
    slug: "veo-extend",
    name: "Google Veo 3.1 · Extend",
    apiModelId: "veo/extend",
    endpoint: "/api/v1/veo/extend",
    description:
      "Продолжение ролика (Kie: veo/extend → POST /api/v1/veo/extend). Нужен sourceTaskId + prompt.",
    settingsSchema: SETTINGS_SCHEMA_EXTEND,
    costCredits: 120,
    supportsImageInput: false,
    supportsSeed: true,
    availableAspectRatios: [],
    availableResolutions: [],
  },
  {
    slug: "veo-get-4k-video",
    name: "Google Veo 3.1 · Get 4K",
    apiModelId: "veo/get-4k-video",
    endpoint: "/api/v1/veo/get-4k-video",
    description:
      "Получить 4K (Kie: veo/get-4k-video → POST /api/v1/veo/get-4k-video). sourceTaskId; опционально videoIndex.",
    settingsSchema: SETTINGS_SCHEMA_GET_4K,
    costCredits: 40,
    supportsImageInput: false,
    supportsSeed: false,
    availableAspectRatios: [],
    availableResolutions: [],
  },
  {
    slug: "veo-get-1080p-video",
    name: "Google Veo 3.1 · Get 1080p",
    apiModelId: "veo/get-1080p-video",
    endpoint: "/api/v1/veo/get-1080p-video",
    description:
      "Получить 1080p (Kie: veo/get-1080p-video → GET с taskId). В настройках укажите sourceTaskId.",
    settingsSchema: SETTINGS_SCHEMA_GET_1080P,
    costCredits: 20,
    supportsImageInput: false,
    supportsSeed: false,
    availableAspectRatios: [],
    availableResolutions: [],
  },
] as const;

async function main() {
  for (const v of VARIANTS) {
    const guard = await prisma.aiModel.findUnique({
      where: { slug: v.slug },
      select: { pricingSchema: true },
    });
    const pricingSchema = pricingStub(v.apiModelId, v.costCredits);
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
        endpoint: v.endpoint,
        statusEndpoint: STATUS_ENDPOINT,
        costCredits: v.costCredits,
        realCost: 0,
        isActive: true,
        supportsImageInput: v.supportsImageInput,
        supportsVideoInput: false,
        supportsNegativePrompt: false,
        supportsSeed: v.supportsSeed,
        maxDuration: null,
        description: v.description,
        availableAspectRatios: v.availableAspectRatios,
        availableResolutions: v.availableResolutions,
        settingsSchema: { ...v.settingsSchema } as object,
        pricingSchema: pricingSchema as object,
      },
      update: omitSeedPricingWhenPinned(guard, {
        name: v.name,
        scope: "GENERAL",
        productCardModelType: null,
        provider: "KIE_AI",
        type: "VIDEO",
        apiModelId: v.apiModelId,
        endpoint: v.endpoint,
        statusEndpoint: STATUS_ENDPOINT,
        costCredits: v.costCredits,
        realCost: 0,
        isActive: true,
        supportsImageInput: v.supportsImageInput,
        supportsVideoInput: false,
        supportsNegativePrompt: false,
        supportsSeed: v.supportsSeed,
        maxDuration: null,
        description: v.description,
        availableAspectRatios: v.availableAspectRatios,
        availableResolutions: v.availableResolutions,
        settingsSchema: { ...v.settingsSchema } as object,
        pricingSchema: pricingSchema as object,
      }),
    });
    console.log("[seed:veo-3-1]", row.slug, row.apiModelId, row.id);
  }
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
