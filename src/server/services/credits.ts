
import type { CreditTransactionType } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { trySendLowBalanceEmail } from "@/server/services/notificationsIntegration";

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

/** РќР°С‡РёСЃР»РµРЅРёРµ РєСЂРµРґРёС‚РѕРІ Р·Р° РїРѕРєСѓРїРєСѓ РІРЅСѓС‚СЂРё С‚СЂР°РЅР·Р°РєС†РёРё (webhook Stripe Рё С‚.Рї.). */
export async function applyPurchaseInTransaction(
  tx: Prisma.TransactionClient,
  args: { userId: string; credits: number; paymentId: string; reason: string },
) {
  const { userId, credits, paymentId, reason } = args;
  if (credits <= 0 || !Number.isInteger(credits)) {
    throw new CreditServiceError("INVALID", "PURCHASE: РЅРµРІРµСЂРЅР°СЏ СЃСѓРјРјР° РєСЂРµРґРёС‚РѕРІ");
  }
  const user = await tx.user.update({
    where: { id: userId },
    data: { balanceCredits: { increment: credits } },
    select: { balanceCredits: true },
  });
  await tx.creditTransaction.create({
    data: {
      userId,
      type: "PURCHASE",
      amount: credits,
      reason: reason.slice(0, 512),
      paymentId,
    },
  });
  return { balance: user.balanceCredits };
}

/** РўРµРєСѓС‰РёР№ Р±Р°Р»Р°РЅСЃ (РґРµРЅРѕСЂРјР°Р»РёР·РѕРІР°РЅРЅРѕРµ РїРѕР»Рµ user.balanceCredits). */
export async function getBalance(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { balanceCredits: true },
  });
  if (!u) {
    throw new CreditServiceError("NOT_FOUND", "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");
  }
  return u.balanceCredits;
}

/**
 * РќР°С‡РёСЃР»РµРЅРёРµ РєСЂРµРґРёС‚РѕРІ (amount &gt; 0).
 * type: PURCHASE, PROMO РёР»Рё РїРѕ СЃРјС‹СЃР»Сѓ; РґР»СЏ РІРЅСѓС‚СЂРµРЅРЅРµРіРѕ Р±РѕРЅСѓСЃР° вЂ” PROMO.
 */
export async function addCredits(
  userId: string,
  amount: number,
  reason: string,
  type: CreditTransactionType = "PROMO",
  options?: { paymentId?: string; metadata?: unknown },
) {
  if (amount <= 0 || !Number.isInteger(amount)) {
    throw new CreditServiceError("INVALID", "РЎСѓРјРјР° РЅР°С‡РёСЃР»РµРЅРёСЏ вЂ” С†РµР»РѕРµ С‡РёСЃР»Рѕ > 0");
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
 * Р РµР·РµСЂРІ РїРѕРґ РіРµРЅРµСЂР°С†РёСЋ: СЃРїРёСЃС‹РІР°РµС‚ amount СЃ Р±Р°Р»Р°РЅСЃР°, РїРёС€РµС‚ RESERVE, СЃРІСЏР·С‹РІР°РµС‚ СЃ generationId.
 * amount вЂ” РїРѕР»РѕР¶РёС‚РµР»СЊРЅРѕРµ С‡РёСЃР»Рѕ (СЃРєРѕР»СЊРєРѕ РєСЂРµРґРёС‚РѕРІ Р·Р°СЂРµР·РµСЂРІРёСЂРѕРІР°РЅРѕ), РІ Р‘Р” РїРёС€РµРј amount РєР°Рє РѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕРµ РґРІРёР¶РµРЅРёРµ.
 */
export async function reserveCredits(
  userId: string,
  amount: number,
  generationId: string,
  reason = "Р РµР·РµСЂРІ РїРѕРґ РіРµРЅРµСЂР°С†РёСЋ",
) {
  if (amount <= 0 || !Number.isInteger(amount)) {
    throw new CreditServiceError("INVALID", "Р РµР·РµСЂРІ: С†РµР»РѕРµ amount > 0");
  }
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({
      where: { id: userId },
      select: { balanceCredits: true },
    });
    if (!u) {
      throw new CreditServiceError("NOT_FOUND", "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");
    }
    if (u.balanceCredits < amount) {
      throw new CreditServiceError(
        "INSUFFICIENT",
        "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РєСЂРµРґРёС‚РѕРІ",
      );
    }
    const existing = await tx.creditTransaction.findFirst({
      where: { generationId, type: "RESERVE" },
    });
    if (existing) {
      throw new CreditServiceError(
        "CONFLICT",
        "РџРѕ СЌС‚РѕР№ РіРµРЅРµСЂР°С†РёРё СЂРµР·РµСЂРІ СѓР¶Рµ СЃРѕР·РґР°РЅ",
      );
    }
    const user = await tx.user.update({
      where: { id: userId },
      data: { balanceCredits: { decrement: amount } },
      select: { balanceCredits: true },
    });
    if (user.balanceCredits < 0) {
      throw new CreditServiceError("INSUFFICIENT", "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РєСЂРµРґРёС‚РѕРІ");
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
  }).then((r) => {
    void trySendLowBalanceEmail(userId);
    return r;
  });
}

/**
 * РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ СЃРїРёСЃР°РЅРёСЏ: РїРѕСЃР»Рµ СѓСЃРїРµС…Р° РіРµРЅРµСЂР°С†РёРё. Р‘Р°Р»Р°РЅСЃ РЅРµ РјРµРЅСЏРµРј (СѓР¶Рµ СѓРјРµРЅСЊС€РµРЅ РїСЂРё RESERVE).
 */
export async function confirmCredits(generationId: string) {
  return prisma.$transaction(async (tx) => {
    const reserve = await tx.creditTransaction.findFirst({
      where: { generationId, type: "RESERVE" },
    });
    if (!reserve) {
      throw new CreditServiceError("NOT_FOUND", "РќРµС‚ RESERVE РїРѕ СЌС‚РѕР№ РіРµРЅРµСЂР°С†РёРё");
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
      throw new CreditServiceError("CONFLICT", "РЈР¶Рµ РІС‹РїРѕР»РЅРµРЅ РІРѕР·РІСЂР°С‚ РїРѕ СЌС‚РѕР№ РіРµРЅРµСЂР°С†РёРё");
    }
    await tx.creditTransaction.create({
      data: {
        userId: reserve.userId,
        generationId,
        type: "CAPTURE",
        amount: 0,
        reason: "РЎРїРёСЃР°РЅРёРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРѕ (СЂРµР·РµСЂРІ СЃРїРёСЃР°РЅ СЂР°РЅРµРµ)",
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
 * Р’РѕР·РІСЂР°С‚ Р·Р°СЂРµР·РµСЂРІРёСЂРѕРІР°РЅРЅС‹С… РєСЂРµРґРёС‚РѕРІ (РѕС€РёР±РєР° РїСЂРѕРІР°Р№РґРµСЂР° Рё С‚.Рї.).
 */
export async function refundCredits(generationId: string, reason = "Р’РѕР·РІСЂР°С‚: РѕС€РёР±РєР° РїСЂРѕРІР°Р№РґРµСЂР°") {
  return prisma.$transaction(async (tx) => {
    const reserve = await tx.creditTransaction.findFirst({
      where: { generationId, type: "RESERVE" },
    });
    if (!reserve) {
      throw new CreditServiceError("NOT_FOUND", "РќРµС‚ RESERVE РїРѕ СЌС‚РѕР№ РіРµРЅРµСЂР°С†РёРё");
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
        "Р’РѕР·РІСЂР°С‚ РЅРµРІРѕР·РјРѕР¶РµРЅ: РїРѕ РіРµРЅРµСЂР°С†РёРё СѓР¶Рµ РїРѕРґС‚РІРµСЂР¶РґС‘РЅРѕ СЃРїРёСЃР°РЅРёРµ",
      );
    }
    const back = -reserve.amount;
    if (back <= 0) {
      throw new CreditServiceError("INVALID", "РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ СЃСѓРјРјР° РІРѕР·РІСЂР°С‚Р°");
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

/**
 * Р СѓС‡РЅРѕР№ РІРѕР·РІСЂР°С‚ Р·Р°СЂРµР·РµСЂРІРёСЂРѕРІР°РЅРЅС‹С… РєСЂРµРґРёС‚РѕРІ РїРѕ РіРµРЅРµСЂР°С†РёРё (Р°РґРјРёРЅ).
 * РџРёС€РµС‚ audit `generation.refunded` РІ С‚РѕР№ Р¶Рµ С‚СЂР°РЅР·Р°РєС†РёРё.
 */
export async function adminManualRefundGeneration(args: {
  generationId: string;
  adminUserId: string;
  reason: string;
}): Promise<{ balance: number; idempotent: boolean }> {
  const { generationId, adminUserId, reason } = args;
  const r = reason.trim().slice(0, 512) || "Р СѓС‡РЅРѕР№ РІРѕР·РІСЂР°С‚ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРј";

  return prisma.$transaction(async (tx) => {
    const reserve = await tx.creditTransaction.findFirst({
      where: { generationId, type: "RESERVE" },
    });
    if (!reserve) {
      throw new CreditServiceError("NOT_FOUND", "РќРµС‚ RESERVE РїРѕ СЌС‚РѕР№ РіРµРЅРµСЂР°С†РёРё");
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
        "Р’РѕР·РІСЂР°С‚ РЅРµРІРѕР·РјРѕР¶РµРЅ: РїРѕ РіРµРЅРµСЂР°С†РёРё СѓР¶Рµ РїРѕРґС‚РІРµСЂР¶РґС‘РЅРѕ СЃРїРёСЃР°РЅРёРµ",
      );
    }
    const back = -reserve.amount;
    if (back <= 0) {
      throw new CreditServiceError("INVALID", "РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ СЃСѓРјРјР° РІРѕР·РІСЂР°С‚Р°");
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
        reason: r,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "generation.refunded",
        targetType: "Generation",
        targetId: generationId,
        newValue: {
          refundedCredits: back,
          newBalance: user.balanceCredits,
          reason: r,
        } as Prisma.InputJsonValue,
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
 * Р СѓС‡РЅР°СЏ РєРѕСЂСЂРµРєС‚РёСЂРѕРІРєР° Р±Р°Р»Р°РЅСЃР° Р°РґРјРёРЅРѕРј. delta: + РЅР°С‡РёСЃР»РёС‚СЊ, в€’ СЃРїРёСЃР°С‚СЊ.
 * РџРёС€РµС‚ CreditTransaction (ADMIN_ADJUSTMENT) Рё AdminAuditLog.
 */
export async function adminAdjustCredits(args: {
  userId: string;
  adminUserId: string;
  delta: number;
  reason: string;
}): Promise<{ newBalance: number }> {
  const { userId, adminUserId, delta, reason } = args;
  if (!Number.isInteger(delta) || delta === 0) {
    throw new CreditServiceError("INVALID", "РЈРєР°Р¶РёС‚Рµ РЅРµРЅСѓР»РµРІРѕРµ С†РµР»РѕРµ delta");
  }
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: userId },
      select: { balanceCredits: true },
    });
    if (!before) {
      throw new CreditServiceError("NOT_FOUND", "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");
    }
    const next = before.balanceCredits + delta;
    if (next < 0) {
      throw new CreditServiceError(
        "INSUFFICIENT",
        "РЎРїРёСЃР°РЅРёРµ СЃРґРµР»Р°Р»Рѕ Р±С‹ Р±Р°Р»Р°РЅСЃ РѕС‚СЂРёС†Р°С‚РµР»СЊРЅС‹Рј",
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
        action: "USER_CREDITS_ADJUSTED",
        targetType: "User",
        targetId: userId,
        oldValue: { balanceCredits: before.balanceCredits } as Prisma.InputJsonValue,
        newValue: { balanceCredits: updated.balanceCredits } as Prisma.InputJsonValue,
        metadata: {
          amount: delta,
          reason: reason.slice(0, 300),
          oldBalance: before.balanceCredits,
          newBalance: updated.balanceCredits,
        } as Prisma.InputJsonValue,
      },
    });
    return { newBalance: updated.balanceCredits };
  });
}
