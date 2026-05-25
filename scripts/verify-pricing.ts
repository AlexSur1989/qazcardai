/**
 * Admin pricing hub: card_builder tariffs, token packages helpers, Kaspi/WhatsApp.
 * npm run verify:pricing
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CARD_BUILDER_PRICING_SETTING_KEY,
  cardBuilderPricingApiToStorage,
  cardBuilderPricingPatchSchema,
  cardBuilderPricingSoftWarnings,
  cardBuilderPricingToProductCardShape,
  DEFAULT_CARD_BUILDER_PRICING_API,
  storageToCardBuilderPricingApi,
} from "../src/lib/pricing-admin/card-builder";
import {
  buildWhatsAppTestPreviewUrl,
  kaspiManualApiToStorage,
  kaspiManualPricingPatchSchema,
} from "../src/lib/pricing-admin/kaspi-manual";
import {
  buildProductCardVideoMatrixKey,
  entryForProductCardMatrixKeys,
  pickProductCardPricingKeys,
} from "../src/lib/product-card-matrix-keys";
import {
  buildProductCardVideoMatrixCells,
  productCardVideoMatrixCellsToSchemaMatrix,
  productCardVideoPricingPatchSchema,
  productCardVideoPricingSoftWarnings,
  readMatrixCellCredits,
  validateProductCardVideoPatchCells,
} from "../src/lib/pricing-admin/product-card-video";
import { computeCardBuilderCreditsBeforeMargin } from "../src/lib/card-builder-pricing-math";
import { calculateProductCardVideoCredits } from "../src/server/services/productCardPricing";
import { tokenPackagePriceWarnings } from "@/lib/pricing-admin/token-packages";

function testCardBuilderPatchValidation() {
  const ok = cardBuilderPricingPatchSchema.safeParse(DEFAULT_CARD_BUILDER_PRICING_API);
  assert.ok(ok.success, "default pricing valid");

  const badMult = cardBuilderPricingPatchSchema.safeParse({
    ...DEFAULT_CARD_BUILDER_PRICING_API,
    multipliers: { premiumStyle: 0.5, heavyTextInfographic: 1.1 },
  });
  assert.ok(!badMult.success, "multiplier < 1 rejected");

  const badMax = cardBuilderPricingPatchSchema.safeParse({
    ...DEFAULT_CARD_BUILDER_PRICING_API,
    multipliers: { premiumStyle: 6, heavyTextInfographic: 1.1 },
  });
  assert.ok(!badMax.success, "multiplier > 5 rejected");

  const badSlide = cardBuilderPricingPatchSchema.safeParse({
    ...DEFAULT_CARD_BUILDER_PRICING_API,
    singleSlideCredits: 0,
  });
  assert.ok(!badSlide.success, "singleSlideCredits 0 rejected");
}

function testCardBuilderStorageRoundtrip() {
  const api = {
    planCredits: 0,
    singleSlideCredits: 200,
    gallery6Credits: 800,
    gallery8Credits: 1000,
    multipliers: { premiumStyle: 1.3, heavyTextInfographic: 1.15 },
  };
  const preserve = { customFutureField: "keep-me", multipliers: { legacyExtra: 9 } };
  const stored = cardBuilderPricingApiToStorage(api, preserve);
  assert.equal(stored.customFutureField, "keep-me");
  assert.equal((stored.multipliers as Record<string, unknown>).legacyExtra, 9);
  assert.equal(stored.cardBuilderSingleSlideCredits, 200);

  const back = storageToCardBuilderPricingApi({
    cardBuilderPlanCredits: stored.cardBuilderPlanCredits as number,
    cardBuilderSingleSlideCredits: stored.cardBuilderSingleSlideCredits as number,
    cardBuilderGallery6Credits: stored.cardBuilderGallery6Credits as number,
    cardBuilderGallery8Credits: stored.cardBuilderGallery8Credits as number,
    multipliers: stored.multipliers as { premiumStyle: number; heavyTextInfographic: number },
  });
  assert.deepEqual(back, api);
}

function testCalculatorUsesUpdatedPricing() {
  const base = cardBuilderPricingToProductCardShape(DEFAULT_CARD_BUILDER_PRICING_API);
  const updated = cardBuilderPricingToProductCardShape({
    ...DEFAULT_CARD_BUILDER_PRICING_API,
    singleSlideCredits: 999,
  });
  const before = computeCardBuilderCreditsBeforeMargin("slide", base, {
    premiumStyle: false,
    heavyText: false,
  });
  const after = computeCardBuilderCreditsBeforeMargin("slide", updated, {
    premiumStyle: false,
    heavyText: false,
  });
  assert.equal(before, 150);
  assert.equal(after, 999);
}

function testLegacyKeysNotReadByProductCardSettings() {
  const src = readFileSync(
    join(process.cwd(), "src/server/services/productCardSettings.ts"),
    "utf8",
  );
  assert.match(src, /PRODUCT_CARD_CARD_BUILDER_PRICING/);
  assert.doesNotMatch(src, /PRODUCT_CARD_BUILDER_PLAN_CREDITS/);
  assert.doesNotMatch(src, /PRODUCT_CARD_BUILDER_SLIDE_CREDITS/);
  assert.equal(CARD_BUILDER_PRICING_SETTING_KEY, "PRODUCT_CARD_CARD_BUILDER_PRICING");
}

function testPaymentSnapshotImmutabilityPattern() {
  const src = readFileSync(
    join(process.cwd(), "src/server/services/manualPaymentService.ts"),
    "utf8",
  );
  assert.match(src, /amount: new Prisma\.Decimal\(pkg\.priceKzt\)/);
  assert.match(src, /credits: totalTokens/);
  assert.match(src, /priceKzt: pkg\.priceKzt/);
  assert.match(src, /totalTokens,/);
  assert.doesNotMatch(
    src,
    /tokenPackage\.update[\s\S]*payment\.update/,
    "updateTokenPackage must not mutate existing Payment rows",
  );
}

function testWhatsAppNormalizationInKaspiStorage() {
  const stored = kaspiManualApiToStorage({
    kaspiManualEnabled: true,
    recipientName: "QazCard",
    recipientPhone: "+7 700 111 22 33",
    instructionText: "Переведите на Kaspi",
    whatsappEnabled: true,
    whatsappPhone: "+7 (700) 123-45-67",
    whatsappMessageTemplate: "Код {{paymentCode}}",
  });
  assert.equal(stored.whatsappPhone, "77001234567");

  const invalid = kaspiManualPricingPatchSchema.safeParse({
    kaspiManualEnabled: true,
    recipientName: "QazCard",
    recipientPhone: "+7700",
    instructionText: "x",
    whatsappEnabled: true,
    whatsappPhone: "",
    whatsappMessageTemplate: "x",
  });
  assert.ok(!invalid.success, "whatsapp enabled without phone rejected");
}

function testWhatsAppTestUrl() {
  const url = buildWhatsAppTestPreviewUrl({
    whatsappPhone: "77001234567",
    template: "Код {{paymentCode}} TG {{userTelegram}}",
  });
  assert.ok(url);
  assert.match(url!, /QAZCARD-TEST1/);
  assert.match(url!, /%40testuser|@testuser/);
  assert.doesNotMatch(decodeURIComponent(url!.split("text=")[1] ?? ""), /\{\{userTelegram\}\}/);
  assert.match(url!, /^https:\/\/wa\.me\/77001234567\?text=/);
}

function testSoftWarnings() {
  const w = cardBuilderPricingSoftWarnings({
    planCredits: 0,
    singleSlideCredits: 150,
    gallery6Credits: 400,
    gallery8Credits: 700,
    multipliers: { premiumStyle: 1.2, heavyTextInfographic: 1.1 },
  });
  assert.ok(w.some((x) => x.includes("Галерея 6")));
}

function testTokenPackagePriceWarnings() {
  const w = tokenPackagePriceWarnings([
    { name: "A", priceKzt: 1000, totalTokens: 100, isActive: true },
    { name: "B", priceKzt: 5000, totalTokens: 100, isActive: true },
  ]);
  assert.ok(w.length > 0);
}

function testProductCardVideoMatrixKeys() {
  const key = buildProductCardVideoMatrixKey(5, "720p");
  assert.equal(key, "duration:5|resolution:720p");

  const matrix = productCardVideoMatrixCellsToSchemaMatrix(
    [
      { duration: 5, resolution: "720p", credits: 40 },
      { duration: 10, resolution: "1080p", credits: 95 },
    ],
    { "720p": { tokens: 40 } },
    40,
    0.08,
  );
  assert.equal((matrix[key] as { tokens: number }).tokens, 40);
  assert.equal((matrix["720p"] as { tokens: number }).tokens, 40, "unknown keys preserved");

  const keys = pickProductCardPricingKeys({ duration: 10, resolution: "1080p" });
  assert.equal(keys[0], "duration:10|resolution:1080p");
  const entry = entryForProductCardMatrixKeys(matrix, keys);
  assert.ok(entry);
  assert.equal(entry!.tokens, 95);
}

function testProductCardVideoEstimateFromMatrix() {
  const pricingSchema = {
    pricingScope: "PRODUCT_CARD",
    type: "product_card_matrix",
    baseTokens: 40,
    providerCostUsd: 0.08,
    matrix: productCardVideoMatrixCellsToSchemaMatrix(
      [
        { duration: 5, resolution: "720p", credits: 40 },
        { duration: 5, resolution: "1080p", credits: 55 },
        { duration: 10, resolution: "720p", credits: 70 },
        { duration: 10, resolution: "1080p", credits: 95 },
      ],
      {},
      40,
      0.08,
    ),
  };
  const model = {
    id: "test-video",
    slug: "seedance-2-0-fast-product-video",
    name: "Test Product Video",
    costCredits: 40,
    productCardModelType: "PRODUCT_VIDEO",
    pricingSchema,
  } as unknown as Parameters<typeof calculateProductCardVideoCredits>[0];

  return Promise.all([
    calculateProductCardVideoCredits(model, { duration: 5, resolution: "720p" }),
    calculateProductCardVideoCredits(model, { duration: 10, resolution: "1080p" }),
  ]).then(([a, b]) => {
    assert.equal(a.credits, 40);
    assert.equal(b.credits, 95);
    assert.notEqual(a.credits, b.credits);
  });
}

function testProductCardVideoPatchValidation() {
  const ok = productCardVideoPricingPatchSchema.safeParse({
    modelId: "abc",
    matrix: [{ duration: 5, resolution: "720p", credits: 40 }],
  });
  assert.ok(ok.success);

  const badDur = validateProductCardVideoPatchCells({
    matrix: [{ duration: 15, resolution: "720p", credits: 40 }],
    durationOptions: [5, 10],
    resolutionOptions: ["720p", "1080p"],
    minVideoTokens: 40,
  });
  assert.ok(!badDur.ok, "invalid duration rejected");

  const badRes = validateProductCardVideoPatchCells({
    matrix: [{ duration: 5, resolution: "4K", credits: 40 }],
    durationOptions: [5, 10],
    resolutionOptions: ["720p", "1080p"],
    minVideoTokens: 40,
  });
  assert.ok(!badRes.ok, "invalid resolution rejected");

  const badCredits = validateProductCardVideoPatchCells({
    matrix: [{ duration: 5, resolution: "720p", credits: 0 }],
    durationOptions: [5, 10],
    resolutionOptions: ["720p", "1080p"],
    minVideoTokens: 40,
  });
  assert.ok(!badCredits.ok, "credits <= 0 rejected");
}

function testProductCardVideoWarnings() {
  const cells = buildProductCardVideoMatrixCells({
    matrix: {
      [buildProductCardVideoMatrixKey(5, "720p")]: { tokens: 40 },
      [buildProductCardVideoMatrixKey(10, "720p")]: { tokens: 40 },
      [buildProductCardVideoMatrixKey(5, "1080p")]: { tokens: 40 },
      [buildProductCardVideoMatrixKey(10, "1080p")]: { tokens: 40 },
    },
    durationOptions: [5, 10],
    resolutionOptions: ["720p", "1080p"],
    baseTokens: 40,
    minVideoTokens: 40,
    pricingSchema: { type: "product_card_matrix" },
  });
  const w = productCardVideoPricingSoftWarnings({
    cells,
    minVideoTokens: 40,
    durationOptions: [5, 10],
    resolutionOptions: ["720p", "1080p"],
    modelFound: true,
    modelActive: true,
    multipleActiveModels: false,
    resolverModelSlug: "seedance-2-0-fast-product-video",
  });
  assert.ok(w.some((x) => x.includes("не меняется")), "flat matrix warning");
}

function testProductCardVideoPreservesUnknownSchemaFields() {
  const next = productCardVideoMatrixCellsToSchemaMatrix(
    [{ duration: 5, resolution: "720p", credits: 40 }],
    { legacyFlat: { tokens: 99 }, customNote: "keep" },
    40,
    0.08,
  );
  assert.equal((next.legacyFlat as { tokens: number }).tokens, 99);
  assert.equal(next.customNote, "keep");
}

function testProductCardVideoAdminPricingPinnedConvention() {
  const src = readFileSync(
    join(process.cwd(), "src/server/services/adminProductCardVideoPricingEditor.ts"),
    "utf8",
  );
  assert.match(src, /withAdminPricingPinned/);
  assert.match(src, /productCardModelType !== "PRODUCT_VIDEO"/);
  assert.match(src, /scope !== "PRODUCT_CARD"/);
}

function testProductCardVideoReadMatrixCell() {
  const matrix = {
    [buildProductCardVideoMatrixKey(5, "720p")]: { tokens: 42 },
  };
  assert.equal(readMatrixCellCredits(matrix, 5, "720p", 40), 42);
  assert.equal(readMatrixCellCredits(matrix, 10, "1080p", 40), 40, "fallback base");
}

function main() {
  testCardBuilderPatchValidation();
  testCardBuilderStorageRoundtrip();
  testCalculatorUsesUpdatedPricing();
  testLegacyKeysNotReadByProductCardSettings();
  testPaymentSnapshotImmutabilityPattern();
  testWhatsAppNormalizationInKaspiStorage();
  testWhatsAppTestUrl();
  testSoftWarnings();
  testTokenPackagePriceWarnings();
  testProductCardVideoMatrixKeys();
  testProductCardVideoPatchValidation();
  testProductCardVideoWarnings();
  testProductCardVideoPreservesUnknownSchemaFields();
  testProductCardVideoAdminPricingPinnedConvention();
  testProductCardVideoReadMatrixCell();
  testProductCardVideoEstimateFromMatrix()
    .then(() => {
      console.log("verify:pricing OK");
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

main();
