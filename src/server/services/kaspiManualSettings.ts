import type { KaspiManualBillingPublic, ManualPaymentSettingsPublic } from "@/lib/kaspi-manual-config";
import {
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  formatWhatsAppPhoneDisplay,
  normalizeWhatsAppPhone,
} from "@/lib/whatsapp-manual-payment";
import { getAppSetting } from "@/server/services/appSettings";
import { listActiveTokenPackagesForBilling } from "@/server/services/token-packages-catalog";

export type KaspiManualSettings = {
  kaspiManualEnabled: boolean;
  recipientName: string;
  recipientPhone: string;
  instructionText: string;
  requireReceiptUpload: boolean;
  paymentCodePrefix: string;
  expiresMinutes: number;
  whatsappEnabled: boolean;
  whatsappPhone: string;
  whatsappMessageTemplate: string;
};

const DEFAULTS: KaspiManualSettings = {
  kaspiManualEnabled: false,
  recipientName: "QazCard AI",
  recipientPhone: "+7XXXXXXXXXX",
  instructionText:
    "Переведите сумму на Kaspi, укажите код заявки в комментарии и отправьте чек в WhatsApp.",
  requireReceiptUpload: false,
  paymentCodePrefix: "QAZCARD",
  expiresMinutes: 1440,
  whatsappEnabled: true,
  whatsappPhone: "77001234567",
  whatsappMessageTemplate: DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function mergeKaspiManualSettings(raw: unknown): KaspiManualSettings {
  const base = { ...DEFAULTS };
  if (!isRecord(raw)) return base;
  if (typeof raw.kaspiManualEnabled === "boolean") {
    base.kaspiManualEnabled = raw.kaspiManualEnabled;
  }
  if (typeof raw.recipientName === "string" && raw.recipientName.trim()) {
    base.recipientName = raw.recipientName.trim();
  }
  if (typeof raw.recipientPhone === "string" && raw.recipientPhone.trim()) {
    base.recipientPhone = raw.recipientPhone.trim();
  }
  if (typeof raw.instructionText === "string") {
    base.instructionText = raw.instructionText;
  }
  if (typeof raw.requireReceiptUpload === "boolean") {
    base.requireReceiptUpload = raw.requireReceiptUpload;
  }
  if (typeof raw.paymentCodePrefix === "string" && raw.paymentCodePrefix.trim()) {
    base.paymentCodePrefix = raw.paymentCodePrefix.trim();
  }
  if (typeof raw.expiresMinutes === "number" && Number.isFinite(raw.expiresMinutes)) {
    base.expiresMinutes = Math.max(5, Math.min(10080, Math.round(raw.expiresMinutes)));
  }
  if (typeof raw.whatsappEnabled === "boolean") {
    base.whatsappEnabled = raw.whatsappEnabled;
  }
  if (typeof raw.whatsappPhone === "string" && raw.whatsappPhone.trim()) {
    base.whatsappPhone = normalizeWhatsAppPhone(raw.whatsappPhone);
  }
  if (typeof raw.whatsappMessageTemplate === "string" && raw.whatsappMessageTemplate.trim()) {
    base.whatsappMessageTemplate = raw.whatsappMessageTemplate.trim();
  }
  return base;
}

export async function getKaspiManualSettings(): Promise<KaspiManualSettings> {
  const raw = await getAppSetting("KASPI_MANUAL_SETTINGS");
  return mergeKaspiManualSettings(raw);
}

/** Маска для UI: последние 2 цифры номера. */
export function maskKaspiRecipientPhone(phone: string): string {
  const t = phone.trim();
  if (!t) return "";
  const digits = t.replace(/\D/g, "");
  const last2 = digits.slice(-2);
  if (last2.length < 2) return "+* *** *** ** **";
  if (digits.length >= 11 && digits.startsWith("7")) {
    return `+7 *** *** ** ${last2}`;
  }
  return `***${last2}`;
}

export async function getKaspiManualBillingPublic(): Promise<KaspiManualBillingPublic> {
  const s = await getKaspiManualSettings();
  return {
    enabled: s.kaspiManualEnabled,
    recipientName: s.recipientName,
    kaspiRecipientPhoneMasked: maskKaspiRecipientPhone(s.recipientPhone),
    instructionText: s.instructionText,
    requireReceiptUpload: s.requireReceiptUpload,
    expiresMinutes: s.expiresMinutes,
    whatsappEnabled: s.whatsappEnabled && Boolean(s.whatsappPhone),
    whatsappPhoneDisplay: s.whatsappPhone
      ? formatWhatsAppPhoneDisplay(s.whatsappPhone)
      : "",
  };
}

export async function getManualPaymentSettingsPublic(): Promise<ManualPaymentSettingsPublic> {
  const [billing, packages] = await Promise.all([
    getKaspiManualBillingPublic(),
    listActiveTokenPackagesForBilling(),
  ]);
  return {
    ...billing,
    packages: packages.map((p) => ({
      id: p.id,
      label: p.name,
      amountKzt: p.priceKzt,
      credits: p.totalTokens,
    })),
  };
}
