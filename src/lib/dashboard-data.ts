import type { GenerationStatus } from "@/generated/prisma/enums";
import {
  serializeGenerationListItemForUser,
  type UserFacingHistoryListItem,
} from "@/lib/generation-display";
import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES: GenerationStatus[] = [
  "CREATED",
  "QUEUED",
  "PROCESSING",
];

export type { UserFacingHistoryListItem as DashboardGenerationListItem } from "@/lib/generation-display";

export type UserPlanSummary = {
  name: string;
  slug: string;
};

export type DashboardSnapshot =
  | {
      ok: true;
      balanceCredits: number;
      /** Связи пользователь–тариф в схеме пока нет; null = нет отображаемого тарифа. */
      activePlan: UserPlanSummary | null;
      recent: UserFacingHistoryListItem[];
      active: UserFacingHistoryListItem[];
    }
  | { ok: false; error: "not_found" | "database" };

function fetchUserGenerations(
  userId: string,
  where: { status?: { in: GenerationStatus[] } },
  take: number,
) {
  return prisma.generation.findMany({
    where: { userId, ...where },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      status: true,
      costCredits: true,
      createdAt: true,
      outputFiles: true,
      metadata: true,
      model: { select: { id: true } },
    },
  });
}

type GenerationRow = Awaited<ReturnType<typeof fetchUserGenerations>>[number];

function mapGenerations(rows: GenerationRow[]): UserFacingHistoryListItem[] {
  return rows.map((g) => serializeGenerationListItemForUser(g));
}

/**
 * Только для текущего пользователя: баланс, последние и активные генерации.
 * Тариф: пока в БД нет привязки User↔Plan — всегда null, позже подставим из данных.
 */
export async function getDashboardSnapshot(
  userId: string,
): Promise<DashboardSnapshot> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, balanceCredits: true },
    });
    if (!user) {
      return { ok: false, error: "not_found" };
    }

    const [recentRows, activeRows] = await Promise.all([
      fetchUserGenerations(userId, {}, 5),
      fetchUserGenerations(
        userId,
        { status: { in: ACTIVE_STATUSES } },
        20,
      ),
    ]);

    return {
      ok: true,
      balanceCredits: user.balanceCredits,
      activePlan: null,
      recent: mapGenerations(recentRows),
      active: mapGenerations(activeRows),
    };
  } catch {
    return { ok: false, error: "database" };
  }
}

export type GenerationsListResult =
  | { ok: true; items: UserFacingHistoryListItem[] }
  | { ok: false; error: "not_found" | "database" };

/** Список генераций пользователя (только userId) для страницы истории. */
export async function getUserGenerationsList(
  userId: string,
  take = 50,
): Promise<GenerationsListResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return { ok: false, error: "not_found" };
    }
    const rows = await fetchUserGenerations(userId, {}, take);
    return { ok: true, items: mapGenerations(rows) };
  } catch {
    return { ok: false, error: "database" };
  }
}
