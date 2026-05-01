import "server-only";

import { prisma } from "@/lib/prisma";
import { getFirstOutputUrlFromJson } from "@/lib/product-card-output";

function metadataRecord(m: unknown): Record<string, unknown> {
  if (m && typeof m === "object" && !Array.isArray(m)) {
    return m as Record<string, unknown>;
  }
  return {};
}

export async function getOwnedProjectOrNull(
  userId: string,
  projectId: string,
) {
  return prisma.productCardProject.findFirst({
    where: { id: projectId, userId },
  });
}

export async function assertUserOwnsFileUrl(
  userId: string,
  url: string,
): Promise<boolean> {
  const u = url.trim();
  if (!u) return false;
  const row = await prisma.uploadedFile.findFirst({
    where: { userId, url: u },
  });
  return Boolean(row);
}

export async function getCompletedGenerationImageUrlForUser(
  userId: string,
  generationId: string,
): Promise<string | null> {
  const g = await prisma.generation.findFirst({
    where: {
      id: generationId,
      userId,
      type: "IMAGE",
      status: "COMPLETED",
    },
    select: { outputFiles: true },
  });
  if (!g) return null;
  return getFirstOutputUrlFromJson(g.outputFiles);
}

/**
 * URL выхода concept-генерации для «Карточка товара»:
 * владелец, проект, вкладка concept_photo; готовый output.
 */
export async function getConceptGenerationImageUrlForMarketplace(
  userId: string,
  projectId: string,
  sourceGenerationId: string,
): Promise<
  { ok: true; url: string; status: string } | { ok: false; message: string }
> {
  const g = await prisma.generation.findFirst({
    where: { id: sourceGenerationId, userId, type: "IMAGE" },
    select: { id: true, status: true, outputFiles: true, metadata: true },
  });
  if (!g) {
    return { ok: false, message: "Генерация не найдена" };
  }
  const meta = metadataRecord(g.metadata);
  if (meta.flow !== "product_card" || meta.projectId !== projectId) {
    return { ok: false, message: "Генерация не относится к этому проекту" };
  }
  if (meta.tab !== "concept_photo") {
    return { ok: false, message: "Можно выбрать только фото из вкладки «Фото с концепциями»" };
  }
  const url = getFirstOutputUrlFromJson(g.outputFiles);
  if (!url) {
    return { ok: false, message: "Результат ещё обрабатывается или недоступен" };
  }
  return { ok: true, url, status: g.status };
}

/**
 * URL выхода генерации «Карточка товара» (вкладка marketplace) для image-to-video.
 */
export async function getMarketplaceCardTabGenerationImageUrl(
  userId: string,
  projectId: string,
  sourceGenerationId: string,
): Promise<
  { ok: true; url: string; status: string } | { ok: false; message: string }
> {
  const g = await prisma.generation.findFirst({
    where: { id: sourceGenerationId, userId, type: "IMAGE" },
    select: { id: true, status: true, outputFiles: true, metadata: true },
  });
  if (!g) {
    return { ok: false, message: "Генерация не найдена" };
  }
  const meta = metadataRecord(g.metadata);
  if (meta.flow !== "product_card" || meta.projectId !== projectId) {
    return { ok: false, message: "Генерация не относится к этому проекту" };
  }
  if (meta.tab !== "marketplace_card") {
    return { ok: false, message: "Можно выбрать только из вкладки «Карточка товара»" };
  }
  const url = getFirstOutputUrlFromJson(g.outputFiles);
  if (!url) {
    return { ok: false, message: "Результат ещё обрабатывается или недоступен" };
  }
  return { ok: true, url, status: g.status };
}

export async function getCompletedGenerationVideoUrlForUser(
  userId: string,
  generationId: string,
): Promise<string | null> {
  const g = await prisma.generation.findFirst({
    where: {
      id: generationId,
      userId,
      type: "VIDEO",
      status: "COMPLETED",
    },
    select: { outputFiles: true },
  });
  if (!g) return null;
  return getFirstOutputUrlFromJson(g.outputFiles);
}
