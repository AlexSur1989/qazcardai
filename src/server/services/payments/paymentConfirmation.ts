
import { Prisma } from "@/generated/prisma/client";
import type { PaymentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { KASPI_PAYMENT_PROVIDER } from "@/lib/kaspi-config";
import { trySendPaymentSuccessEmail } from "@/server/services/notificationsIntegration";
import { purchaseTokenPackageInTransaction } from "@/server/services/tokenPackages";

import { sanitizeValueForPaymentMetadata } from "./kaspi-sanitize";

function mergeJsonMeta(
  current: Prisma.JsonValue | null,
  extra: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...extra } as Prisma.InputJsonValue;
}

function normalizeCurrency(c: string): string {
  return c.trim().toUpperCase();
}

export type ConfirmPaymentAndGrantCreditsInput = {
  paymentId: string;
  provider: string;
  providerPaymentId?: string | null;
  rawEvent?: unknown;
  webhookAmountKzt?: number;
  webhookCurrency?: string;
};

export type ConfirmPaymentAndGrantCreditsResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: false; error: string };

/**
 * РРґРµРјРїРѕС‚РµРЅС‚РЅРѕРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїР»Р°С‚РµР¶Р° Рё РЅР°С‡РёСЃР»РµРЅРёРµ РєСЂРµРґРёС‚РѕРІ (С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ webhook / mock-confirm).
 * Р”РІРѕР№РЅРѕРµ РЅР°С‡РёСЃР»РµРЅРёРµ РёСЃРєР»СЋС‡РµРЅРѕ: СЃС‚Р°С‚СѓСЃ COMPLETED Рё updateMany РїРѕ PENDING.
 */
export async function confirmPaymentAndGrantCredits(
  input: ConfirmPaymentAndGrantCreditsInput,
): Promise<ConfirmPaymentAndGrantCreditsResult> {
  const providerExpected = input.provider.trim().toUpperCase();
  if (providerExpected !== KASPI_PAYMENT_PROVIDER) {
    return { ok: false, error: "UNSUPPORTED_PROVIDER" };
  }

  type TxResult = { kind: "already" } | { kind: "granted" } | { kind: "error"; code: string };

  let txResult: TxResult;

  try {
    txResult = await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.findUnique({
        where: { id: input.paymentId },
        include: { tokenPackage: true },
      });
      if (!pay) {
        return { kind: "error", code: "PAYMENT_NOT_FOUND" };
      }
      if (pay.provider.trim().toUpperCase() !== KASPI_PAYMENT_PROVIDER) {
        return { kind: "error", code: "PROVIDER_MISMATCH" };
      }

      if (pay.status === "COMPLETED") {
        return { kind: "already" };
      }

      if (pay.status !== "PENDING") {
        return { kind: "error", code: `UNEXPECTED_STATUS:${pay.status}` };
      }

      if (
        input.providerPaymentId &&
        pay.providerPaymentId &&
        pay.providerPaymentId !== input.providerPaymentId
      ) {
        return { kind: "error", code: "PROVIDER_PAYMENT_ID_MISMATCH" };
      }

      if (
        typeof input.webhookAmountKzt === "number" &&
        Number.isFinite(input.webhookAmountKzt)
      ) {
        const expected = new Prisma.Decimal(input.webhookAmountKzt);
        if (!pay.amount.equals(expected)) {
          return { kind: "error", code: "AMOUNT_MISMATCH" };
        }
      }

      if (input.webhookCurrency) {
        if (normalizeCurrency(input.webhookCurrency) !== normalizeCurrency(pay.currency)) {
          return { kind: "error", code: "CURRENCY_MISMATCH" };
        }
      }

      const meta = mergeJsonMeta(pay.metadata, {
        ...(input.providerPaymentId ? { providerPaymentId: input.providerPaymentId } : {}),
        ...(input.rawEvent !== undefined
          ? { rawEvent: sanitizeValueForPaymentMetadata(input.rawEvent) }
          : {}),
      });

      const updated = await tx.payment.updateMany({
        where: { id: input.paymentId, status: "PENDING" },
        data: {
          status: "COMPLETED",
          paidAt: new Date(),
          ...(input.providerPaymentId && !pay.providerPaymentId
            ? { providerPaymentId: input.providerPaymentId }
            : {}),
          metadata: meta,
        },
      });

      if (updated.count === 0) {
        const again = await tx.payment.findUnique({ where: { id: input.paymentId } });
        if (again?.status === "COMPLETED") {
          return { kind: "already" };
        }
        return { kind: "error", code: "CONCURRENT_UPDATE" };
      }

      const reason = "Kaspi payment";

      if (pay.tokenPackageId && pay.tokenPackage) {
        await purchaseTokenPackageInTransaction(tx, {
          userId: pay.userId,
          paymentId: pay.id,
          credits: pay.credits,
          reason,
          pkg: pay.tokenPackage,
        });
      } else {
        return { kind: "error", code: "MISSING_TOKEN_PACKAGE" };
      }

      return { kind: "granted" };
    });
  } catch {
    return { ok: false, error: "TRANSACTION_FAILED" };
  }

  if (txResult.kind === "error") {
    const code = txResult.code;
    if (code === "PAYMENT_NOT_FOUND") return { ok: false, error: "PAYMENT_NOT_FOUND" };
    if (code === "PROVIDER_MISMATCH") return { ok: false, error: "PROVIDER_MISMATCH" };
    if (code.startsWith("UNEXPECTED_STATUS:"))
      return { ok: false, error: "UNEXPECTED_STATUS" };
    if (code === "PROVIDER_PAYMENT_ID_MISMATCH")
      return { ok: false, error: "PROVIDER_PAYMENT_ID_MISMATCH" };
    if (code === "AMOUNT_MISMATCH") return { ok: false, error: "AMOUNT_MISMATCH" };
    if (code === "CURRENCY_MISMATCH") return { ok: false, error: "CURRENCY_MISMATCH" };
    if (code === "MISSING_TOKEN_PACKAGE") return { ok: false, error: "MISSING_TOKEN_PACKAGE" };
    if (code === "CONCURRENT_UPDATE") return { ok: false, error: "CONCURRENT_UPDATE" };
    return { ok: false, error: code };
  }

  if (txResult.kind === "already") {
    return { ok: true, alreadyConfirmed: true };
  }

  const finalRow = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    include: { tokenPackage: true },
  });

  if (!finalRow) {
    return { ok: false, error: "PAYMENT_NOT_FOUND" };
  }

  if (txResult.kind === "granted") {
    const pkgName = finalRow.tokenPackage?.name ?? "РўРѕРєРµРЅС‹";
    void trySendPaymentSuccessEmail({
      userId: finalRow.userId,
      packageName: pkgName,
      credits: finalRow.credits,
      amount: finalRow.amount.toString(),
      currency: finalRow.currency,
    });
  }

  return { ok: true, alreadyConfirmed: false };
}

/**
 * РћР±РЅРѕРІР»РµРЅРёРµ СЃС‚Р°С‚СѓСЃР° Р±РµР· РЅР°С‡РёСЃР»РµРЅРёСЏ (failed / cancelled).
 */
export async function setKaspiPaymentTerminalStatus(
  paymentId: string,
  status: "FAILED" | "CANCELLED",
  rawEvent?: unknown,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!pay) throw new Error("NOT_FOUND");
      if (pay.provider.trim().toUpperCase() !== KASPI_PAYMENT_PROVIDER) {
        throw new Error("PROVIDER_MISMATCH");
      }
      if (pay.status === "COMPLETED") return;
      if (pay.status !== "PENDING") {
        throw new Error("UNEXPECTED_STATUS");
      }
      const meta = mergeJsonMeta(pay.metadata, {
        ...(rawEvent !== undefined
          ? { rawEvent: sanitizeValueForPaymentMetadata(rawEvent) }
          : {}),
      });
      await tx.payment.updateMany({
        where: { id: paymentId, status: "PENDING" },
        data: { status: status as PaymentStatus, metadata: meta },
      });
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
    if (msg === "PROVIDER_MISMATCH") return { ok: false, error: "PROVIDER_MISMATCH" };
    if (msg === "UNEXPECTED_STATUS") return { ok: false, error: "UNEXPECTED_STATUS" };
    throw e;
  }
}
