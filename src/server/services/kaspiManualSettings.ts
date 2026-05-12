import type { KaspiManualBillingPublic } from "@/lib/kaspi-manual-config";
import { getAppSetting } from "@/server/services/appSettings";

export type KaspiManualSettings = {
  kaspiManualEnabled: boolean;
  recipientName: string;
  recipientPhone: string;
  instructionText: string;
  requireReceiptUpload: boolean;
  paymentCodePrefix: string;
  expiresMinutes: number;
};

const DEFAULTS: KaspiManualSettings = {
  kaspiManualEnabled: false,
  recipientName: "QazCard AI",
  recipientPhone: "+7XXXXXXXXXX",
  instructionText: "Переведите сумму на Kaspi и укажите код в комментарии.",
  requireReceiptUpload: false,
  paymentCodePrefix: "QAZ",
  expiresMinutes: 1440,
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
  };
}
