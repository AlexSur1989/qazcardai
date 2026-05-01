import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { GenerationStatus, GenerationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getFirstOutputPreviewUrl, parseOutputFilesList } from "@/lib/generation-output-utils";

const HISTORY_LIMIT = 100;

export type UserHistoryFilters = {
  type?: GenerationType;
  status?: GenerationStatus;
  /** Подстрока в prompt (без регистра) */
  q?: string;
};

export type UserHistoryListItem = {
  id: string;
  type: GenerationType;
  status: GenerationStatus;
  prompt: string;
  costCredits: number;
  createdAt: Date;
  model: { id: string; name: string; slug: string };
  previewUrl: string | null;
  /** Для кнопки скачать: готово и есть url/storageKey. */
  canDownload: boolean;
};

export type UserHistoryListResult =
  | { ok: true; items: UserHistoryListItem[] }
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
        prompt: true,
        costCredits: true,
        createdAt: true,
        outputFiles: true,
        model: { select: { id: true, name: true, slug: true } },
      },
    });
    const items: UserHistoryListItem[] = rows.map((g) => {
      const files = parseOutputFilesList(g.outputFiles);
      const canDownload =
        g.status === "COMPLETED" &&
        files.some((f) => Boolean(f.url?.trim() || f.storageKey));
      return {
        id: g.id,
        type: g.type,
        status: g.status,
        prompt: g.prompt,
        costCredits: g.costCredits,
        createdAt: g.createdAt,
        model: g.model,
        previewUrl: getFirstOutputPreviewUrl(g.outputFiles),
        canDownload,
      };
    });
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
        errorMessage: g.errorMessage,
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
