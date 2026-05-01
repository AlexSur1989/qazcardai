import "server-only";

import { prisma } from "@/lib/prisma";

type MetaKey = "conceptGenerationIds" | "marketplaceGenerationIds" | "videoGenerationIds";

function pushId(arr: unknown, id: string): string[] {
  const a = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  if (!a.includes(id)) a.push(id);
  return a;
}

export type ConceptGenerationRecord = {
  generationId: string;
  categoryId: string;
  conceptId: string;
  createdAt: string;
};

export async function appendProjectGenerationId(
  projectId: string,
  key: MetaKey,
  generationId: string,
): Promise<void> {
  const p = await prisma.productCardProject.findUnique({ where: { id: projectId } });
  if (!p) return;
  const meta = (p.metadata as Record<string, unknown> | null) ?? {};
  const next = { ...meta, [key]: pushId(meta[key], generationId) };
  await prisma.productCardProject.update({
    where: { id: projectId },
    data: { metadata: next as object },
  });
}

/** Сохраняет привязку concept generation к проекту (MVP, variant A). */
export async function appendConceptGenerationEntry(
  projectId: string,
  entry: Omit<ConceptGenerationRecord, "createdAt">,
): Promise<void> {
  const p = await prisma.productCardProject.findUnique({ where: { id: projectId } });
  if (!p) return;
  const meta = (p.metadata as Record<string, unknown> | null) ?? {};
  const prev = Array.isArray(meta.conceptGenerations)
    ? (meta.conceptGenerations as unknown[])
    : [];
  const row: ConceptGenerationRecord = {
    ...entry,
    createdAt: new Date().toISOString(),
  };
  const next = {
    ...meta,
    conceptGenerations: [...prev, row],
  };
  await prisma.productCardProject.update({
    where: { id: projectId },
    data: { metadata: next as object },
  });
}

export type MarketplaceCardGenerationRecord = {
  generationId: string;
  sourceType: "original" | "concept_generation";
  sourceGenerationId: string | null;
  style: string;
  createdAt: string;
};

export async function appendMarketplaceCardGeneration(
  projectId: string,
  entry: Omit<MarketplaceCardGenerationRecord, "createdAt">,
): Promise<void> {
  const p = await prisma.productCardProject.findUnique({ where: { id: projectId } });
  if (!p) return;
  const meta = (p.metadata as Record<string, unknown> | null) ?? {};
  const prev = Array.isArray(meta.marketplaceCardGenerations)
    ? (meta.marketplaceCardGenerations as unknown[])
    : [];
  const row: MarketplaceCardGenerationRecord = {
    ...entry,
    createdAt: new Date().toISOString(),
  };
  const next = {
    ...meta,
    marketplaceCardGenerations: [...prev, row],
  };
  await prisma.productCardProject.update({
    where: { id: projectId },
    data: { metadata: next as object },
  });
}

export type ProductCardVideoGenerationRecord = {
  generationId: string;
  sourceType: "original" | "concept_generation" | "marketplace_card_generation";
  sourceGenerationId: string | null;
  duration: number;
  motionStyle: string;
  createdAt: string;
};

export async function appendVideoGenerationEntry(
  projectId: string,
  entry: Omit<ProductCardVideoGenerationRecord, "createdAt">,
): Promise<void> {
  const p = await prisma.productCardProject.findUnique({ where: { id: projectId } });
  if (!p) return;
  const meta = (p.metadata as Record<string, unknown> | null) ?? {};
  const prev = Array.isArray(meta.videoGenerations)
    ? (meta.videoGenerations as unknown[])
    : [];
  const row: ProductCardVideoGenerationRecord = {
    ...entry,
    createdAt: new Date().toISOString(),
  };
  const next = {
    ...meta,
    videoGenerations: [...prev, row],
  };
  await prisma.productCardProject.update({
    where: { id: projectId },
    data: { metadata: next as object },
  });
}
