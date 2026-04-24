import type { GenerationStatus, GenerationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const LIST_LIMIT = 50;
const ADMIN_GENERATIONS_LIMIT = 200;
const SNAPSHOT = 5;

export type AdminOverviewData = {
  counts: {
    users: number;
    generations: number;
    payments: number;
    activeModels: number;
  };
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

export async function getAdminOverview(): Promise<
  AdminDataResult<AdminOverviewData>
> {
  try {
    const [users, generations, payments, activeModels, apiErrors, webhooks, audits] =
      await Promise.all([
        prisma.user.count(),
        prisma.generation.count(),
        prisma.payment.count(),
        prisma.aiModel.count({ where: { isActive: true } }),
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

    return {
      ok: true,
      data: {
        counts: {
          users,
          generations,
          payments,
          activeModels,
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

export async function getAdminUsersList() {
  try {
    const rows = await prisma.user.findMany({
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
      },
    });
    return { ok: true as const, rows };
  } catch {
    return { ok: false as const, error: "database" as const };
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
};

export type AdminUserByIdResult =
  | { ok: true; user: AdminUserSummary }
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
      },
    });
    if (!user) {
      return { ok: false, error: "not_found" };
    }
    return { ok: true, user };
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
        provider: true,
        isActive: true,
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
        select: { id: true, name: true, slug: true, type: true },
      }),
    ]);
    return { ok: true as const, users, models };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}

export async function getAdminPaymentsList() {
  try {
    const rows = await prisma.payment.findMany({
      take: LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    });
    return { ok: true as const, rows };
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
    });
    return { ok: true as const, rows };
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

export async function getAdminAuditLogsList() {
  try {
    const rows = await prisma.adminAuditLog.findMany({
      take: LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      include: { admin: { select: { email: true } } },
    });
    return { ok: true as const, rows };
  } catch {
    return { ok: false as const, error: "database" as const };
  }
}
