
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
  generationMode?: "marketplace_card" | "marketplace_card_variants";
  templatePreset?: string;
  templateLayoutKey?: string;
  typographyPreset?: string;
  cardSize?: string;
  variantGroupId?: string;
  variantIndex?: number;
  variantCount?: number;
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

/** Состояние карточки-конструктора: отдельное дерево, не смешивать с marketplaceCard. */
export type CardBuilderSlideState = {
  slideId: string;
  generationId?: string | null;
  status?: string;
  errorMessage?: string | null;
};

export type CardBuilderProjectBucket = {
  settings?: Record<string, unknown>;
  galleryPlan?: unknown[];
  generations?: unknown[];
  slides?: Record<string, CardBuilderSlideState>;
  future?: {
    qualityScore?: number | null;
    marketplaceCompliance?: Record<string, unknown> | null;
    improvementSuggestions?: string[] | null;
  };
};

function getCardBuilderBucket(meta: Record<string, unknown>): CardBuilderProjectBucket {
  const raw = meta.cardBuilder;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as CardBuilderProjectBucket) };
  }
  return {};
}

export async function persistCardBuilderDraft(
  projectId: string,
  mutator: (prev: CardBuilderProjectBucket) => CardBuilderProjectBucket,
): Promise<void> {
  const p = await prisma.productCardProject.findUnique({ where: { id: projectId } });
  if (!p) return;
  const meta = (p.metadata as Record<string, unknown> | null) ?? {};
  const prev = getCardBuilderBucket(meta);
  const nextBucket = mutator(prev);
  const nextMeta = { ...meta, cardBuilder: nextBucket };
  await prisma.productCardProject.update({
    where: { id: projectId },
    data: { metadata: nextMeta as object },
  });
}

export async function recordCardBuilderSlideJob(
  projectId: string,
  slideId: string,
  patch: CardBuilderSlideState,
): Promise<void> {
  await persistCardBuilderDraft(projectId, (prev) => {
    const slides = { ...(prev.slides ?? {}) };
    slides[slideId] = { ...slides[slideId], ...patch, slideId };
    return { ...prev, slides };
  });
}

export async function appendCardBuilderGenerationRecord(
  projectId: string,
  row: {
    generationId: string;
    slideId: string;
    imageRole: string;
    mode: "single" | "gallery_bundle";
  },
): Promise<void> {
  await persistCardBuilderDraft(projectId, (prev) => {
    const list = Array.isArray(prev.generations) ? [...prev.generations] : [];
    list.push({
      ...row,
      createdAt: new Date().toISOString(),
    });
    return { ...prev, generations: list };
  });
}