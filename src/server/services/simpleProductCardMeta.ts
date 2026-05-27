import type { Prisma } from "@/generated/prisma/client";
import type { SimpleProductCardRequest } from "@/lib/validations/simple-product-card";
import { prisma } from "@/lib/prisma";

export type SimpleCardStoredState = SimpleProductCardRequest & {
  updatedAt?: string;
  lastGenerationId?: string | null;
};

export type SimpleCardBlock = {
  settings?: SimpleCardStoredState;
  generations?: Array<{
    generationId: string;
    status?: string;
    createdAt?: string;
    finalUrl?: string;
  }>;
};

type ProjectMetadata = {
  cardBuilder?: {
    simpleCard?: SimpleCardBlock;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export async function readSimpleCardBlock(projectId: string): Promise<SimpleCardBlock | null> {
  const row = await prisma.productCardProject.findUnique({
    where: { id: projectId },
    select: { metadata: true },
  });
  const meta = (row?.metadata ?? {}) as ProjectMetadata;
  return meta.cardBuilder?.simpleCard ?? null;
}

export async function mergeSimpleCardBlock(
  projectId: string,
  patch: Partial<SimpleCardBlock>,
): Promise<void> {
  const row = await prisma.productCardProject.findUnique({
    where: { id: projectId },
    select: { metadata: true },
  });
  const meta = (row?.metadata ?? {}) as ProjectMetadata;
  const prev = meta.cardBuilder?.simpleCard ?? {};
  const next: SimpleCardBlock = {
    ...prev,
    ...patch,
    settings: patch.settings ?? prev.settings,
    generations: patch.generations ?? prev.generations,
  };
  const cardBuilder = { ...(meta.cardBuilder ?? {}), simpleCard: next };
  await prisma.productCardProject.update({
    where: { id: projectId },
    data: {
      metadata: { ...meta, cardBuilder } as Prisma.InputJsonValue,
    },
  });
}

export async function saveSimpleCardSettings(
  projectId: string,
  settings: SimpleProductCardRequest,
): Promise<void> {
  await mergeSimpleCardBlock(projectId, {
    settings: { ...settings, updatedAt: new Date().toISOString() },
  });
}

export async function appendSimpleCardGeneration(
  projectId: string,
  entry: { generationId: string; status?: string },
): Promise<void> {
  const blk = (await readSimpleCardBlock(projectId)) ?? {};
  const generations = [...(blk.generations ?? [])];
  generations.unshift({
    generationId: entry.generationId,
    status: entry.status ?? "queued",
    createdAt: new Date().toISOString(),
  });
  await mergeSimpleCardBlock(projectId, {
    generations: generations.slice(0, 50),
    settings: blk.settings
      ? { ...blk.settings, lastGenerationId: entry.generationId, updatedAt: new Date().toISOString() }
      : blk.settings,
  });
}
