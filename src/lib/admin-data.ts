import { Prisma } from "@/generated/prisma/client";
import type {
  GenerationStatus,
  GenerationType,
  PaymentStatus,
} from "@/generated/prisma/enums";
import { KASPI_MANUAL_PAYMENT_PROVIDER } from "@/lib/kaspi-manual-config";
import { prisma } from "@/lib/prisma";
import { buildAdminPricingOverview } from "@/server/services/adminPricingOverview";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function hoursAgo24(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

const LIST_LIMIT = 50;
const ADMIN_GENERATIONS_LIMIT = 200;
const ADMIN_PAYMENTS_LIMIT = 200;
const SNAPSHOT = 5;

export type AdminOverviewOwnerWidgets = {
  pendingManualPayments: number;
  failedGenerations24h: number;
  revenueTodayKzt: number;
  newUsersToday: number;
  pricingWarnings: number | null;
};

export type AdminOverviewData = {
  counts: {
    users: number;
    generations: number;
    payments: number;
    activeModels: number;
  };
  ownerWidgets: AdminOverviewOwnerWidgets;
  recentApiErrors: {
    id: string;
    provider: string;
    endpoint: string;
    statusCode: number | null;
    errorMessage: string | null;
    createdAt: Date;
  }[];
  recentWebhooks: {
    id: string;
    provider: string;
    eventType: string;
    status: string;
    errorMessage: string | null;
    createdAt: Date;
  }[];
  recentAudit: {
    id: string;
    action: string;
    targetType: string;
    targetId: string | null;
    createdAt: Date;
    adminEmail: string;
  }[];
};

export type AdminDataResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "database" };

export type GetAdminOverviewOptions = {
  includePricingWarnings?: boolean;
};

export async function getAdminOverview(
  options: GetAdminOverviewOptions = {},
): Promise<AdminDataResult<AdminOverviewData>> {
  try {
    const d0 = startOfToday();
    const h24 = hoursAgo24();

    const [
      users,
      generations,
      payments,
      activeModels,
      pendingManualPayments,
      failedGenerations24h,
      revenueTodayAgg,
      newUsersToday,
      apiErrors,
      webhooks,
      audits,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.generation.count(),
        prisma.payment.count(),
        prisma.aiModel.count({ where: { isActive: true } }),
        prisma.payment.count({
          where: {
            provider: KASPI_MANUAL_PAYMENT_PROVIDER,
            status: { in: ["PENDING", "PROCESSING"] },
          },
        }),
        prisma.generation.count({
          where: { status: "FAILED", updatedAt: { gte: h24 } },
        }),
        prisma.payment.aggregate({
          where: { status: "COMPLETED", createdAt: { gte: d0 } },
          _sum: { amount: true },
        }),
        prisma.user.count({ where: { createdAt: { gte: d0 } } }),
        prisma.apiLog.findMany({
          where: {
            OR: [
              { errorMessage: { not: null } },
              { statusCode: { gte: 400 } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: SNAPSHOT,
          select: {
            id: true,
            provider: true,
            endpoint: true,
            statusCode: true,
            errorMessage: true,
            createdAt: true,
          },
        }),
        prisma.webhookEvent.findMany({
          orderBy: { createdAt: "desc" },
          take: SNAPSHOT,
          select: {
            id: true,
            provider: true,
            eventType: true,
            status: true,
            errorMessage: true,
            createdAt: true,
          },
        }),
        prisma.adminAuditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: SNAPSHOT,
          include: { admin: { select: { email: true } } },
        }),
      ]);

    let pricingWarnings: number | null = null;
    if (options.includePricingWarnings) {
      try {
        const pricingOverview = await buildAdminPricingOverview();
        pricingWarnings = pricingOverview.warnings.length;
      } catch {
        pricingWarnings = null;
      }
    }

    const revenueTodayRaw = revenueTodayAgg._sum.amount;
    const revenueTodayKzt =
      revenueTodayRaw != null ? Number(revenueTodayRaw) : 0;

    return {
      ok: true,
      data: {
        counts: {
          users,
          generations,
          payments,
          activeModels,
        },
        ownerWidgets: {
          pendingManualPayments,
          failedGenerations24h,
          revenueTodayKzt,
          newUsersToday,
          pricingWarnings,
        },
        recentApiErrors: apiErrors,
        recentWebhooks: webhooks,
        recentAudit: audits.map((a) => ({
          id: a.id,
          action: a.action,
          targetType: a.targetType,
          targetId: a.targetId,
          createdAt: a.createdAt,
          adminEmail: a.admin.email,
        })),
      },
    };
  } catch {
    return { ok: false, error: "database" };
  }
}

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  balanceCredits: number;
  createdAt: Date;
  /** Способ входа для фильтра: есть ли привязка Telegram. */
  hasTelegramIdentity?: boolean;
};

export type AdminUserIdentityRow = {
  id: string;
  provider: string;
  providerUserId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
};

export type AdminUserDetail = AdminUserSummary & {
  identities: AdminUserIdentityRow[];
};

export type AdminUsersListFilters = {
  /** credentials — нет identity telegram; telegram — есть. */
  loginProvider?: "credentials" | "telegram";
};

export async function getAdminUsersList(filters?: AdminUsersListFilters) {
  try {
    const where =
      filters?.loginProvider === "telegram"
        ? { identities: { some: { provider: "telegram" } } }
        : filters?.loginProvider === "credentials"
          ? { identities: { none: { provider: "telegram" } } }
          : undefined;

    const rows = await prisma.user.findMany({
      where,
      take: LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        balanceCredits: true,
        createdAt: true,
        identities: {
          where: { provider: "telegram" },
          select: { id: true },
          take: 1,
        },
      },
    });
    const mapped = rows.map((r) => {
      const { identities, ...rest } = r;
      return {
        ...rest,
        hasTelegramIdentity: identities.length > 0,
      };
    });
    return { ok: true as const, rows: mapped };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

export type AdminUserByIdResult =
  | { ok: true; user: AdminUserDetail }
  | { ok: false; error: "not_found" | "database" };

export async function getAdminUserById(
  id: string,
): Promise<AdminUserByIdResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        balanceCredits: true,
        createdAt: true,
        identities: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            provider: true,
            providerUserId: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) {
      return { ok: false, error: "not_found" };
    }
    const { identities, ...rest } = user;
    const hasTelegramIdentity = identities.some((i) => i.provider === "telegram");
    return {
      ok: true,
      user: {
        ...rest,
        hasTelegramIdentity,
        identities,
      },
    };
  } catch {
    return { ok: false, error: "database" };
  }
}

export async function getAdminModelsList() {
  try {
    const rows = await prisma.aiModel.findMany({
      take: LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        scope: true,
        productCardModelType: true,
        provider: true,
        apiModelId: true,
        isActive: true,
        isPublic: true,
        costCredits: true,
        createdAt: true,
        _count: { select: { generations: true } },
      },
    });
    return { ok: true as const, rows };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

export type AdminGenerationFilters = {
  userId?: string;
  type?: GenerationType;
  status?: GenerationStatus;
  modelId?: string;
  q?: string;
};

export async function getAdminGenerationsList(filters: AdminGenerationFilters = {}) {
  try {
    const where = {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.modelId ? { modelId: filters.modelId } : {}),
      ...(filters.q?.trim()
        ? {
            prompt: {
              contains: filters.q.trim(),
              mode: "insensitive" as const,
            },
          }
        : {}),
    };
    const rows = await prisma.generation.findMany({
      where,
      take: ADMIN_GENERATIONS_LIMIT,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true } },
        model: { select: { name: true, slug: true } },
      },
    });
    return { ok: true as const, rows };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

export async function getAdminGenerationById(id: string) {
  try {
    const g = await prisma.generation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        model: { select: { id: true, name: true, slug: true, type: true } },
      },
    });
    if (!g) {
      return { ok: false as const, error: "not_found" as const };
    }
    return { ok: true as const, generation: g };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

/** Для селектов на странице /admin/generations. */
export async function getAdminGenerationFilterOptions() {
  try {
    const [users, models] = await Promise.all([
      prisma.user.findMany({
        take: 300,
        orderBy: { email: "asc" },
        select: { id: true, email: true },
      }),
      prisma.aiModel.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, type: true, scope: true, productCardModelType: true },
      }),
    ]);
    return { ok: true as const, users, models };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

export type AdminPaymentFilters = {
  userId?: string;
  status?: PaymentStatus;
  provider?: string;
};

export async function getAdminPaymentsList(filters: AdminPaymentFilters = {}) {
  try {
    const where = {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.provider?.trim()
        ? { provider: filters.provider.trim() }
        : {}),
    };
    const rows = await prisma.payment.findMany({
      where,
      take: ADMIN_PAYMENTS_LIMIT,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true, id: true } },
        tokenPackage: { select: { id: true, name: true } },
      },
    });
    return { ok: true as const, rows };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

export type AdminPaymentWithDetail = Prisma.PaymentGetPayload<{
  include: {
    user: { select: { id: true; email: true } };
    tokenPackage: { select: { id: true; name: true } };
    creditTransactions: { orderBy: { createdAt: "desc" } };
  };
}>;

export type AdminPaymentDetailResult =
  | { ok: true; payment: AdminPaymentWithDetail }
  | { ok: false; error: "not_found" | "database" };

export async function getAdminPaymentById(id: string): Promise<AdminPaymentDetailResult> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        tokenPackage: { select: { id: true, name: true } },
        creditTransactions: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!payment) {
      return { ok: false, error: "not_found" };
    }
    return { ok: true, payment };
  } catch {
    return { ok: false, error: "database" };
  }
}

export async function getAdminPaymentFilterOptions() {
  try {
    const users = await prisma.user.findMany({
      take: 400,
      orderBy: { email: "asc" },
      select: { id: true, email: true },
    });
    return { ok: true as const, users };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

export async function getAdminPromoCodesList() {
  try {
    const rows = await prisma.promoCode.findMany({
      take: LIST_LIMIT,
      orderBy: { createdAt: "desc" },
    });
    return { ok: true as const, rows };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

export async function getAdminAppSettingsList() {
  try {
    const rows = await prisma.appSetting.findMany({
      take: LIST_LIMIT,
      orderBy: { key: "asc" },
      include: {
        editor: { select: { id: true, email: true } },
      },
    });
    return { ok: true as const, rows };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

export async function getAdminAppSettingById(id: string) {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { id },
      include: { editor: { select: { email: true } } },
    });
    if (!row) return { ok: false as const, error: "not_found" as const };
    return { ok: true as const, row };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

export async function getAdminApiLogsList() {
  try {
    const rows = await prisma.apiLog.findMany({
      take: LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        generationId: true,
        provider: true,
        endpoint: true,
        requestPayload: true,
        responsePayload: true,
        statusCode: true,
        errorMessage: true,
        createdAt: true,
      },
    });
    return { ok: true as const, rows };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

export async function getAdminWebhookEventsList() {
  try {
    const rows = await prisma.webhookEvent.findMany({
      take: LIST_LIMIT,
      orderBy: { createdAt: "desc" },
    });
    return { ok: true as const, rows };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

const AUDIT_PAGE_SIZE = 50;

export type AdminAuditLogListFilters = {
  action?: string;
  adminUserId?: string;
  targetType?: string;
  from?: string;
  to?: string;
  page?: number;
};

export async function getAdminAuditLogsList(filters: AdminAuditLogListFilters = {}) {
  try {
    const page = Math.max(1, filters.page ?? 1);
    const skip = (page - 1) * AUDIT_PAGE_SIZE;

    const where: Prisma.AdminAuditLogWhereInput = {};
    if (filters.action?.trim()) {
      where.action = { contains: filters.action.trim() };
    }
    if (filters.adminUserId?.trim()) {
      where.adminUserId = filters.adminUserId.trim();
    }
    if (filters.targetType?.trim()) {
      where.targetType = { contains: filters.targetType.trim() };
    }
    const fromD = filters.from?.trim() ? new Date(filters.from) : null;
    const toRaw = filters.to?.trim() ? new Date(filters.to) : null;
    if (fromD && !Number.isNaN(fromD.getTime())) {
      const toD = toRaw && !Number.isNaN(toRaw.getTime()) ? new Date(toRaw) : null;
      if (toD) {
        toD.setUTCHours(23, 59, 59, 999);
        where.createdAt = { gte: fromD, lte: toD };
      } else {
        where.createdAt = { gte: fromD };
      }
    } else if (toRaw && !Number.isNaN(toRaw.getTime())) {
      const toD = new Date(toRaw);
      toD.setUTCHours(23, 59, 59, 999);
      where.createdAt = { lte: toD };
    }

    const [rows, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        take: AUDIT_PAGE_SIZE,
        skip,
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { email: true } } },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return {
      ok: true as const,
      rows,
      total,
      page,
      pageSize: AUDIT_PAGE_SIZE,
    };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

export async function getAdminAdminsForFilter() {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      orderBy: { email: "asc" },
      select: { id: true, email: true },
    });
    return { ok: true as const, users };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

/** Ручной возврат: есть RESERVE, нет CAPTURE и REFUND. */
export async function getAdminGenerationRefundEligibility(generationId: string) {
  try {
    const [reserve, capture, refund] = await Promise.all([
      prisma.creditTransaction.findFirst({ where: { generationId, type: "RESERVE" } }),
      prisma.creditTransaction.findFirst({ where: { generationId, type: "CAPTURE" } }),
      prisma.creditTransaction.findFirst({ where: { generationId, type: "REFUND" } }),
    ]);
    return {
      ok: true as const,
      canRefund: Boolean(reserve && !capture && !refund),
    };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}
