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
import { computeCardBuilderCreditsBeforeMargin } from "../src/server/services/productCardPricing";
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
  console.log("verify:pricing OK");
}

main();
