/**
 * GENERAL-модели Kie из общего source registry.
 * Идемпотентный upsert по slug: npm run seed:kie-general-models
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { KIE_GENERAL_MODEL_DEFINITIONS } from "@/server/kie/kie-general-model-definitions";
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
  let created = 0;
  let updated = 0;
  const slugs: string[] = [];
  const hidden: string[] = [];
  const pricingNeedsReview: string[] = [];

  for (const def of KIE_GENERAL_MODEL_DEFINITIONS) {
    const guard = await prisma.aiModel.findUnique({
      where: { slug: def.slug },
      select: { id: true, pricingSchema: true, metadata: true },
    });

    const common = {
      name: def.name,
      scope: def.scope,
      productCardModelType: def.productCardModelType,
      provider: def.provider,
      type: def.type,
      apiModelId: def.apiModelId,
      endpoint: def.endpoint,
      statusEndpoint: def.statusEndpoint,
      costCredits: def.costCredits,
      realCost: def.realCost ?? undefined,
      isActive: true,
      isPublic: def.isPublic,
      supportsImageInput: def.supportsImageInput,
      supportsVideoInput: def.supportsVideoInput,
      supportsNegativePrompt: def.supportsNegativePrompt,
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

    if (guard?.id) {
      updated++;
    } else {
      created++;
    }
    slugs.push(def.slug);
    if (def.isPublic !== true) hidden.push(def.slug);
    if (
      def.metadata.pricingNeedsReview === true ||
      (def.pricingSchema as { pricingNeedsReview?: unknown }).pricingNeedsReview === true
    ) {
      pricingNeedsReview.push(def.slug);
    }
    console.log("[seed:kie-general-models]", def.slug, row.id);
  }

  console.log("[seed:kie-general-models] OK");
  console.log("[seed:kie-general-models] created:", created);
  console.log("[seed:kie-general-models] updated:", updated);
  console.log("[seed:kie-general-models] slugs:", slugs.join(", "));
  if (hidden.length > 0) {
    console.warn("[seed:kie-general-models] publicReady=false:", hidden.join(", "));
  }
  if (pricingNeedsReview.length > 0) {
    console.warn(
      "[seed:kie-general-models] pricingNeedsReview=true:",
      pricingNeedsReview.join(", "),
    );
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
