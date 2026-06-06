/**
 * Admin pricing hub: token packages helpers, Kaspi/WhatsApp, product video matrix.
 * npm run verify:pricing
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
import { calculateProductCardVideoCredits } from "../src/server/services/productCardPricing";
import { tokenPackagePriceWarnings } from "@/lib/pricing-admin/token-packages";

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
  testPaymentSnapshotImmutabilityPattern();
  testWhatsAppNormalizationInKaspiStorage();
  testWhatsAppTestUrl();
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
