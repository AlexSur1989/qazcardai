/**
 * Ручное пополнение Kaspi / WhatsApp: helpers, шаблон, wa.me URL.
 * npm run verify:manual-payments
 */
import "dotenv/config";
import assert from "node:assert/strict";

import { KASPI_MANUAL_PAYMENT_PROVIDER } from "../src/lib/kaspi-manual-config";
import {
  manualPaymentContactChannelLabel,
  manualPaymentUserStatusLabel,
} from "../src/lib/manual-payment-labels";
import {
  buildWhatsAppTopUpUrl,
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  formatKazakhstanPhoneForDisplay,
  formatUserTelegramForWhatsApp,
  formatWhatsAppPhoneDisplay,
  interpolateWhatsAppTemplate,
  normalizeWhatsAppPhone,
} from "../src/lib/whatsapp-manual-payment";
import { buildManualPaymentInstructionCode } from "../src/lib/manual-payment-codes";
import { APP_SETTINGS_REGISTRY } from "../src/config/app-settings-registry";
import { serializeManualPaymentForClient } from "../src/server/services/manualPaymentService";
import type { KaspiManualSettings } from "../src/server/services/kaspiManualSettings";

function testWhatsAppPhoneNormalization() {
  assert.equal(normalizeWhatsAppPhone("+7 (700) 123-45-67"), "77001234567");
  assert.equal(formatKazakhstanPhoneForDisplay("77001234567"), "+7 700 123 45 67");
  assert.equal(formatKazakhstanPhoneForDisplay("+7 777 123 45 67"), "+7 777 123 45 67");
  assert.equal(formatWhatsAppPhoneDisplay("77001234567"), "+7 700 123 45 67");
  assert.equal(formatKazakhstanPhoneForDisplay("12345"), "+12345");
}

function testWhatsAppUrlEncoding() {
  const url = buildWhatsAppTopUpUrl("77001234567", "Привет! Код: QAZCARD-ABC");
  assert.ok(url);
  assert.match(url!, /^https:\/\/wa\.me\/77001234567\?text=/);
  assert.ok(url!.includes(encodeURIComponent("Привет! Код: QAZCARD-ABC")));
  assert.equal(buildWhatsAppTopUpUrl("", "x"), null);
}

function testTemplateInterpolation() {
  const msg = interpolateWhatsAppTemplate(DEFAULT_WHATSAPP_MESSAGE_TEMPLATE, {
    paymentCode: "QAZCARD-8F42K",
    packageLabel: "1000 токенов",
    amountKzt: 3500,
    creditsAmount: 1000,
    userEmail: "user@mail.com",
  });
  assert.match(msg, /QAZCARD-8F42K/);
  assert.match(msg, /1000 токенов/);
  assert.match(msg, /3500 ₸/);
  assert.match(msg, /user@mail.com/);
  assert.match(msg, /Прикрепляю чек/);
  assert.doesNotMatch(msg, /\{\{userTelegram\}\}/);
}

function testUserTelegramInterpolation() {
  const withUsername = interpolateWhatsAppTemplate("TG: {{userTelegram}}", {
    paymentCode: "X",
    packageLabel: "P",
    amountKzt: 1,
    creditsAmount: 1,
    userEmail: "user@mail.com",
    userTelegram: "myuser",
  });
  assert.equal(withUsername, "TG: @myuser");

  const withAtPrefix = interpolateWhatsAppTemplate("TG: {{userTelegram}}", {
    paymentCode: "X",
    packageLabel: "P",
    amountKzt: 1,
    creditsAmount: 1,
    userEmail: "user@mail.com",
    userTelegram: "@myuser",
  });
  assert.equal(withAtPrefix, "TG: @myuser");

  const withoutUsername = interpolateWhatsAppTemplate("TG: {{userTelegram}}", {
    paymentCode: "X",
    packageLabel: "P",
    amountKzt: 1,
    creditsAmount: 1,
    userEmail: "fallback@mail.com",
  });
  assert.equal(withoutUsername, "TG: fallback@mail.com");
  assert.doesNotMatch(withoutUsername, /\{\{userTelegram\}\}/);

  assert.equal(formatUserTelegramForWhatsApp("alice", "a@b.c"), "@alice");
  assert.equal(formatUserTelegramForWhatsApp(null, "a@b.c"), "a@b.c");
}

function testPaymentCodeFormat() {
  const code = buildManualPaymentInstructionCode("QAZCARD");
  assert.match(code, /^QAZCARD-[A-F0-9]{5}$/);
}

function testUserStatusLabels() {
  assert.equal(manualPaymentUserStatusLabel("PENDING"), "Ожидает проверки");
  assert.equal(manualPaymentUserStatusLabel("PROCESSING"), "Ожидает проверки");
  assert.equal(manualPaymentUserStatusLabel("COMPLETED"), "Подтверждено");
  assert.equal(manualPaymentUserStatusLabel("FAILED"), "Отклонено");
  assert.equal(manualPaymentUserStatusLabel("CANCELLED"), "Отменено");
  assert.equal(manualPaymentUserStatusLabel("PENDING", true), "Истекло");
  assert.equal(manualPaymentContactChannelLabel("whatsapp"), "WhatsApp");
  assert.equal(manualPaymentContactChannelLabel("kaspi"), "Kaspi перевод");
}

function testKaspiManualProviderConstant() {
  assert.equal(KASPI_MANUAL_PAYMENT_PROVIDER, "kaspi_manual");
}

function testManualPaymentClientDtoFullPhones() {
  const settings: KaspiManualSettings = {
    kaspiManualEnabled: true,
    recipientName: "QazCard AI",
    recipientPhone: "+7 777 123 45 67",
    instructionText: "Переведите на Kaspi",
    requireReceiptUpload: false,
    paymentCodePrefix: "QAZ",
    expiresMinutes: 60,
    whatsappEnabled: true,
    whatsappPhone: "77001234567",
    whatsappMessageTemplate:
      "Код {{paymentCode}} · {{packageLabel}} · {{amountKzt}} · {{creditsAmount}} · {{userEmail}} · {{userTelegram}}",
  };
  const row = serializeManualPaymentForClient({
    settings,
    userEmail: "client@mail.com",
    userTelegram: "testuser",
    payment: {
      id: "pay_test",
      userId: "u1",
      tokenPackageId: "pkg1",
      provider: "kaspi_manual",
      providerPaymentId: "QAZ-1A589",
      amount: { toString: () => "25000" } as never,
      currency: "KZT",
      credits: 3250,
      status: "PENDING",
      metadata: {
        instructionCode: "QAZ-1A589",
        contactChannel: "whatsapp",
        kaspiRecipientPhoneMasked: "+7 *** *** ** 67",
        kaspiRecipientName: "QazCard AI",
      },
      createdAt: new Date("2026-01-01T12:00:00Z"),
      updatedAt: new Date("2026-01-01T12:00:00Z"),
      paidAt: null,
      tokenPackage: { name: "Studio" },
    } as never,
  });
  assert.equal(row.kaspiPhoneDisplay, "+7 777 123 45 67");
  assert.equal(row.whatsappPhoneDisplay, "+7 700 123 45 67");
  assert.equal(row.kaspiRecipientPhoneMasked, "+7 *** *** ** 67");
  assert.ok(row.whatsappUrl);
  assert.match(row.whatsappUrl!, /^https:\/\/wa\.me\/77001234567\?text=/);
  const decoded = decodeURIComponent(row.whatsappUrl!.split("text=")[1] ?? "");
  assert.match(decoded, /QAZ-1A589/);
  assert.match(decoded, /Studio/);
  assert.match(decoded, /25000/);
  assert.match(decoded, /3250/);
  assert.match(decoded, /client@mail.com/);
  assert.match(decoded, /@testuser/);
  assert.doesNotMatch(decoded, /\{\{/);
  assert.equal(row.canOpenWhatsApp, true);
}

function testAppSettingsDefaults() {
  const entry = APP_SETTINGS_REGISTRY.find((e) => e.key === "KASPI_MANUAL_SETTINGS");
  assert.ok(entry, "KASPI_MANUAL_SETTINGS in registry");
  const def = entry!.defaultValue as Record<string, unknown>;
  assert.equal(def.kaspiManualEnabled, false);
  assert.equal(def.whatsappEnabled, true);
  assert.equal(normalizeWhatsAppPhone(String(def.whatsappPhone)), "77001234567");
  assert.match(String(def.paymentCodePrefix), /QAZCARD/);
  assert.match(String(def.whatsappMessageTemplate), /\{\{paymentCode\}\}/);
}

function main() {
  testWhatsAppPhoneNormalization();
  testWhatsAppUrlEncoding();
  testTemplateInterpolation();
  testUserTelegramInterpolation();
  testPaymentCodeFormat();
  testUserStatusLabels();
  testKaspiManualProviderConstant();
  testManualPaymentClientDtoFullPhones();
  testAppSettingsDefaults();
  console.log("verify:manual-payments OK");
}

main();
