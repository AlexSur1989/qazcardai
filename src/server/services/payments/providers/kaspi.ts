import "server-only";

import { timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  getAppBaseUrl,
  getKaspiProviderMode,
  isKaspiMockMode,
  KASPI_PAYMENT_PROVIDER,
} from "@/lib/kaspi-config";

import { sanitizeValueForPaymentMetadata } from "../kaspi-sanitize";
import type { ConfirmPaymentAndGrantCreditsResult } from "../paymentConfirmation";
import { confirmPaymentAndGrantCredits } from "../paymentConfirmation";

export { sanitizeValueForPaymentMetadata } from "../kaspi-sanitize";

export type KaspiCreatePaymentInput = {
  paymentId: string;
  amountKzt: number;
  description: string;
  userId: string;
  userEmail: string | null | undefined;
  returnUrl: string;
  webhookUrl: string;
};

export type KaspiCreatePaymentResult = {
  provider: typeof KASPI_PAYMENT_PROVIDER;
  providerPaymentId: string;
  paymentUrl: string;
  qrUrl: string | null;
  status: "PENDING";
  raw: Record<string, unknown>;
};

export type ParsedKaspiWebhook = {
  eventType: string;
  paymentId: string | null;
  providerPaymentId: string | null;
  amountKzt: number | null;
  currency: string | null;
  normalizedStatus: "paid" | "failed" | "cancelled" | "unknown";
  rawSafe: unknown;
};

export async function createKaspiPayment(
  input: KaspiCreatePaymentInput,
): Promise<KaspiCreatePaymentResult> {
  const mode = getKaspiProviderMode();
  if (mode === "mock" || isKaspiMockMode()) {
    const providerPaymentId = `mock_kaspi_${input.paymentId}`;
    const base = getAppBaseUrl();
    const paymentUrl = `${base}/dashboard/billing/mock-kaspi-payment?paymentId=${encodeURIComponent(input.paymentId)}`;
    return {
      provider: KASPI_PAYMENT_PROVIDER,
      providerPaymentId,
      paymentUrl,
      qrUrl: null,
      status: "PENDING",
      raw: { mock: true },
    };
  }

  void input;
  throw new Error("KASPI_LIVE_NOT_IMPLEMENTED");
}

/**
 * Проверка webhook. При заданном KASPI_WEBHOOK_SECRET нужен заголовок X-Kaspi-Webhook-Secret (timing-safe).
 * Без секрета: только mock + NODE_ENV !== production.
 */
export async function verifyKaspiWebhook(request: Request): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.KASPI_WEBHOOK_SECRET?.trim() ?? "";
  const mock = isKaspiMockMode();

  if (!secret) {
    if (mock && process.env.NODE_ENV !== "production") {
      return { ok: true };
    }
    return { ok: false, error: "WEBHOOK_SECRET_NOT_CONFIGURED" };
  }

  const headerSecret = request.headers.get("x-kaspi-webhook-secret")?.trim() ?? "";
  const a = Buffer.from(secret, "utf8");
  const b = Buffer.from(headerSecret, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "INVALID_WEBHOOK_SECRET" };
  }
  return { ok: true };
}

/** Разбор тела после JSON.parse (сырой текст обрабатывайте в route один раз). */
export function parseKaspiWebhook(payload: unknown): ParsedKaspiWebhook | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;

  const eventType =
    typeof o.eventType === "string"
      ? o.eventType
      : typeof o.type === "string"
        ? o.type
        : "unknown";

  const paymentId =
    typeof o.paymentId === "string" && o.paymentId.trim()
      ? o.paymentId.trim()
      : typeof o.internalPaymentId === "string" && o.internalPaymentId.trim()
        ? o.internalPaymentId.trim()
        : null;

  const providerPaymentId =
    typeof o.providerPaymentId === "string" && o.providerPaymentId.trim()
      ? o.providerPaymentId.trim()
        : null;

  let amountKzt: number | null = null;
  if (typeof o.amount === "number" && Number.isFinite(o.amount)) {
    amountKzt = o.amount;
  } else if (typeof o.amount === "string" && o.amount.trim()) {
    const n = Number(o.amount);
    if (Number.isFinite(n)) amountKzt = n;
  }

  const currency =
    typeof o.currency === "string" && o.currency.trim() ? o.currency.trim() : null;

  const statusRaw =
    typeof o.status === "string"
      ? o.status.toLowerCase()
      : typeof o.paymentStatus === "string"
        ? o.paymentStatus.toLowerCase()
        : "";

  let normalizedStatus: ParsedKaspiWebhook["normalizedStatus"] = "unknown";
  if (["paid", "success", "completed", "succeeded"].includes(statusRaw)) {
    normalizedStatus = "paid";
  } else if (["failed", "error"].includes(statusRaw)) {
    normalizedStatus = "failed";
  } else if (["cancelled", "canceled"].includes(statusRaw)) {
    normalizedStatus = "cancelled";
  }

  return {
    eventType,
    paymentId,
    providerPaymentId,
    amountKzt,
    currency,
    normalizedStatus,
    rawSafe: sanitizeValueForPaymentMetadata(payload),
  };
}

export async function getKaspiPaymentStatus(providerPaymentId: string) {
  return prisma.payment.findFirst({
    where: {
      provider: KASPI_PAYMENT_PROVIDER,
      providerPaymentId,
    },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      credits: true,
      userId: true,
    },
  });
}

/** Тестовое подтвращение из кода (не из HTTP): грузит платёж и вызывает confirm с суммой из БД. */
export async function confirmMockKaspiPayment(paymentId: string) {
  const pay = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!pay) {
    return { ok: false as const, error: "NOT_FOUND" };
  }
  if (pay.provider.trim().toUpperCase() !== KASPI_PAYMENT_PROVIDER) {
    return { ok: false as const, error: "PROVIDER_MISMATCH" };
  }
  const amount = Number(pay.amount.toString());
  return confirmPaymentAndGrantCredits({
    paymentId: pay.id,
    provider: KASPI_PAYMENT_PROVIDER,
    providerPaymentId: pay.providerPaymentId,
    rawEvent: { mock: true, source: "confirmMockKaspiPayment" },
    webhookAmountKzt: amount,
    webhookCurrency: pay.currency,
  });
}

export async function confirmKaspiPaymentAfterWebhook(
  paymentId: string,
  parsed: ParsedKaspiWebhook,
): Promise<ConfirmPaymentAndGrantCreditsResult | { ok: false; error: "NOT_PAID_EVENT" }> {
  if (parsed.normalizedStatus !== "paid") {
    return { ok: false, error: "NOT_PAID_EVENT" };
  }
  return confirmPaymentAndGrantCredits({
    paymentId,
    provider: KASPI_PAYMENT_PROVIDER,
    providerPaymentId: parsed.providerPaymentId ?? undefined,
    rawEvent: parsed.rawSafe,
    webhookAmountKzt: parsed.amountKzt ?? undefined,
    webhookCurrency: parsed.currency ?? undefined,
  });
}
