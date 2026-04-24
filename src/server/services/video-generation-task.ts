import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

export type VideoTaskScheduleResult = "enqueued" | "deferred";

/**
 * Выполнять из `after()` (Next.js) после ответа клиенту: не ждать завершения рендера.
 * Stage 9: сюда подключат Bull/Redis; при `redis`+очереди вернуть "enqueued".
 */
export async function followUpAfterVideoTaskCreated(
  generationId: string,
): Promise<VideoTaskScheduleResult> {
  const g = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { metadata: true },
  });
  if (!g) {
    return "deferred";
  }
  const prev = (g.metadata as Record<string, unknown> | null) ?? {};
  const next: Record<string, unknown> = {
    ...prev,
    task: "queued",
    /** false до Stage 9; воркер сможет выставлять true после job.add. */
    pushedToBull: false,
  };

  await prisma.generation.update({
    where: { id: generationId },
    data: { metadata: next as Prisma.InputJsonValue },
  });
  return "deferred";
}
