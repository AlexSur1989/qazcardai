import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  CardBuilderGallerySlide,
  CardBuilderPlanInput,
} from "@/server/services/productCardBuilderPlan";

/** Состояние «Создать карточку» внутри ProductCardProject.metadata (изолированно от marketplace_card). */
export type CardBuilderStoredSettings = CardBuilderPlanInput & {
  updatedAt?: string;
};

export type CardBuilderGenerationEntry = {
  generationId: string;
  slideId: string;
  imageRole: string;
  templateId?: string;
  layoutPreset?: string;
  overlayApplied?: boolean;
  finalUrl?: string;
  createdAt: string;
  status?: "queued" | "done" | "error";
  /** Краткая причина сбоя для пользователя UI */
  errorMessage?: string;
};

export type CardBuilderProjectBlock = {
  settings?: CardBuilderStoredSettings;
  galleryPlan?: CardBuilderGallerySlide[];
  /** Поля на будущее */
  qualityScore?: number | null;
  marketplaceCompliance?: unknown;
  improvementSuggestions?: string[];
  generations?: CardBuilderGenerationEntry[];
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export async function readCardBuilderBlock(
  projectId: string,
): Promise<CardBuilderProjectBlock | null> {
  const p = await prisma.productCardProject.findUnique({
    where: { id: projectId },
    select: { metadata: true },
  });
  if (!p?.metadata || !isRecord(p.metadata)) return null;
  const raw = p.metadata.cardBuilder;
  if (!raw || !isRecord(raw)) return null;
  return raw as unknown as CardBuilderProjectBlock;
}

export async function mergeCardBuilderBlock(
  projectId: string,
  patch: Partial<CardBuilderProjectBlock>,
): Promise<void> {
  const p = await prisma.productCardProject.findUnique({ where: { id: projectId } });
  if (!p) return;
  const meta = (isRecord(p.metadata) ? { ...p.metadata } : {}) as Record<string, unknown>;
  const prev = isRecord(meta.cardBuilder)
    ? { ...(meta.cardBuilder as Record<string, unknown>) }
    : {};
  meta.cardBuilder = { ...prev, ...patch };
  await prisma.productCardProject.update({
    where: { id: projectId },
    data: { metadata: meta as Prisma.InputJsonValue },
  });
}

export async function saveCardBuilderSettingsAndPlan(
  projectId: string,
  settings: CardBuilderStoredSettings,
  galleryPlan: CardBuilderGallerySlide[],
): Promise<void> {
  await mergeCardBuilderBlock(projectId, {
    settings: { ...settings, updatedAt: new Date().toISOString() },
    galleryPlan,
  });
}

export async function patchCardBuilderGenerationEntry(
  projectId: string,
  generationId: string,
  patch: Partial<
    Pick<
      CardBuilderGenerationEntry,
      | "templateId"
      | "layoutPreset"
      | "overlayApplied"
      | "finalUrl"
      | "status"
      | "errorMessage"
    >
  >,
): Promise<void> {
  const p = await prisma.productCardProject.findUnique({ where: { id: projectId } });
  if (!p) return;
  const meta = (isRecord(p.metadata) ? { ...p.metadata } : {}) as Record<string, unknown>;
  const block: CardBuilderProjectBlock = isRecord(meta.cardBuilder)
    ? ({ ...(meta.cardBuilder as object) } as CardBuilderProjectBlock)
    : {};
  const gens = Array.isArray(block.generations) ? [...block.generations] : [];
  const idx = gens.findIndex((g) => g.generationId === generationId);
  if (idx < 0) return;
  gens[idx] = { ...gens[idx]!, ...patch };
  meta.cardBuilder = { ...block, generations: gens };
  await prisma.productCardProject.update({
    where: { id: projectId },
    data: { metadata: meta as Prisma.InputJsonValue },
  });
}

export async function appendCardBuilderGeneration(
  projectId: string,
  entry: Omit<CardBuilderGenerationEntry, "createdAt">,
): Promise<void> {
  const p = await prisma.productCardProject.findUnique({ where: { id: projectId } });
  if (!p) return;
  const meta = (isRecord(p.metadata) ? { ...p.metadata } : {}) as Record<string, unknown>;
  const block: CardBuilderProjectBlock = isRecord(meta.cardBuilder)
    ? ({ ...(meta.cardBuilder as object) } as CardBuilderProjectBlock)
    : {};
  const gens = Array.isArray(block.generations) ? [...block.generations] : [];
  gens.push({
    ...entry,
    createdAt: new Date().toISOString(),
  });
  meta.cardBuilder = { ...block, generations: gens };
  await prisma.productCardProject.update({
    where: { id: projectId },
    data: { metadata: meta as Prisma.InputJsonValue },
  });
}
