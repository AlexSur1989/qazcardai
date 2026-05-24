import { z } from "zod";

import {
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  buildWhatsAppTopUpUrl,
  interpolateWhatsAppTemplate,
  normalizeWhatsAppPhone,
} from "@/lib/whatsapp-manual-payment";

export const KASPI_MANUAL_SETTING_KEY = "KASPI_MANUAL_SETTINGS";

const PLACEHOLDER_RE =
  /\{\{(paymentCode|packageLabel|amountKzt|creditsAmount|userEmail|userTelegram)\}\}/g;

export const kaspiManualPricingPatchSchema = z
  .object({
    kaspiManualEnabled: z.boolean(),
    recipientName: z.string().trim().min(1).max(200),
    recipientPhone: z.string().trim().min(5).max(40),
    instructionText: z.string().trim().min(1).max(4000),
    whatsappEnabled: z.boolean(),
    whatsappPhone: z.string().trim().max(20).optional().default(""),
    whatsappMessageTemplate: z.string().trim().min(1).max(8000),
    requireReceiptUpload: z.boolean().optional(),
    paymentCodePrefix: z.string().trim().max(32).optional(),
    expiresMinutes: z.number().int().min(5).max(10080).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.whatsappEnabled && !normalizeWhatsAppPhone(v.whatsappPhone ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите WhatsApp номер, если канал включён",
        path: ["whatsappPhone"],
      });
    }
  });

export type KaspiManualPricingApi = z.infer<typeof kaspiManualPricingPatchSchema>;

export function kaspiManualApiToStorage(
  api: KaspiManualPricingApi,
  preserveUnknown?: Record<string, unknown>,
): Record<string, unknown> {
  const base = preserveUnknown && typeof preserveUnknown === "object" ? { ...preserveUnknown } : {};
  return {
    ...base,
    kaspiManualEnabled: api.kaspiManualEnabled,
    recipientName: api.recipientName,
    recipientPhone: api.recipientPhone.trim(),
    instructionText: api.instructionText,
    whatsappEnabled: api.whatsappEnabled,
    whatsappPhone: normalizeWhatsAppPhone(api.whatsappPhone ?? ""),
    whatsappMessageTemplate: api.whatsappMessageTemplate,
    ...(api.requireReceiptUpload !== undefined
      ? { requireReceiptUpload: api.requireReceiptUpload }
      : {}),
    ...(api.paymentCodePrefix !== undefined ? { paymentCodePrefix: api.paymentCodePrefix } : {}),
    ...(api.expiresMinutes !== undefined ? { expiresMinutes: api.expiresMinutes } : {}),
  };
}

export function validateWhatsAppTemplatePlaceholders(template: string): string[] {
  const allowed = new Set([
    "paymentCode",
    "packageLabel",
    "amountKzt",
    "creditsAmount",
    "userEmail",
    "userTelegram",
  ]);
  const unknown: string[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    if (!allowed.has(m[1]!)) unknown.push(m[1]!);
  }
  return unknown;
}

export function buildWhatsAppTestPreviewUrl(args: {
  whatsappPhone: string;
  template: string;
}): string | null {
  const phone = normalizeWhatsAppPhone(args.whatsappPhone);
  if (!phone) return null;
  const message = interpolateWhatsAppTemplate(
    args.template || DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
    {
      paymentCode: "QAZCARD-TEST1",
      packageLabel: "Pro (тест)",
      amountKzt: 10000,
      creditsAmount: 1200,
      userEmail: "client@example.com",
      userTelegram: "testuser",
    },
  );
  return buildWhatsAppTopUpUrl(phone, message);
}

/** Warn if template has unknown placeholders (non-blocking). */
export function kaspiManualSoftWarnings(api: KaspiManualPricingApi): string[] {
  const w: string[] = [];
  const unknown = validateWhatsAppTemplatePlaceholders(api.whatsappMessageTemplate);
  if (unknown.length > 0) {
    w.push(`Неизвестные placeholders в шаблоне: ${unknown.join(", ")}`);
  }
  if (!PLACEHOLDER_RE.test(api.whatsappMessageTemplate)) {
    w.push("Шаблон WhatsApp не содержит placeholders — клиент может забыть указать код заявки.");
  }
  return w;
}
