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
  collectGptImage2ResolutionWarnings,
  collectModelDryRunWarnings,
  isCriticalModelDryRunWarning,
  validateDryRunPayloadShape,
} from "../src/server/services/adminModelPayloadDryRun";
import { defaultSlugForProductCardType, getProductCardSettings } from "../src/server/services/productCardSettings";

const MARKETPLACE_MODEL_SLUG = "gpt-image-2-product-marketplace-card";
const MARKETPLACE_APP_SETTING_KEY = "PRODUCT_CARD_DEFAULT_MARKETPLACE_CARD_MODEL_SLUG";

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

  const marketplaceModel = await prisma.aiModel.findUnique({
    where: { slug: MARKETPLACE_MODEL_SLUG },
  });
  if (!marketplaceModel) {
    fail(`missing configured marketplace model ${MARKETPLACE_MODEL_SLUG}`);
  }
  if (marketplaceModel.scope !== "PRODUCT_CARD") {
    fail(`${MARKETPLACE_MODEL_SLUG}: scope=${marketplaceModel.scope}`);
  }
  if (marketplaceModel.productCardModelType !== "PRODUCT_MARKETPLACE_CARD") {
    fail(
      `${MARKETPLACE_MODEL_SLUG}: productCardModelType=${marketplaceModel.productCardModelType}`,
    );
  }
  if (marketplaceModel.type !== "IMAGE") {
    fail(`${MARKETPLACE_MODEL_SLUG}: type=${marketplaceModel.type}`);
  }
  if (!marketplaceModel.isActive) {
    fail(`${MARKETPLACE_MODEL_SLUG}: must be active`);
  }
  if (marketplaceModel.isPublic) {
    fail(`${MARKETPLACE_MODEL_SLUG}: must stay non-public`);
  }
  if (!marketplaceModel.supportsImageInput) {
    fail(`${MARKETPLACE_MODEL_SLUG}: supportsImageInput=false`);
  }
  if (marketplaceModel.apiModelId !== "gpt-image-2-image-to-image") {
    fail(`${MARKETPLACE_MODEL_SLUG}: apiModelId=${marketplaceModel.apiModelId}`);
  }
  if (marketplaceModel.endpoint !== "/api/v1/jobs/createTask") {
    fail(`${MARKETPLACE_MODEL_SLUG}: endpoint=${marketplaceModel.endpoint}`);
  }
  if (marketplaceModel.statusEndpoint !== "/api/v1/jobs/recordInfo") {
    fail(`${MARKETPLACE_MODEL_SLUG}: statusEndpoint=${marketplaceModel.statusEndpoint}`);
  }
  if (marketplaceModel.costCredits !== 12) {
    fail(`${MARKETPLACE_MODEL_SLUG}: costCredits=${marketplaceModel.costCredits}`);
  }
  const ps = marketplaceModel.pricingSchema as Record<string, unknown> | null;
  if (!ps || ps.type !== "fixed" || ps.credits !== 12) {
    fail(`${MARKETPLACE_MODEL_SLUG}: pricingSchema invalid`);
  }
  const pm = marketplaceModel.payloadMapping as Record<string, unknown> | null;
  if (!pm || !pm.input || typeof pm.input !== "object") {
    fail(`${MARKETPLACE_MODEL_SLUG}: payloadMapping.input missing`);
  }
  const pmInput = pm.input as Record<string, unknown>;
  if (pmInput.input_urls !== "$inputFiles") {
    fail(`${MARKETPLACE_MODEL_SLUG}: payloadMapping input_urls must map to $inputFiles`);
  }

  const assignedSetting = await prisma.appSetting.findUnique({
    where: { key: MARKETPLACE_APP_SETTING_KEY },
  });
  const assignedSlug =
    typeof assignedSetting?.value === "string"
      ? assignedSetting.value
      : String(assignedSetting?.value ?? "");
  if (assignedSlug !== MARKETPLACE_MODEL_SLUG) {
    fail(
      `${MARKETPLACE_APP_SETTING_KEY}=${assignedSlug || "empty"}, expected ${MARKETPLACE_MODEL_SLUG}`,
    );
  }

  const pcSettings = await getProductCardSettings();
  if (pcSettings.marketplaceCardModelSlug !== MARKETPLACE_MODEL_SLUG) {
    fail(
      `getProductCardSettings marketplaceCardModelSlug=${pcSettings.marketplaceCardModelSlug}`,
    );
  }
  const defaultSlug = defaultSlugForProductCardType(
    pcSettings,
    "PRODUCT_MARKETPLACE_CARD",
  );
  if (defaultSlug !== MARKETPLACE_MODEL_SLUG) {
    fail(`defaultSlugForProductCardType=${defaultSlug}`);
  }

  const marketplaceDryRun = await buildDryRunKiePayloadForModel(marketplaceModel);
  if (!marketplaceDryRun.ok) {
    fail(`marketplace dry-run failed: ${marketplaceDryRun.error}`);
  }
  const marketplaceCritical = marketplaceDryRun.warnings.filter(
    isCriticalModelDryRunWarning,
  );
  if (marketplaceCritical.length > 0) {
    fail(`marketplace dry-run critical warnings: ${marketplaceCritical.join("; ")}`);
  }
  const payloadInput = (marketplaceDryRun.payload as { input?: Record<string, unknown> })
    .input;
  if (!payloadInput || !Array.isArray(payloadInput.input_urls)) {
    fail("marketplace dry-run payload input.input_urls is not an array");
  }
  if (!String(payloadInput.prompt ?? "").trim()) {
    fail("marketplace dry-run payload missing input.prompt");
  }
  const shapeWarnings = validateDryRunPayloadShape(
    marketplaceDryRun.payload,
    marketplaceModel,
  );
  const shapeCritical = shapeWarnings.filter(isCriticalModelDryRunWarning);
  if (shapeCritical.length > 0) {
    fail(`marketplace payload shape: ${shapeCritical.join("; ")}`);
  }

  const gptBad = collectGptImage2ResolutionWarnings(
    marketplaceModel.apiModelId,
    { aspectRatio: "1:1", resolution: "4K" },
  );
  if (!gptBad.some((w) => w.includes("1:1 does not support 4K"))) {
    fail("GPT Image 2 resolution rule: 1:1 + 4K warning missing");
  }
  const gptAutoBad = collectGptImage2ResolutionWarnings(
    marketplaceModel.apiModelId,
    { aspectRatio: "auto", resolution: "2K" },
  );
  if (!gptAutoBad.some((w) => w.includes("auto aspect_ratio"))) {
    fail("GPT Image 2 resolution rule: auto + 2K warning missing");
  }

  const overview = await getProductCardModelSetupOverview();
  if (overview.slots.length !== 4) fail(`setup slots=${overview.slots.length}`);

  const marketplaceSlot = overview.byType.PRODUCT_MARKETPLACE_CARD;
  if (!marketplaceSlot) fail("marketplace slot missing");
  if (marketplaceSlot.readinessStatus !== "Ready") {
    fail(
      `marketplace slot readiness=${marketplaceSlot.readinessStatus} issues=${marketplaceSlot.readinessIssues.join(", ")}`,
    );
  }
  if (!marketplaceSlot.generationReady) {
    fail("marketplace slot generationReady=false");
  }

  console.log("[verify:product-card-model-setup] OK");
  for (const s of overview.slots) {
    console.log(
      `  ${s.label}: ${s.readinessStatus} (${s.status}) slug=${s.assignedSlug || "—"}`,
    );
  }
  console.log(`  dry-run marketplace stub warnings: ${dryWarnings.join(", ")}`);
  console.log(
    `  marketplace model ${MARKETPLACE_MODEL_SLUG}: active, dry-run OK, input_urls array confirmed`,
  );
  console.log(`  ${MARKETPLACE_APP_SETTING_KEY}=${assignedSlug}`);
  console.log(`  marketplace slot: ${marketplaceSlot.readinessStatus}`);
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
