import type { Prisma } from "@/generated/prisma/client";
import type { SimpleProductCardRequest } from "@/lib/validations/simple-product-card";
import { prisma } from "@/lib/prisma";

export type SimpleCardStoredState = SimpleProductCardRequest & {
  productLabel?: string;
  updatedAt?: string;
  lastGenerationId?: string | null;
};

export type SimpleCardVisionSnapshot = {
  productPhotoId?: string;
  analyzedAt?: string;
  analysisFailed?: boolean;
  categoryKey?: string;
  productType?: string;
  productNameGuess?: string;
  mainColors?: string[];
  materialGuess?: string | null;
  styleGuess?: string | null;
  warnings?: string[];
};

export type SimpleCardBlock = {
  settings?: SimpleCardStoredState;
  vision?: SimpleCardVisionSnapshot;
  generations?: Array<{
    generationId: string;
    status?: string;
    createdAt?: string;
    finalUrl?: string;
  }>;
};

type ProjectMetadata = {
  marketplaceCard?: {
    simpleCard?: SimpleCardBlock;
    [key: string]: unknown;
  };
  /** @deprecated перенесено в marketplaceCard.simpleCard */
  cardBuilder?: {
    simpleCard?: SimpleCardBlock;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function readBlockFromMeta(meta: ProjectMetadata): SimpleCardBlock | null {
  return meta.marketplaceCard?.simpleCard ?? meta.cardBuilder?.simpleCard ?? null;
}

export async function readSimpleCardBlock(projectId: string): Promise<SimpleCardBlock | null> {
  const row = await prisma.productCardProject.findUnique({
    where: { id: projectId },
    select: { metadata: true },
  });
  const meta = (row?.metadata ?? {}) as ProjectMetadata;
  return readBlockFromMeta(meta);
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
  const prev = readBlockFromMeta(meta) ?? {};
  const next: SimpleCardBlock = {
    ...prev,
    ...patch,
    settings: patch.settings ?? prev.settings,
    vision: patch.vision ?? prev.vision,
    generations: patch.generations ?? prev.generations,
  };
  const marketplaceCard = { ...(meta.marketplaceCard ?? {}), simpleCard: next };
  await prisma.productCardProject.update({
    where: { id: projectId },
    data: {
      metadata: { ...meta, marketplaceCard } as Prisma.InputJsonValue,
    },
  });
}

export async function saveSimpleCardSettings(
  projectId: string,
  settings: SimpleProductCardRequest,
  extras?: { productLabel?: string },
): Promise<void> {
  await mergeSimpleCardBlock(projectId, {
    settings: {
      ...settings,
      ...(extras?.productLabel?.trim() ? { productLabel: extras.productLabel.trim() } : {}),
      updatedAt: new Date().toISOString(),
    },
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
