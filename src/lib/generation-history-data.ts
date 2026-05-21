import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { GenerationStatus, GenerationType } from "@/generated/prisma/enums";
import {
  serializeGenerationForUser,
  serializeGenerationListItemForUser,
  type UserFacingGenerationDetail,
  type UserFacingHistoryListItem,
} from "@/lib/generation-display";
import { fixUtf8MojibakeDisplay } from "@/lib/fix-utf8-mojibake-display";
import { prisma } from "@/lib/prisma";

export type { UserFacingGenerationDetail, UserFacingHistoryListItem } from "@/lib/generation-display";

const HISTORY_LIMIT = 100;

export type UserHistoryFilters = {
  type?: GenerationType;
  status?: GenerationStatus;
  /** Подстрока в prompt (без регистра) */
  q?: string;
};

export type UserHistoryListResult =
  | { ok: true; items: UserFacingHistoryListItem[] }
  | { ok: false; error: "not_found" | "database" };

function buildWhere(
  userId: string,
  filters: UserHistoryFilters,
): Prisma.GenerationWhereInput {
  return {
    userId,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q?.trim()
      ? {
          prompt: {
            contains: filters.q.trim(),
            mode: "insensitive" as const,
          },
        }
      : {}),
  };
}

export async function getUserHistoryList(
  userId: string,
  filters: UserHistoryFilters = {},
): Promise<UserHistoryListResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return { ok: false, error: "not_found" };
    }
    const rows = await prisma.generation.findMany({
      where: buildWhere(userId, filters),
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
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
    const items = rows.map((g) =>
      serializeGenerationListItemForUser({
        id: g.id,
        type: g.type,
        status: g.status,
        costCredits: g.costCredits,
        createdAt: g.createdAt,
        outputFiles: g.outputFiles,
        metadata: g.metadata,
        model: g.model,
      }),
    );
    return { ok: true, items };
  } catch {
    return { ok: false, error: "database" };
  }
}

export type UserGenerationDetail = {
  id: string;
  userId: string;
  type: GenerationType;
  status: GenerationStatus;
  prompt: string;
  negativePrompt: string | null;
  inputFiles: unknown;
  outputFiles: unknown;
  metadata: unknown;
  errorMessage: string | null;
  costCredits: number;
  createdAt: Date;
  completedAt: Date | null;
  model: { id: string; name: string; slug: string };
  /** Только для админ-просмотра */
  providerTaskId?: string | null;
};

export type UserGenerationDetailResult =
  | { ok: true; generation: UserGenerationDetail }
  | { ok: false; error: "not_found" | "forbidden" | "database" };

export type UserFacingGenerationDetailResult =
  | { ok: true; generation: UserFacingGenerationDetail }
  | { ok: false; error: "not_found" | "forbidden" | "database" };

export async function getUserFacingGenerationDetail(
  userId: string,
  id: string,
): Promise<UserFacingGenerationDetailResult> {
  const res = await getUserGenerationDetail(userId, id);
  if (!res.ok) {
    return res;
  }
  const g = res.generation;
  return {
    ok: true,
    generation: serializeGenerationForUser({
      id: g.id,
      type: g.type,
      status: g.status,
      costCredits: g.costCredits,
      createdAt: g.createdAt,
      completedAt: g.completedAt,
      outputFiles: g.outputFiles,
      metadata: g.metadata,
      errorMessage: g.errorMessage,
      model: g.model,
    }),
  };
}

export async function getUserGenerationDetail(
  userId: string,
  id: string,
): Promise<UserGenerationDetailResult> {
  try {
    const g = await prisma.generation.findFirst({
      where: { id, userId },
      include: {
        model: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!g) {
      return { ok: false, error: "not_found" };
    }
    return {
      ok: true,
      generation: {
        id: g.id,
        userId: g.userId,
        type: g.type,
        status: g.status,
        prompt: g.prompt,
        negativePrompt: g.negativePrompt,
        inputFiles: g.inputFiles,
        outputFiles: g.outputFiles,
        metadata: g.metadata,
        errorMessage: fixUtf8MojibakeDisplay(g.errorMessage),
        costCredits: g.costCredits,
        createdAt: g.createdAt,
        completedAt: g.completedAt,
        model: g.model,
      },
    };
  } catch {
    return { ok: false, error: "database" };
  }
}
