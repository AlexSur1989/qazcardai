import "server-only";

import type { CreditTransactionType } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

export class CreditServiceError extends Error {
  code: "INSUFFICIENT" | "NOT_FOUND" | "INVALID" | "CONFLICT" | "FORBIDDEN";
  constructor(
    code: CreditServiceError["code"],
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

export type ListTxOptions = { take?: number };

/** Текущий баланс (денормализованное поле user.balanceCredits). */
export async function getBalance(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { balanceCredits: true },
  });
  if (!u) {
    throw new CreditServiceError("NOT_FOUND", "Пользователь не найден");
  }
  return u.balanceCredits;
}

/**
 * Начисление кредитов (amount &gt; 0).
 * type: PURCHASE, PROMO или по смыслу; для внутреннего бонуса — PROMO.
 */
export async function addCredits(
  userId: string,
  amount: number,
  reason: string,
  type: CreditTransactionType = "PROMO",
  options?: { paymentId?: string; metadata?: unknown },
) {
  if (amount <= 0 || !Number.isInteger(amount)) {
    throw new CreditServiceError("INVALID", "Сумма начисления — целое число > 0");
  }
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { balanceCredits: { increment: amount } },
      select: { balanceCredits: true },
    });
    const ct = await tx.creditTransaction.create({
      data: {
        userId,
        type,
        amount,
        reason: reason.slice(0, 512),
        paymentId: options?.paymentId,
        metadata:
          options?.metadata === undefined
            ? undefined
            : (options.metadata as Prisma.InputJsonValue),
      },
    });
    return { balance: user.balanceCredits, transactionId: ct.id };
  });
}

/**
 * Резерв под генерацию: списывает amount с баланса, пишет RESERVE, связывает с generationId.
 * amount — положительное число (сколько кредитов зарезервировано), в БД пишем amount как отрицательное движение.
 */
export async function reserveCredits(
  userId: string,
  amount: number,
  generationId: string,
  reason = "Резерв под генерацию",
) {
  if (amount <= 0 || !Number.isInteger(amount)) {
    throw new CreditServiceError("INVALID", "Резерв: целое amount > 0");
  }
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({
      where: { id: userId },
      select: { balanceCredits: true },
    });
    if (!u) {
      throw new CreditServiceError("NOT_FOUND", "Пользователь не найден");
    }
    if (u.balanceCredits < amount) {
      throw new CreditServiceError(
        "INSUFFICIENT",
        "Недостаточно кредитов",
      );
    }
    const existing = await tx.creditTransaction.findFirst({
      where: { generationId, type: "RESERVE" },
    });
    if (existing) {
      throw new CreditServiceError(
        "CONFLICT",
        "По этой генерации резерв уже создан",
      );
    }
    const user = await tx.user.update({
      where: { id: userId },
      data: { balanceCredits: { decrement: amount } },
      select: { balanceCredits: true },
    });
    if (user.balanceCredits < 0) {
      throw new CreditServiceError("INSUFFICIENT", "Недостаточно кредитов");
    }
    await tx.creditTransaction.create({
      data: {
        userId,
        generationId,
        type: "RESERVE",
        amount: -amount,
        reason: reason.slice(0, 512),
      },
    });
    return { balance: user.balanceCredits };
  });
}

/**
 * Подтверждение списания: после успеха генерации. Баланс не меняем (уже уменьшен при RESERVE).
 */
export async function confirmCredits(generationId: string) {
  return prisma.$transaction(async (tx) => {
    const reserve = await tx.creditTransaction.findFirst({
      where: { generationId, type: "RESERVE" },
    });
    if (!reserve) {
      throw new CreditServiceError("NOT_FOUND", "Нет RESERVE по этой генерации");
    }
    const hasCapture = await tx.creditTransaction.findFirst({
      where: { generationId, type: "CAPTURE" },
    });
    if (hasCapture) {
      const b = await tx.user.findUnique({
        where: { id: reserve.userId },
        select: { balanceCredits: true },
      });
      return { idempotent: true as const, balance: b?.balanceCredits ?? 0 };
    }
    const hasRefund = await tx.creditTransaction.findFirst({
      where: { generationId, type: "REFUND" },
    });
    if (hasRefund) {
      throw new CreditServiceError("CONFLICT", "Уже выполнен возврат по этой генерации");
    }
    await tx.creditTransaction.create({
      data: {
        userId: reserve.userId,
        generationId,
        type: "CAPTURE",
        amount: 0,
        reason: "Списание подтверждено (резерв списан ранее)",
      },
    });
    const bRow = await tx.user.findUnique({
      where: { id: reserve.userId },
      select: { balanceCredits: true },
    });
    return { idempotent: false as const, balance: bRow?.balanceCredits ?? 0 };
  });
}

/**
 * Возврат зарезервированных кредитов (ошибка провайдера и т.п.).
 */
export async function refundCredits(generationId: string, reason = "Возврат: ошибка провайдера") {
  return prisma.$transaction(async (tx) => {
    const reserve = await tx.creditTransaction.findFirst({
      where: { generationId, type: "RESERVE" },
    });
    if (!reserve) {
      throw new CreditServiceError("NOT_FOUND", "Нет RESERVE по этой генерации");
    }
    const hasRefund = await tx.creditTransaction.findFirst({
      where: { generationId, type: "REFUND" },
    });
    if (hasRefund) {
      const b = await tx.user.findUnique({
        where: { id: reserve.userId },
        select: { balanceCredits: true },
      });
      return {
        idempotent: true as const,
        balance: b?.balanceCredits ?? 0,
      };
    }
    const hasCapture = await tx.creditTransaction.findFirst({
      where: { generationId, type: "CAPTURE" },
    });
    if (hasCapture) {
      throw new CreditServiceError(
        "CONFLICT",
        "Возврат невозможен: по генерации уже подтверждёно списание",
      );
    }
    const back = -reserve.amount;
    if (back <= 0) {
      throw new CreditServiceError("INVALID", "Некорректная сумма возврата");
    }
    const user = await tx.user.update({
      where: { id: reserve.userId },
      data: { balanceCredits: { increment: back } },
      select: { balanceCredits: true },
    });
    await tx.creditTransaction.create({
      data: {
        userId: reserve.userId,
        generationId,
        type: "REFUND",
        amount: back,
        reason: reason.slice(0, 512),
      },
    });
    return { idempotent: false as const, balance: user.balanceCredits };
  });
}

export async function listTransactions(userId: string, options: ListTxOptions = {}) {
  const take = Math.min(options.take ?? 100, 500);
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      amount: true,
      reason: true,
      createdAt: true,
      generationId: true,
      paymentId: true,
    },
  });
}

/**
 * Ручная корректировка баланса админом. delta: + начислить, − списать.
 * Пишет CreditTransaction (ADMIN_ADJUSTMENT) и AdminAuditLog.
 */
export async function adminAdjustCredits(args: {
  userId: string;
  adminUserId: string;
  delta: number;
  reason: string;
}): Promise<{ newBalance: number }> {
  const { userId, adminUserId, delta, reason } = args;
  if (!Number.isInteger(delta) || delta === 0) {
    throw new CreditServiceError("INVALID", "Укажите ненулевое целое delta");
  }
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: userId },
      select: { balanceCredits: true },
    });
    if (!before) {
      throw new CreditServiceError("NOT_FOUND", "Пользователь не найден");
    }
    const next = before.balanceCredits + delta;
    if (next < 0) {
      throw new CreditServiceError(
        "INSUFFICIENT",
        "Списание сделало бы баланс отрицательным",
      );
    }
    const updated = await tx.user.update({
      where: { id: userId },
      data: { balanceCredits: next },
      select: { balanceCredits: true },
    });
    await tx.creditTransaction.create({
      data: {
        userId,
        type: "ADMIN_ADJUSTMENT",
        amount: delta,
        reason: reason.slice(0, 512),
        metadata: { byAdmin: adminUserId } as Prisma.InputJsonValue,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "user.credits_admin_adjustment",
        targetType: "User",
        targetId: userId,
        oldValue: { balanceCredits: before.balanceCredits } as Prisma.InputJsonValue,
        newValue: {
          balanceCredits: updated.balanceCredits,
          delta,
          reason: reason.slice(0, 512),
        } as Prisma.InputJsonValue,
      },
    });
    return { newBalance: updated.balanceCredits };
  });
}