/**
 * HappyHorse-1.0 (Kie): четыре строки AiModel (T2V / I2V / RTV / video-edit) из реестра
 * `@/server/kie/kie-happyhorse-models`.
 * Старую запись `happyhorse-1-0` (один slug) выключаем, не удаляя физически.
 *
 * Запуск: npm run seed:happyhorse
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { HAPPYHORSE_MODELS } from "@/server/kie/kie-happyhorse-models";

import { omitSeedPricingWhenPinned } from "./lib/omit-seed-pricing";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("В .env нужен DATABASE_URL");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const def of HAPPYHORSE_MODELS) {
    const guard = await prisma.aiModel.findUnique({
      where: { slug: def.slug },
      select: { pricingSchema: true },
    });

    const common = {
      name: def.name,
      scope: "GENERAL" as const,
      productCardModelType: null as null,
      provider: "KIE_AI" as const,
      type: def.type,
      apiModelId: def.apiModelId,
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: "/api/v1/jobs/recordInfo",
      costCredits: def.costCredits,
      realCost: def.realCost ?? undefined,
      isActive: true,
      supportsImageInput: def.supportsImageInput,
      supportsVideoInput: def.supportsVideoInput,
      supportsNegativePrompt: false,
      supportsSeed: def.supportsSeed,
      ...(def.maxDuration != null ? { maxDuration: def.maxDuration } : {}),
      description: def.description,
      availableAspectRatios: [...def.availableAspectRatios],
      availableResolutions: [...def.availableResolutions],
      settingsSchema: def.settingsSchema as object,
      metadata: def.metadata as object,
      pricingSchema: def.pricingSchema as object,
      payloadMapping: def.payloadMapping as object,
    };

    const row = await prisma.aiModel.upsert({
      where: { slug: def.slug },
      create: {
        slug: def.slug,
        ...common,
      },
      update: omitSeedPricingWhenPinned(guard, { ...common }),
    });

    console.log("[seed:happyhorse]", def.slug, row.id);
  }

  await prisma.aiModel.updateMany({
    where: { slug: "happyhorse-1-0" },
    data: { isActive: false },
  });

  console.log("[seed:happyhorse] archived legacy slug happyhorse-1-0 -> isActive=false");
  console.log("[seed:happyhorse] OK");
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
