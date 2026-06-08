/**
 * Проверка seed Product Card моделей, Import Wizard helpers и diagnostics.
 * npm run verify:product-card-model-setup
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import {
  buildFixedPricingSchema,
  buildImportMetadata,
  detectFieldsFromKieInput,
  parseKiePayloadJson,
} from "../src/lib/kie-import-wizard";
import { getProductCardModelSetupOverview } from "../src/server/services/productCardModelSetup";
import {
  buildDryRunKiePayloadForModel,
  collectModelDryRunWarnings,
} from "../src/server/services/adminModelPayloadDryRun";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("В .env нужен DATABASE_URL");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EXPECTED_STUBS = [
  {
    slug: "product-classifier-kie",
    productCardModelType: "PRODUCT_CLASSIFIER",
    type: "IMAGE",
    supportsImageInput: false,
  },
  {
    slug: "product-concept-image-kie",
    productCardModelType: "PRODUCT_CONCEPT_IMAGE",
    type: "IMAGE",
    supportsImageInput: false,
  },
  {
    slug: "product-marketplace-card-kie",
    productCardModelType: "PRODUCT_MARKETPLACE_CARD",
    type: "IMAGE",
    supportsImageInput: true,
  },
  {
    slug: "product-video-kie",
    productCardModelType: "PRODUCT_VIDEO",
    type: "VIDEO",
    supportsImageInput: true,
  },
] as const;

function fail(msg: string): never {
  console.error(`[verify:product-card-model-setup] FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  for (const exp of EXPECTED_STUBS) {
    const row = await prisma.aiModel.findUnique({
      where: { slug: exp.slug },
      select: {
        slug: true,
        scope: true,
        productCardModelType: true,
        type: true,
        isActive: true,
        isPublic: true,
        supportsImageInput: true,
        apiModelId: true,
        metadata: true,
      },
    });
    if (!row) fail(`missing stub ${exp.slug}`);
    if (row.scope !== "PRODUCT_CARD") fail(`${exp.slug}: scope=${row.scope}`);
    if (row.productCardModelType !== exp.productCardModelType) {
      fail(`${exp.slug}: productCardModelType=${row.productCardModelType}`);
    }
    if (row.type !== exp.type) fail(`${exp.slug}: type=${row.type}`);
    if (row.isActive || row.isPublic) fail(`${exp.slug}: must stay inactive`);
    if (row.supportsImageInput !== exp.supportsImageInput) {
      fail(`${exp.slug}: supportsImageInput=${row.supportsImageInput}`);
    }
    if (row.apiModelId === "PLACEHOLDER") {
      const meta = row.metadata as Record<string, unknown> | null;
      if (!meta?.warning) fail(`${exp.slug}: PLACEHOLDER without metadata.warning`);
    }
  }

  const dupes = await prisma.aiModel.groupBy({
    by: ["slug"],
    where: { slug: { in: EXPECTED_STUBS.map((s) => s.slug) } },
    _count: true,
  });
  if (dupes.some((d) => d._count > 1)) fail("duplicate slugs in AiModel");

  const parsed = parseKiePayloadJson(
    JSON.stringify({
      model: "test/model",
      input: {
        prompt: "test",
        aspect_ratio: "1:1",
        resolution: "1K",
        image_urls: ["https://example.com/a.jpg"],
        input_image: "https://example.com/b.jpg",
        callBackUrl: "https://example.com/cb",
      },
    }),
  );
  if (!parsed.ok) fail(`parseKiePayloadJson: ${parsed.error}`);
  const detected = detectFieldsFromKieInput(parsed.input);
  for (const f of ["prompt", "aspect_ratio", "resolution", "image_urls", "callBackUrl", "input_image"]) {
    if (!detected.detectedFields.includes(f)) fail(`detectFields missing ${f}`);
  }
  if (!detected.supportsImageInput) fail("supportsImageInput not inferred");

  const WIZARD_TEST_SLUG = "kie-import-wizard-verify-test";
  await prisma.aiModel.deleteMany({ where: { slug: WIZARD_TEST_SLUG } });
  const wizardPayload = parseKiePayloadJson(
    JSON.stringify({
      model: "verify/test-model",
      input: { prompt: "verify", aspect_ratio: "1:1", resolution: "1K" },
    }),
  );
  if (!wizardPayload.ok) fail("wizard payload parse");
  const wizardDetected = detectFieldsFromKieInput(wizardPayload.input);
  const wizardMeta = buildImportMetadata({
    rawPayloadExample: wizardPayload.parsed,
    detectedFields: wizardDetected.detectedFields,
    docsUrl: "https://docs.kie.ai/market/verify-test",
  });
  const wizard = await prisma.aiModel.create({
    data: {
      name: "Kie Import Wizard Verify Test",
      slug: WIZARD_TEST_SLUG,
      provider: "KIE_AI",
      type: "IMAGE",
      scope: "GENERAL",
      productCardModelType: null,
      apiModelId: "verify/test-model",
      endpoint: "/api/v1/jobs/createTask",
      statusEndpoint: null,
      costCredits: 1,
      isActive: false,
      isPublic: false,
      supportsImageInput: wizardDetected.supportsImageInput,
      supportsVideoInput: wizardDetected.supportsVideoInput,
      supportsNegativePrompt: wizardDetected.supportsNegativePrompt,
      supportsSeed: wizardDetected.supportsSeed,
      settingsSchema: wizardDetected.settingsSchema as Prisma.InputJsonValue,
      payloadMapping: wizardDetected.payloadMapping as Prisma.InputJsonValue,
      pricingSchema: buildFixedPricingSchema(1) as Prisma.InputJsonValue,
      metadata: wizardMeta as Prisma.InputJsonValue,
    },
  });
  if (!wizard.isActive) {
    const meta = wizard.metadata as Record<string, unknown> | null;
    if (!meta?.rawPayloadExample) fail("wizard model missing rawPayloadExample");
  }
  await prisma.aiModel.delete({ where: { id: wizard.id } });

  const marketplaceStub = await prisma.aiModel.findUnique({
    where: { slug: "product-marketplace-card-kie" },
  });
  if (!marketplaceStub) fail("product-marketplace-card-kie missing for dry-run");

  const genBefore = await prisma.generation.count();
  const txBefore = await prisma.creditTransaction.count();

  const dryWarnings = collectModelDryRunWarnings(marketplaceStub);
  if (!dryWarnings.some((w) => w.includes("PLACEHOLDER"))) {
    fail("dry-run: expected PLACEHOLDER warning for marketplace stub");
  }
  if (!dryWarnings.some((w) => w.includes("inactive"))) {
    fail("dry-run: expected inactive warning for marketplace stub");
  }

  const dryRun = await buildDryRunKiePayloadForModel(marketplaceStub);
  if (dryRun.ok) {
    if (!dryRun.payload || typeof dryRun.payload !== "object") {
      fail("dry-run payload empty");
    }
  } else {
    console.log(
      `  dry-run build note (placeholder stub): ${dryRun.error}`,
    );
  }

  const genAfter = await prisma.generation.count();
  const txAfter = await prisma.creditTransaction.count();
  if (genAfter !== genBefore) fail("dry-run must not create Generation");
  if (txAfter !== txBefore) fail("dry-run must not create CreditTransaction");

  const overview = await getProductCardModelSetupOverview();
  if (overview.slots.length !== 4) fail(`setup slots=${overview.slots.length}`);

  console.log("[verify:product-card-model-setup] OK");
  for (const s of overview.slots) {
    console.log(
      `  ${s.label}: ${s.readinessStatus} (${s.status}) slug=${s.assignedSlug || "—"}`,
    );
  }
  console.log(`  dry-run marketplace warnings: ${dryWarnings.join(", ")}`);
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
