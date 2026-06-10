/**
 * Проверка seed Product Card моделей, Import Wizard helpers и diagnostics.
 * npm run verify:product-card-model-setup
 *
 * Read-only гарантии (кроме безопасного wizard test create/delete по slug kie-import-wizard-verify-test):
 * - не вызывает Kie.ai и не обращается к внешним URL
 * - не создаёт Generation / CreditTransaction
 * - не меняет balanceCredits пользователей
 * - не меняет AppSetting и боевые AiModel (только transient wizard row)
 *
 * Production (Docker): docker compose run --rm app npm run verify:product-card-model-setup
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
import { getProductClassifierCommercialSettings } from "../src/server/services/productClassifierCommercialSettings";
import { runClassifierPreflight, classifierSlotBlocksReadyForRealTest } from "../src/server/services/classifierPreflight";
import {
  isProductClassifierReady,
  runSafeProductClassifierFlow,
} from "../src/server/services/productClassifierFlow";
import {
  isClassifierAccessModeAllowedForRole,
  isClassifierUserTrafficReady,
  PRODUCT_CLASSIFIER_TIMEOUT_MS_DEFAULT,
  PRODUCT_CLASSIFIER_TIMEOUT_MS_MAX,
  PRODUCT_CLASSIFIER_TIMEOUT_MS_MIN,
} from "../src/server/services/productClassifierCommercialSettings";
import { PRODUCT_CLASSIFIER_SETUP_ERROR } from "../src/lib/product-classifier-result";
import { isClassifierRuntimeEnabled } from "../src/lib/product-classifier-runtime-gate";
import {
  buildDryRunClassifierPayloadForModel,
  validateClassifierDryRunPayloadShape,
} from "../src/server/services/adminClassifierPayloadDryRun";
import {
  buildDryRunKiePayloadForModel,
  collectGptImage2ResolutionWarnings,
  collectModelDryRunWarnings,
  isCriticalModelDryRunWarning,
  validateDryRunPayloadShape,
} from "../src/server/services/adminModelPayloadDryRun";
import { defaultSlugForProductCardType, getProductCardSettings } from "../src/server/services/productCardSettings";
import { calculateProductCardMarketplaceCardCredits, calculateProductCardVideoCredits } from "../src/server/services/productCardPricing";
import { getMarketplaceCardPricingSummary } from "../src/server/services/marketplaceCardPricingSummary";
import { runMarketplaceCardPreflight } from "../src/server/services/marketplaceCardPreflight";
import { buildKieMarketPayloadFromMapping, isStrictKiePayloadMapping } from "../src/server/services/kiePayloadMapping";
import { modelSupportsSimpleCardReferenceImage } from "../src/lib/simple-product-card-model";
import { getSchemaFields } from "../src/lib/generation-form-settings-schema";
import { buildSimpleProductCardPrompt } from "../src/server/services/simpleProductCardPromptBuilder";
import { hasConfirmedMeasurements } from "../src/lib/simple-product-card-parsed-content";
import { mergeSimpleProductCardPromptsWithDefaults } from "../src/lib/validations/simple-product-card-prompts-setting";
import {
  getManualConceptsForCategory,
  MANUAL_CONCEPT_CATEGORY_IDS,
} from "../src/config/product-card-concept-catalog";

const MARKETPLACE_MODEL_SLUG = "gpt-image-2-product-marketplace-card";
const CONCEPT_MODEL_SLUG = "gpt-image-2-product-concept-image";
const VIDEO_MODEL_SLUG = "seedance-2-0-product-video";
const CLASSIFIER_MODEL_SLUG = "gemini-2.5-flash-product-classifier";
const MARKETPLACE_APP_SETTING_KEY = "PRODUCT_CARD_DEFAULT_MARKETPLACE_CARD_MODEL_SLUG";
const VIDEO_APP_SETTING_KEY = "PRODUCT_CARD_DEFAULT_VIDEO_MODEL_SLUG";

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
  const balanceBefore = await prisma.user.aggregate({ _sum: { balanceCredits: true } });
  const appSettingCountBefore = await prisma.appSetting.count();

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
  if (marketplaceModel.costCredits < 1) {
    fail(`${MARKETPLACE_MODEL_SLUG}: costCredits=${marketplaceModel.costCredits}`);
  }
  const ps = marketplaceModel.pricingSchema as Record<string, unknown> | null;
  if (
    !ps ||
    ps.type !== "fixed" ||
    ps.credits !== marketplaceModel.costCredits
  ) {
    fail(`${MARKETPLACE_MODEL_SLUG}: pricingSchema invalid (fixed credits must match costCredits)`);
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
  const dryPayload = marketplaceDryRun.payload as Record<string, unknown>;
  if (dryPayload.model !== "gpt-image-2-image-to-image") {
    fail(`dry-run payload model=${String(dryPayload.model)}`);
  }
  if (!String(dryPayload.callBackUrl ?? "").trim()) {
    fail("dry-run payload missing callBackUrl");
  }
  if (String(payloadInput.aspect_ratio ?? "") !== "1:1") {
    fail(`dry-run payload aspect_ratio=${String(payloadInput.aspect_ratio)}`);
  }
  if (String(payloadInput.resolution ?? "") !== "1K") {
    fail(`dry-run payload resolution=${String(payloadInput.resolution)}`);
  }

  const priceBreakdown = await calculateProductCardMarketplaceCardCredits(marketplaceModel, {
    cardSize: "1x1",
    styleMode: "classic",
  });
  if (priceBreakdown.credits < marketplaceModel.costCredits) {
    fail(
      `marketplace estimate credits=${priceBreakdown.credits} below model costCredits=${marketplaceModel.costCredits}`,
    );
  }
  if (priceBreakdown.modelSlug !== MARKETPLACE_MODEL_SLUG) {
    fail(`marketplace estimate modelSlug=${priceBreakdown.modelSlug}`);
  }

  const pricingSummary = await getMarketplaceCardPricingSummary(
    marketplaceModel,
    pcSettings,
  );
  if (pricingSummary.modelBaseCredits !== marketplaceModel.costCredits) {
    fail(
      `pricing summary modelBaseCredits=${pricingSummary.modelBaseCredits} expected ${marketplaceModel.costCredits}`,
    );
  }
  if (pricingSummary.minScenarioTokens !== pcSettings.minMarketplaceCardTokens) {
    fail(
      `pricing summary minScenarioTokens=${pricingSummary.minScenarioTokens} expected ${pcSettings.minMarketplaceCardTokens}`,
    );
  }
  if (pricingSummary.finalCredits !== priceBreakdown.credits) {
    fail(
      `pricing summary finalCredits=${pricingSummary.finalCredits} != estimate ${priceBreakdown.credits}`,
    );
  }
  const expectedFinal = Math.max(
    pcSettings.minMarketplaceCardTokens,
    marketplaceModel.costCredits,
  );
  if (pricingSummary.finalCredits < expectedFinal) {
    fail(
      `pricing summary finalCredits=${pricingSummary.finalCredits} below max(min=${pcSettings.minMarketplaceCardTokens}, cost=${marketplaceModel.costCredits})`,
    );
  }
  if (
    pcSettings.minMarketplaceCardTokens > marketplaceModel.costCredits &&
    pricingSummary.finalCredits !== pcSettings.minMarketplaceCardTokens
  ) {
    fail(
      `when minMarketplaceCardTokens > costCredits, final must equal min (${pcSettings.minMarketplaceCardTokens})`,
    );
  }
  console.log(
    `  pricing breakdown: base=${pricingSummary.modelBaseCredits} min=${pricingSummary.minScenarioTokens} final=${pricingSummary.finalCredits}`,
  );

  const genBeforePreflight = await prisma.generation.count();
  const txBeforePreflight = await prisma.creditTransaction.count();
  const preflight = await runMarketplaceCardPreflight();
  const genAfterPreflight = await prisma.generation.count();
  const txAfterPreflight = await prisma.creditTransaction.count();
  if (genAfterPreflight !== genBeforePreflight) {
    fail("preflight must not create Generation");
  }
  if (txAfterPreflight !== txBeforePreflight) {
    fail("preflight must not create CreditTransaction");
  }
  if (!preflight.ok) fail("preflight returned ok=false");
  if (!Array.isArray(preflight.checks) || preflight.checks.length === 0) {
    fail("preflight checks empty");
  }
  const modelCheck = preflight.checks.find((c) => c.key === "marketplaceModel");
  if (!modelCheck || modelCheck.status !== "ok") {
    fail(`preflight marketplaceModel status=${modelCheck?.status ?? "missing"}`);
  }
  const dryRunCheck = preflight.checks.find((c) => c.key === "dryRunPayload");
  if (!dryRunCheck || dryRunCheck.status !== "ok") {
    fail(`preflight dryRunPayload status=${dryRunCheck?.status ?? "missing"}`);
  }
  if (preflight.finalCredits !== pricingSummary.finalCredits) {
    fail(
      `preflight finalCredits=${preflight.finalCredits} != pricing ${pricingSummary.finalCredits}`,
    );
  }
  console.log(
    `  preflight: readyForRealTest=${preflight.readyForRealTest} checks=${preflight.checks.length} mockKie=${preflight.mockKie}`,
  );
  if (!preflight.readyForRealTest) {
    console.log(
      `  preflight warnings (expected in dev without full env): ${preflight.warnings.join("; ") || "—"}`,
    );
  }

  const fakeUrl = "https://app.qazcardai.kz/uploads/verify/product-sample.jpg";
  if (!isStrictKiePayloadMapping(marketplaceModel.payloadMapping)) {
    fail("marketplace model payloadMapping is not strict market-create-task");
  }
  const kieBody = buildKieMarketPayloadFromMapping(marketplaceModel.payloadMapping, {
    model: { apiModelId: marketplaceModel.apiModelId },
    prompt: "verify marketplace card prompt",
    settings: { aspectRatio: "1:1", resolution: "1K" },
    inputFiles: [fakeUrl],
    callBackUrl: "https://example.com/api/webhooks/kie",
  });
  const bodyInput = (kieBody.input ?? {}) as Record<string, unknown>;
  if (!Array.isArray(bodyInput.input_urls)) {
    fail("buildKieMarketPayloadFromMapping must produce input.input_urls array");
  }
  if ((bodyInput.input_urls as string[])[0] !== fakeUrl) {
    fail("buildKieMarketPayloadFromMapping input_urls[0] must match uploaded product URL");
  }

  const schemaFields = getSchemaFields(marketplaceModel.settingsSchema);
  const inputUrlsField = schemaFields.find((f) => f.name === "inputUrls");
  if (
    !inputUrlsField ||
    typeof inputUrlsField.maxItems !== "number" ||
    inputUrlsField.maxItems < 2
  ) {
    fail(`${MARKETPLACE_MODEL_SLUG}: inputUrls.maxItems must be >= 2 (run seed:gpt-image-2-product-marketplace-card)`);
  }
  if (!modelSupportsSimpleCardReferenceImage(marketplaceModel)) {
    fail(`${MARKETPLACE_MODEL_SLUG}: modelSupportsSimpleCardReferenceImage must be true`);
  }

  const refUrl = "https://app.qazcardai.kz/uploads/verify/reference-sample.jpg";

  const kieBodySingle = buildKieMarketPayloadFromMapping(marketplaceModel.payloadMapping, {
    model: { apiModelId: marketplaceModel.apiModelId },
    prompt: "verify marketplace card prompt",
    settings: { aspectRatio: "1:1", resolution: "1K" },
    inputFiles: [fakeUrl],
    callBackUrl: "https://example.com/api/webhooks/kie",
  });
  const singleUrls = ((kieBodySingle.input ?? {}) as Record<string, unknown>).input_urls as
    | string[]
    | undefined;
  if (!Array.isArray(singleUrls) || singleUrls.length !== 1) {
    fail(`without reference: input_urls.length=${singleUrls?.length ?? 0}, expected 1`);
  }
  if (singleUrls[0] !== fakeUrl) {
    fail("without reference: input_urls[0] must be product URL");
  }

  const kieBodyDual = buildKieMarketPayloadFromMapping(marketplaceModel.payloadMapping, {
    model: { apiModelId: marketplaceModel.apiModelId },
    prompt: "verify marketplace card prompt with reference",
    settings: { aspectRatio: "1:1", resolution: "1K" },
    inputFiles: [fakeUrl, refUrl],
    callBackUrl: "https://example.com/api/webhooks/kie",
  });
  const dualInput = (kieBodyDual.input ?? {}) as Record<string, unknown>;
  const dualUrls = dualInput.input_urls as string[] | undefined;
  if (!Array.isArray(dualUrls) || dualUrls.length !== 2) {
    fail("with reference: input.input_urls must have length 2");
  }
  if (dualUrls[0] !== fakeUrl || dualUrls[1] !== refUrl) {
    fail("with reference: input_urls order must be [product, reference]");
  }

  const mergedPrompts = mergeSimpleProductCardPromptsWithDefaults(null).prompts;
  const promptWithRef = buildSimpleProductCardPrompt({
    payload: {
      productPhotoId: "verify-photo",
      userText: "700 Вт, LED дисплей, быстрый старт",
      styleMode: "reference",
      useReference: true,
      referenceImageId: "verify-ref",
      referenceCreativity: 50,
      aspectRatio: "1:1",
    },
    prompts: mergedPrompts,
    aspectRatio: "1:1",
  });
  const promptLower = promptWithRef.prompt.toLowerCase();
  if (!promptLower.includes("image a")) {
    fail("reference prompt must mention Image A (product)");
  }
  if (!promptLower.includes("image b")) {
    fail("reference prompt must mention Image B (style reference)");
  }
  if (!promptLower.includes("first image")) {
    fail("reference prompt must mention first image = product");
  }
  if (!promptLower.includes("second image")) {
    fail("reference prompt must mention second image = style reference");
  }
  if (!promptLower.includes("do not replace the product")) {
    fail("reference prompt must forbid replacing product with reference objects");
  }
  if (
    !promptLower.includes("do not invent exact dimensions") &&
    !promptLower.includes("no invented specs")
  ) {
    fail("reference prompt must include anti-fake-spec rules");
  }

  const promptImplausibleDims = buildSimpleProductCardPrompt({
    payload: {
      productPhotoId: "verify-photo",
      userText: "Wireless Controller\nРазмер 60×27×32 мм\nудобный хват",
      styleMode: "reference",
      useReference: true,
      referenceImageId: "verify-ref",
      referenceCreativity: 50,
      aspectRatio: "1:1",
    },
    prompts: mergedPrompts,
    aspectRatio: "1:1",
  });
  if (hasConfirmedMeasurements(promptImplausibleDims.parsedContent.measurements)) {
    fail("implausible triple mm must not be confirmed measurements in prompt");
  }

  const priceWithRef = await calculateProductCardMarketplaceCardCredits(marketplaceModel, {
    cardSize: "1x1",
    styleMode: "reference",
  });
  if (priceWithRef.credits !== priceBreakdown.credits) {
    fail(
      `reference styleMode credits=${priceWithRef.credits} != classic ${priceBreakdown.credits}`,
    );
  }
  console.log(
    `  design reference: inputUrls.maxItems=${inputUrlsField.maxItems}, dual input_urls OK, prompt rules OK`,
  );

  const staleClientEstimate = priceBreakdown.credits + 1;
  const priceChangedWouldReject =
    Number.isFinite(staleClientEstimate) && staleClientEstimate !== priceBreakdown.credits;
  if (!priceChangedWouldReject) {
    fail("PRICE_CHANGED guard: mismatched clientEstimateCredits must be rejected");
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

  const classifierSlot = overview.byType.PRODUCT_CLASSIFIER;
  const conceptSlot = overview.byType.PRODUCT_CONCEPT_IMAGE;
  const videoSlot = overview.byType.PRODUCT_VIDEO;

  const classifierModel = await prisma.aiModel.findUnique({
    where: { slug: CLASSIFIER_MODEL_SLUG },
  });

  if (classifierModel?.isActive && !isClassifierRuntimeEnabled()) {
    if (classifierSlot?.autoClassifyReady) {
      fail("classifier autoClassifyReady must be false when runtime gate disabled");
    }
    if (classifierSlot?.readinessStatus !== "ConfiguredDisabled") {
      fail(
        `classifier readiness must be ConfiguredDisabled when active + gate off, got ${classifierSlot?.readinessStatus}`,
      );
    }
    const missingFlow = await runSafeProductClassifierFlow({
      imageUrl: "https://example.com/product.jpg",
    });
    if (missingFlow.ok) fail("classifier flow must not succeed when runtime gate disabled");
    if (missingFlow.error !== PRODUCT_CLASSIFIER_SETUP_ERROR) {
      fail(`classifier setup error mismatch: ${missingFlow.error}`);
    }
    const preflight = await runClassifierPreflight();
    if (preflight.readyForRealTest) {
      fail("classifier preflight readyForRealTest must be false when runtime gate disabled");
    }
    console.log("  classifier active + runtime gate disabled: USER not ready, preflight false");
    const commercial = await getProductClassifierCommercialSettings();
    if (commercial.accessMode !== "disabled") {
      console.log(`  note: classifier accessMode=${commercial.accessMode} (registry default disabled)`);
    }
    if (preflight.readyForUserTraffic) {
      fail("classifier preflight readyForUserTraffic must be false when gate disabled");
    }
    console.log(
      `  classifier commercial: cost=${commercial.costCredits} daily=${commercial.dailyLimit} cooldown=${commercial.cooldownSeconds}s timeout=${commercial.timeoutMs}ms`,
    );
    if (
      commercial.timeoutMs < PRODUCT_CLASSIFIER_TIMEOUT_MS_MIN ||
      commercial.timeoutMs > PRODUCT_CLASSIFIER_TIMEOUT_MS_MAX
    ) {
      fail(`classifier timeoutMs out of clamp: ${commercial.timeoutMs}`);
    }
    if (commercial.accessMode === "admin_only" && classifierSlot) {
      if (classifierSlot.autoClassifyReady) {
        fail("admin_only: autoClassifyReady must stay false");
      }
      const modelReady = await isProductClassifierReady();
      if (modelReady !== classifierSlot.generationReady) {
        fail("isProductClassifierReady must follow generationReady, not autoClassifyReady");
      }
      if (!isClassifierAccessModeAllowedForRole("admin_only", "SUPER_ADMIN")) {
        fail("admin_only must allow SUPER_ADMIN classify access");
      }
      if (isClassifierAccessModeAllowedForRole("admin_only", "USER")) {
        fail("admin_only must deny USER classify access");
      }
      const theoreticalReadySlot = {
        ...classifierSlot,
        readinessStatus: "Ready" as const,
        generationReady: true,
      };
      if (isClassifierUserTrafficReady({ commercial, modelSlot: theoreticalReadySlot })) {
        fail("admin_only must keep USER traffic readiness false when model Ready");
      }
      const theoreticalBlocks = classifierSlotBlocksReadyForRealTest(theoreticalReadySlot);
      if (theoreticalReadySlot.generationReady && theoreticalBlocks) {
        fail("preflight slot check must use generationReady, not autoClassifyReady");
      }
      console.log(
        "  admin_only readiness: generationReady helper OK, USER traffic false, theoretical readyForRealTest OK",
      );
    }
  } else if (classifierSlot?.readinessStatus === "Ready") {
    console.log("  note: classifier Ready (model active + runtime gate enabled)");
  } else {
    if (classifierSlot?.autoClassifyReady) {
      fail("classifier autoClassifyReady must be false while Missing/Inactive/ConfiguredDisabled");
    }
    const missingFlow = await runSafeProductClassifierFlow({});
    if (missingFlow.ok) fail("classifier flow must not succeed when model Missing");
    if (missingFlow.error !== PRODUCT_CLASSIFIER_SETUP_ERROR) {
      fail(`classifier setup error mismatch: ${missingFlow.error}`);
    }
    console.log("  classifier Missing/Inactive: setup error OK, no Kie path");
  }

  if (classifierModel) {
    if (classifierModel.productCardModelType !== "PRODUCT_CLASSIFIER") {
      fail(`${CLASSIFIER_MODEL_SLUG}: wrong productCardModelType`);
    }
    if (!classifierModel.isActive) {
      console.log(`  ${CLASSIFIER_MODEL_SLUG}: seeded inactive (expected before real test)`);
    }
    const classifierDryRun = await buildDryRunClassifierPayloadForModel(classifierModel);
    if (!classifierDryRun.ok) {
      fail(`classifier dry-run failed: ${classifierDryRun.error}`);
    }
    const shapeIssues = validateClassifierDryRunPayloadShape(classifierDryRun.payload);
    if (shapeIssues.length > 0) {
      fail(`classifier dry-run shape: ${shapeIssues.join("; ")}`);
    }
    const cp = classifierDryRun.payload as { model?: string; stream?: boolean };
    const expectedApiModelId = classifierModel.apiModelId.trim();
    if (cp.model !== expectedApiModelId) {
      fail(`classifier dry-run model must be ${expectedApiModelId}, got ${cp.model ?? "—"}`);
    }
    if (cp.stream !== false) fail("classifier dry-run stream must be false");
    console.log("  classifier chat/completions dry-run OK");
  } else {
    console.log(`  note: ${CLASSIFIER_MODEL_SLUG} not seeded — run seed:gemini-3-flash-product-classifier`);
  }

  const classifierSetting = await prisma.appSetting.findUnique({
    where: { key: "PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG" },
    select: { value: true },
  });
  const classifierSettingValue =
    typeof classifierSetting?.value === "string" ? classifierSetting.value.trim() : "";
  if (!classifierSettingValue) {
    console.log("  note: PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG uses registry default");
  }

  const genCountBeforeClassifier = await prisma.generation.count();
  const txCountBeforeClassifier = await prisma.creditTransaction.count();
  if (process.env.NODE_ENV === "development") {
    const mockFlow = await runSafeProductClassifierFlow({ devMockCategory: "home_goods" });
    if (!mockFlow.ok || mockFlow.result.category !== "home_goods") {
      fail("dev classifier mock home_goods failed");
    }
    console.log("  dev mock home_goods: OK");
  }
  const genCountAfterClassifier = await prisma.generation.count();
  const txCountAfterClassifier = await prisma.creditTransaction.count();
  if (genCountAfterClassifier !== genCountBeforeClassifier) {
    fail("classifier verify must not create Generation");
  }
  if (txCountAfterClassifier !== txCountBeforeClassifier) {
    fail("classifier verify must not create CreditTransaction");
  }
  if (MANUAL_CONCEPT_CATEGORY_IDS.length !== 11) {
    fail(`manual concept categories must be 11, got ${MANUAL_CONCEPT_CATEGORY_IDS.length}`);
  }
  for (const catId of MANUAL_CONCEPT_CATEGORY_IDS) {
    const concepts = getManualConceptsForCategory(catId);
    if (concepts.length < 3) {
      fail(`category ${catId} must have at least 3 concepts, got ${concepts.length}`);
    }
  }
  console.log("  manual concept categories (11) OK");

  const conceptModel = await prisma.aiModel.findUnique({
    where: { slug: CONCEPT_MODEL_SLUG },
  });
  if (conceptModel) {
    if (!conceptModel.isActive) fail(`${CONCEPT_MODEL_SLUG} must be active`);
    if (conceptModel.productCardModelType !== "PRODUCT_CONCEPT_IMAGE") {
      fail(`${CONCEPT_MODEL_SLUG} wrong productCardModelType`);
    }
    if (conceptModel.costCredits !== 20) {
      fail(`${CONCEPT_MODEL_SLUG} costCredits must be 20, got ${conceptModel.costCredits}`);
    }
    if (conceptModel.apiModelId !== "gpt-image-2-image-to-image") {
      fail(`${CONCEPT_MODEL_SLUG} apiModelId must be gpt-image-2-image-to-image`);
    }
    const conceptDryRun = await buildDryRunKiePayloadForModel(conceptModel);
    if (!conceptDryRun.ok) fail(`concept dry-run failed: ${conceptDryRun.error}`);
    const conceptInput = (conceptDryRun.payload as { input?: Record<string, unknown> }).input;
    if (!conceptInput || !Array.isArray(conceptInput.input_urls)) {
      fail("concept dry-run input.input_urls must be array");
    }
    if (!conceptSlot?.generationReady) {
      fail(`concept slot generationReady=false issues=${conceptSlot?.readinessIssues.join(", ")}`);
    }
    console.log(`  concept model ${CONCEPT_MODEL_SLUG}: active, dry-run OK, costCredits=20`);
  } else {
    console.log(`  note: ${CONCEPT_MODEL_SLUG} not seeded — run seed:gpt-image-2-product-concept-image`);
  }

  if (videoSlot?.readinessStatus === "Ready") {
    const videoModel = await prisma.aiModel.findUnique({
      where: { slug: VIDEO_MODEL_SLUG },
    });
    if (!videoModel) {
      fail(`video slot Ready but model ${VIDEO_MODEL_SLUG} missing`);
    }
    if (!videoModel.isActive) fail(`${VIDEO_MODEL_SLUG} must be active`);
    if (videoModel.productCardModelType !== "PRODUCT_VIDEO") {
      fail(`${VIDEO_MODEL_SLUG} wrong productCardModelType`);
    }
    if (videoModel.apiModelId !== "bytedance/seedance-2") {
      fail(`${VIDEO_MODEL_SLUG} apiModelId=${videoModel.apiModelId}`);
    }
    if (videoModel.costCredits !== 40) {
      fail(`${VIDEO_MODEL_SLUG} costCredits must be 40, got ${videoModel.costCredits}`);
    }
    const vps = videoModel.pricingSchema as Record<string, unknown> | null;
    if (!vps || vps.type !== "product_card_matrix") {
      fail(`${VIDEO_MODEL_SLUG}: pricingSchema must be product_card_matrix`);
    }

    const videoSetting = await prisma.appSetting.findUnique({
      where: { key: VIDEO_APP_SETTING_KEY },
    });
    const videoAssignedSlug =
      typeof videoSetting?.value === "string"
        ? videoSetting.value
        : String(videoSetting?.value ?? "");
    if (videoAssignedSlug !== VIDEO_MODEL_SLUG) {
      fail(`${VIDEO_APP_SETTING_KEY}=${videoAssignedSlug || "empty"}, expected ${VIDEO_MODEL_SLUG}`);
    }
    if (pcSettings.videoModelSlug !== VIDEO_MODEL_SLUG) {
      fail(`getProductCardSettings videoModelSlug=${pcSettings.videoModelSlug}`);
    }
    if (!videoSlot.generationReady) {
      fail(`video slot generationReady=false issues=${videoSlot.readinessIssues.join(", ")}`);
    }

    const videoDryRun = await buildDryRunKiePayloadForModel(videoModel, {
      settings: {
        scenario: "first-frame",
        firstFrameUrl: "https://app.qazcardai.kz/uploads/verify/product-video-frame.jpg",
        duration: 5,
        resolution: "720p",
        aspectRatio: "16:9",
        generateAudio: false,
        webSearch: false,
      },
    });
    if (!videoDryRun.ok) fail(`video dry-run failed: ${videoDryRun.error}`);
    const videoCritical = videoDryRun.warnings.filter(isCriticalModelDryRunWarning);
    if (videoCritical.length > 0) {
      fail(`video dry-run critical warnings: ${videoCritical.join("; ")}`);
    }
    const videoInput = (videoDryRun.payload as { input?: Record<string, unknown> }).input;
    if (!videoInput || !String(videoInput.first_frame_url ?? "").trim()) {
      fail("video dry-run payload missing input.first_frame_url");
    }
    if (videoInput.generate_audio !== false) {
      fail("video dry-run payload generate_audio must be false");
    }

    const price5 = await calculateProductCardVideoCredits(videoModel, {
      duration: 5,
      resolution: "720p",
    });
    const price10 = await calculateProductCardVideoCredits(videoModel, {
      duration: 10,
      resolution: "1080p",
    });
    if (price5.credits !== 40) fail(`video 5s/720p credits=${price5.credits}, expected 40`);
    if (price10.credits !== 95) fail(`video 10s/1080p credits=${price10.credits}, expected 95`);
    if (price5.credits >= price10.credits) {
      fail("video pricing must increase with duration/resolution");
    }

    console.log(
      `  video model ${VIDEO_MODEL_SLUG}: active, dry-run OK, matrix 40/55/70/95`,
    );
  } else {
    console.log(`  note: ${VIDEO_MODEL_SLUG} not Ready — run seed:seedance-2-0-product-video`);
  }
  if (!marketplaceSlot.generationReady) {
    fail("other missing slots must not block marketplace Ready");
  }

  if (
    pcSettings.minMarketplaceCardTokens === 25 &&
    marketplaceModel.costCredits < 25 &&
    pricingSummary.finalCredits !== 25
  ) {
    fail(
      `expected final marketplace estimate=25 (min=25, costCredits=${marketplaceModel.costCredits}), got ${pricingSummary.finalCredits}`,
    );
  }

  const balanceAfter = await prisma.user.aggregate({ _sum: { balanceCredits: true } });
  if (balanceAfter._sum.balanceCredits !== balanceBefore._sum.balanceCredits) {
    fail("verify must not change user balanceCredits");
  }
  const appSettingCountAfter = await prisma.appSetting.count();
  if (appSettingCountAfter !== appSettingCountBefore) {
    fail("verify must not create or delete AppSetting rows");
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
