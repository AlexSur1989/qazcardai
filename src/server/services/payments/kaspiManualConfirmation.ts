import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { KASPI_MANUAL_PAYMENT_PROVIDER } from "@/lib/kaspi-manual-config";
import { trySendPaymentSuccessEmail } from "@/server/services/notificationsIntegration";
import { purchaseTokenPackageInTransaction } from "@/server/services/tokenPackages";

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

function providerMatches(row: { provider: string }): boolean {
  return row.provider.trim() === KASPI_MANUAL_PAYMENT_PROVIDER;
}

export type ConfirmKaspiManualResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: false; error: string };

/**
 * Идемпотентное подтверждение ручного Kaspi: COMPLETED + purchaseTokenPackageInTransaction.
 */
export async function confirmKaspiManualPayment(args: {
  paymentId: string;
  adminUserId: string;
}): Promise<ConfirmKaspiManualResult> {
  type TxKind = "granted" | "already" | { err: string };

  let kind: TxKind;

  try {
    kind = await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.findUnique({
        where: { id: args.paymentId },
        include: { tokenPackage: true },
      });
      if (!pay) return { err: "NOT_FOUND" };
      if (!providerMatches(pay)) return { err: "PROVIDER_MISMATCH" };

      const existingPurchase = await tx.creditTransaction.findFirst({
        where: { paymentId: pay.id, type: "PURCHASE" },
      });
      if (existingPurchase || pay.status === "COMPLETED") {
        return "already";
      }

      if (pay.status !== "PENDING" && pay.status !== "PROCESSING") {
        return { err: "BAD_STATUS" };
      }

      if (!pay.tokenPackageId || !pay.tokenPackage) {
        return { err: "MISSING_TOKEN_PACKAGE" };
      }

      const updated = await tx.payment.updateMany({
        where: {
          id: pay.id,
          status: { in: ["PENDING", "PROCESSING"] },
        },
        data: {
          status: "COMPLETED",
          paidAt: new Date(),
          metadata: mergeJsonMeta(pay.metadata, {
            confirmedByAdminId: args.adminUserId,
            confirmedAt: new Date().toISOString(),
          }),
        },
      });

      if (updated.count === 0) {
        const again = await tx.payment.findUnique({ where: { id: pay.id } });
        if (again?.status === "COMPLETED") return "already";
        const dup = await tx.creditTransaction.findFirst({
          where: { paymentId: pay.id, type: "PURCHASE" },
        });
        if (dup) return "already";
        return { err: "CONCURRENT_UPDATE" };
      }

      await purchaseTokenPackageInTransaction(tx, {
        userId: pay.userId,
        paymentId: pay.id,
        credits: pay.credits,
        reason: "Kaspi manual transfer (подтверждено админом)",
        pkg: pay.tokenPackage,
      });

      await tx.adminAuditLog.create({
        data: {
          adminUserId: args.adminUserId,
          action: "payment.kaspi_manual.confirmed",
          targetType: "Payment",
          targetId: pay.id,
          newValue: {
            paymentId: pay.id,
            userId: pay.userId,
            credits: pay.credits,
          } as Prisma.InputJsonValue,
        },
      });

      return "granted";
    });
  } catch {
    return { ok: false, error: "TRANSACTION_FAILED" };
  }

  if (typeof kind === "object" && "err" in kind) {
    const code = kind.err;
    if (code === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
    if (code === "PROVIDER_MISMATCH") return { ok: false, error: "PROVIDER_MISMATCH" };
    if (code === "BAD_STATUS") return { ok: false, error: "BAD_STATUS" };
    if (code === "MISSING_TOKEN_PACKAGE") return { ok: false, error: "MISSING_TOKEN_PACKAGE" };
    if (code === "CONCURRENT_UPDATE") return { ok: false, error: "CONCURRENT_UPDATE" };
    return { ok: false, error: code };
  }

  if (kind === "already") {
    return { ok: true, alreadyConfirmed: true };
  }

  const finalRow = await prisma.payment.findUnique({
    where: { id: args.paymentId },
    include: { tokenPackage: true },
  });
  if (!finalRow) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const pkgName = finalRow.tokenPackage?.name ?? "Токены";
  void trySendPaymentSuccessEmail({
    userId: finalRow.userId,
    packageName: pkgName,
    credits: finalRow.credits,
    amount: finalRow.amount.toString(),
    currency: finalRow.currency,
  });

  return { ok: true, alreadyConfirmed: false };
}

export async function rejectKaspiManualPayment(args: {
  paymentId: string;
  adminUserId: string;
  rejectReason: string;
  terminalStatus: "FAILED" | "CANCELLED";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const reason = args.rejectReason.trim().slice(0, 2000);
  if (!reason) {
    return { ok: false, error: "EMPTY_REASON" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.findUnique({ where: { id: args.paymentId } });
      if (!pay) throw new Error("NOT_FOUND");
      if (!providerMatches(pay)) throw new Error("PROVIDER_MISMATCH");
      if (pay.status === "COMPLETED") throw new Error("ALREADY_COMPLETED");
      if (pay.status !== "PENDING" && pay.status !== "PROCESSING") {
        throw new Error("BAD_STATUS");
      }
      await tx.payment.update({
        where: { id: pay.id },
        data: {
          status: args.terminalStatus,
          metadata: mergeJsonMeta(pay.metadata, {
            rejectedByAdminId: args.adminUserId,
            rejectedAt: new Date().toISOString(),
            rejectReason: reason,
          }),
        },
      });
      await tx.adminAuditLog.create({
        data: {
          adminUserId: args.adminUserId,
          action: "payment.kaspi_manual.rejected",
          targetType: "Payment",
          targetId: pay.id,
          newValue: {
            paymentId: pay.id,
            userId: pay.userId,
            terminalStatus: args.terminalStatus,
            rejectReason: reason,
          } as Prisma.InputJsonValue,
        },
      });
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
    if (msg === "PROVIDER_MISMATCH") return { ok: false, error: "PROVIDER_MISMATCH" };
    if (msg === "ALREADY_COMPLETED") return { ok: false, error: "ALREADY_COMPLETED" };
    if (msg === "BAD_STATUS") return { ok: false, error: "BAD_STATUS" };
    throw e;
  }
}

export async function claimKaspiManualForReview(args: {
  paymentId: string;
  adminUserId: string;
}): Promise<{ ok: true; claimed: boolean } | { ok: false; error: string }> {
  try {
    const claimed = await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.findUnique({ where: { id: args.paymentId } });
      if (!pay) throw new Error("NOT_FOUND");
      if (!providerMatches(pay)) throw new Error("PROVIDER_MISMATCH");
      if (pay.status !== "PENDING") {
        if (pay.status === "PROCESSING") return false;
        throw new Error("BAD_STATUS");
      }
      const updated = await tx.payment.updateMany({
        where: { id: pay.id, status: "PENDING" },
        data: {
          status: "PROCESSING",
          metadata: mergeJsonMeta(pay.metadata, {
            reviewClaimedByAdminId: args.adminUserId,
            reviewClaimedAt: new Date().toISOString(),
          }),
        },
      });
      return updated.count > 0;
    });
    return { ok: true, claimed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
    if (msg === "PROVIDER_MISMATCH") return { ok: false, error: "PROVIDER_MISMATCH" };
    if (msg === "BAD_STATUS") return { ok: false, error: "BAD_STATUS" };
    throw e;
  }
}
