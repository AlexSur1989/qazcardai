
import type { CreditTransactionType, PaymentStatus, UserTokenPackageStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { isRecord } from "@/lib/model-pricing-shared";
import { prisma } from "@/lib/prisma";
import { adminAdjustCredits } from "@/server/services/credits";

const SUCCESS_STATUSES: PaymentStatus[] = ["COMPLETED"];
const H24 = () => {
  const t = new Date();
  t.setTime(t.getTime() - 24 * 60 * 60 * 1000);
  return t;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function decToNumber(d: { toString(): string } | null | undefined): number {
  if (d == null) return 0;
  return Number.parseFloat(d.toString());
}

function extractInternalTokenValueKzt(ps: unknown): number | null {
  if (!isRecord(ps) || String(ps.type) !== "matrix") return null;
  const v = ps.internalTokenValueKzt;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return null;
}

function productCardPriceBreakdown(metadata: unknown):
  | { revenueKzt: number; providerCostKzt: number; marginKzt: number }
  | null {
  if (!isRecord(metadata) || metadata.pricingScope !== "PRODUCT_CARD") return null;
  const pb = metadata.priceBreakdown;
  if (!isRecord(pb)) return null;
  const revenueKzt = typeof pb.revenueKzt === "number" ? pb.revenueKzt : 0;
  const providerCostKzt = typeof pb.providerCostKzt === "number" ? pb.providerCostKzt : 0;
  const marginKzt =
    typeof pb.marginKzt === "number" ? pb.marginKzt : revenueKzt - providerCostKzt;
  return { revenueKzt, providerCostKzt, marginKzt };
}

export type FinanceSummary = {
  revenue: {
    today: number;
    last7Days: number;
    last30Days: number;
    allTime: number;
  };
  tokens: {
    purchased: number;
    spent: number;
    refunded: number;
    adminGranted: number;
    currentBalancesTotal: number;
  };
  generations: {
    completed24h: number;
    failed24h: number;
    tokensSpent24h: number;
    tokensRefunded24h: number;
  };
  margin: {
    estimatedProviderCostKzt: number | null;
    estimatedClientRevenueKzt: number | null;
    estimatedMarginKzt: number | null;
    estimatedMarginPercent: number | null;
  };
  productCard: {
    completed: number;
    tokens: number;
    revenueKzt: number;
    providerCostKzt: number;
    marginKzt: number;
    marginPercent: number | null;
  };
  recentPayments: {
    id: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    provider: string;
    credits: number;
    providerPaymentId: string | null;
    userId: string;
    userEmail: string;
    createdAt: string;
    paidAt: string | null;
    tokenPackageName: string | null;
    metadataMock: boolean | null;
  }[];
  recentCreditTransactions: {
    id: string;
    type: CreditTransactionType;
    amount: number;
    userId: string;
    userEmail: string;
    reason: string | null;
    createdAt: string;
  }[];
};

export async function getFinanceSummary(options?: {
  from?: Date;
  to?: Date;
}): Promise<FinanceSummary> {
  void options;
  const now = new Date();
  const d0 = startOfToday();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const h24 = H24();

  const [revToday, rev7, rev30, revAll, balAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: { in: SUCCESS_STATUSES }, createdAt: { gte: d0 } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: { in: SUCCESS_STATUSES }, createdAt: { gte: d7 } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: { in: SUCCESS_STATUSES }, createdAt: { gte: d30 } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: { in: SUCCESS_STATUSES } },
      _sum: { amount: true },
    }),
    prisma.user.aggregate({ _sum: { balanceCredits: true } }),
  ]);

  const [pur, resNeg, ref, adminPos] = await Promise.all([
    prisma.creditTransaction.aggregate({
      where: { type: "PURCHASE" },
      _sum: { amount: true },
    }),
    prisma.creditTransaction.aggregate({
      where: { type: "RESERVE" },
      _sum: { amount: true },
    }),
    prisma.creditTransaction.aggregate({
      where: { type: "REFUND" },
      _sum: { amount: true },
    }),
    prisma.creditTransaction.aggregate({
      where: { type: "ADMIN_ADJUSTMENT", amount: { gt: 0 } },
      _sum: { amount: true },
    }),
  ]);
  const promo = await prisma.creditTransaction.aggregate({
    where: { type: "PROMO" },
    _sum: { amount: true },
  });

  const purchased =
    (pur._sum.amount ?? 0) + (promo._sum.amount ?? 0);
  const reservedSum = resNeg._sum.amount ?? 0;
  const spent = reservedSum < 0 ? -reservedSum : 0;
  const refunded = ref._sum.amount ?? 0;
  const adminGranted = adminPos._sum.amount ?? 0;

  const [comp24, fail24, genSpent24, ref24] = await Promise.all([
    prisma.generation.count({
      where: { status: "COMPLETED", completedAt: { gte: h24 } },
    }),
    prisma.generation.count({
      where: { status: "FAILED", updatedAt: { gte: h24 } },
    }),
    prisma.generation.aggregate({
      where: { status: "COMPLETED", completedAt: { gte: h24 } },
      _sum: { costCredits: true },
    }),
    prisma.creditTransaction.aggregate({
      where: { type: "REFUND", createdAt: { gte: h24 } },
      _sum: { amount: true },
    }),
  ]);

  const marginRows = await prisma.generation.findMany({
    where: { status: "COMPLETED" },
    take: 2000,
    orderBy: { completedAt: "desc" },
    select: {
      costCredits: true,
      metadata: true,
      model: { select: { pricingSchema: true, realCost: true } },
    },
  });
  let clientKzt = 0;
  let providerKzt: number | null = 0;
  let nClient = 0;
  let nProvider = 0;
  for (const g of marginRows) {
    const token = extractInternalTokenValueKzt(g.model?.pricingSchema);
    if (token != null) {
      clientKzt += g.costCredits * token;
      nClient += 1;
    }
    const rc = g.model?.realCost;
    if (rc != null) {
      const p = decToNumber(rc);
      if (p > 0) {
        providerKzt += p * g.costCredits;
        nProvider += 1;
      }
    }
  }
  if (nClient === 0) {
    clientKzt = 0;
  }
  if (nProvider === 0) {
    providerKzt = null;
  }
  const marginKzt =
    providerKzt != null && nClient > 0
      ? clientKzt - providerKzt
      : null;
  const marginPercent =
    marginKzt != null && providerKzt != null && providerKzt > 0
      ? (marginKzt / providerKzt) * 100
      : null;

  let pcCompleted = 0;
  let pcTokens = 0;
  let pcRevenueKzt = 0;
  let pcProviderCostKzt = 0;
  let pcMarginKzt = 0;
  for (const g of marginRows) {
    const pb = productCardPriceBreakdown(g.metadata);
    if (!pb) continue;
    pcCompleted += 1;
    pcTokens += g.costCredits;
    pcRevenueKzt += pb.revenueKzt;
    pcProviderCostKzt += pb.providerCostKzt;
    pcMarginKzt += pb.marginKzt;
  }
  const pcMarginPercent = pcRevenueKzt > 0 ? (pcMarginKzt / pcRevenueKzt) * 100 : null;

  const [recentPayments, recentTx] = await Promise.all([
    prisma.payment.findMany({
      where: { status: { in: SUCCESS_STATUSES } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        provider: true,
        credits: true,
        providerPaymentId: true,
        paidAt: true,
        metadata: true,
        tokenPackage: { select: { name: true } },
        userId: true,
        user: { select: { email: true } },
        createdAt: true,
      },
    }),
    prisma.creditTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        amount: true,
        userId: true,
        reason: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
  ]);

  return {
    revenue: {
      today: decToNumber(revToday._sum.amount),
      last7Days: decToNumber(rev7._sum.amount),
      last30Days: decToNumber(rev30._sum.amount),
      allTime: decToNumber(revAll._sum.amount),
    },
    tokens: {
      purchased,
      spent,
      refunded,
      adminGranted,
      currentBalancesTotal: balAgg._sum.balanceCredits ?? 0,
    },
    generations: {
      completed24h: comp24,
      failed24h: fail24,
      tokensSpent24h: genSpent24._sum.costCredits ?? 0,
      tokensRefunded24h: ref24._sum.amount ?? 0,
    },
    margin: {
      estimatedProviderCostKzt: providerKzt,
      estimatedClientRevenueKzt: nClient > 0 ? clientKzt : null,
      estimatedMarginKzt: marginKzt,
      estimatedMarginPercent: marginPercent,
    },
    productCard: {
      completed: pcCompleted,
      tokens: pcTokens,
      revenueKzt: pcRevenueKzt,
      providerCostKzt: pcProviderCostKzt,
      marginKzt: pcMarginKzt,
      marginPercent: pcMarginPercent,
    },
    recentPayments: recentPayments.map((p) => {
      const meta =
        p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
          ? (p.metadata as Record<string, unknown>)
          : null;
      const metadataMock = meta && typeof meta.mock === "boolean" ? meta.mock : null;
      return {
        id: p.id,
        amount: decToNumber(p.amount),
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        credits: p.credits,
        providerPaymentId: p.providerPaymentId,
        userId: p.userId,
        userEmail: p.user.email,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
        tokenPackageName: p.tokenPackage?.name ?? null,
        metadataMock,
      };
    }),
    recentCreditTransactions: recentTx.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      userId: t.userId,
      userEmail: t.user.email,
      reason: t.reason,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export type CreditTxFilter = {
  page?: number;
  pageSize?: number;
  type?: CreditTransactionType;
  userEmail?: string;
  userId?: string;
  generationId?: string;
  paymentId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
};

export async function getCreditTransactionList(f: CreditTxFilter) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 20));
  const where: Prisma.CreditTransactionWhereInput = {};
  if (f.type) where.type = f.type;
  if (f.userId) where.userId = f.userId;
  if (f.generationId) where.generationId = f.generationId;
  if (f.paymentId) where.paymentId = f.paymentId;
  if (f.userEmail?.trim()) {
    where.user = {
      email: { contains: f.userEmail.trim(), mode: "insensitive" },
    };
  }
  if (f.dateFrom || f.dateTo) {
    where.createdAt = {};
    if (f.dateFrom) where.createdAt.gte = f.dateFrom;
    if (f.dateTo) where.createdAt.lte = f.dateTo;
  }
  if (f.amountMin != null || f.amountMax != null) {
    where.amount = {};
    if (f.amountMin != null) where.amount.gte = f.amountMin;
    if (f.amountMax != null) where.amount.lte = f.amountMax;
  }
  const [total, items] = await Promise.all([
    prisma.creditTransaction.count({ where }),
    prisma.creditTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        amount: true,
        reason: true,
        metadata: true,
        createdAt: true,
        userId: true,
        generationId: true,
        paymentId: true,
        user: { select: { email: true } },
      },
    }),
  ]);
  return { total, page, pageSize, items };
}

export type UserFinanceSummary = {
  balanceCredits: number;
  totals: {
    purchased: number;
    spent: number;
    refunded: number;
    adminGranted: number;
  };
  lastPayment: {
    id: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    createdAt: string;
  } | null;
  lastPackage: {
    id: string;
    packageName: string;
    totalTokens: number;
    priceKzt: number;
    status: UserTokenPackageStatus;
    purchasedAt: string;
  } | null;
  recentTransactions: {
    id: string;
    type: CreditTransactionType;
    amount: number;
    reason: string | null;
    createdAt: string;
    generationId: string | null;
    paymentId: string | null;
  }[];
};

export async function getUserFinanceSummary(
  userId: string,
): Promise<UserFinanceSummary | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { balanceCredits: true },
  });
  if (!u) return null;

  const [pur, res, ref, adminP, lastPay, lastPack, recent] = await Promise.all(
    [
      prisma.creditTransaction.aggregate({
        where: { userId, type: { in: ["PURCHASE", "PROMO"] } },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { userId, type: "RESERVE" },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { userId, type: "REFUND" },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { userId, type: "ADMIN_ADJUSTMENT", amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      prisma.payment.findFirst({
        where: { userId, status: { in: SUCCESS_STATUSES } },
        orderBy: { createdAt: "desc" },
        select: { id: true, amount: true, currency: true, status: true, createdAt: true },
      }),
      prisma.userTokenPackage.findFirst({
        where: { userId },
        orderBy: { purchasedAt: "desc" },
        select: {
          id: true,
          packageName: true,
          totalTokens: true,
          priceKzt: true,
          status: true,
          purchasedAt: true,
        },
      }),
      prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          amount: true,
          reason: true,
          createdAt: true,
          generationId: true,
          paymentId: true,
        },
      }),
    ],
  );
  const resSum = res._sum.amount ?? 0;
  return {
    balanceCredits: u.balanceCredits,
    totals: {
      purchased: pur._sum.amount ?? 0,
      spent: resSum < 0 ? -resSum : 0,
      refunded: ref._sum.amount ?? 0,
      adminGranted: adminP._sum.amount ?? 0,
    },
    lastPayment: lastPay
      ? {
          id: lastPay.id,
          amount: decToNumber(lastPay.amount),
          currency: lastPay.currency,
          status: lastPay.status,
          createdAt: lastPay.createdAt.toISOString(),
        }
      : null,
    lastPackage: lastPack
      ? {
          id: lastPack.id,
          packageName: lastPack.packageName,
          totalTokens: lastPack.totalTokens,
          priceKzt: lastPack.priceKzt,
          status: lastPack.status,
          purchasedAt: lastPack.purchasedAt.toISOString(),
        }
      : null,
    recentTransactions: recent.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      reason: t.reason,
      createdAt: t.createdAt.toISOString(),
      generationId: t.generationId,
      paymentId: t.paymentId,
    })),
  };
}

export async function adjustUserCreditsApi(args: {
  adminUserId: string;
  userId: string;
  amount: number;
  reason: string;
}): Promise<{ newBalance: number }> {
  return adminAdjustCredits({
    userId: args.userId,
    adminUserId: args.adminUserId,
    delta: args.amount,
    reason: args.reason,
  });
}
