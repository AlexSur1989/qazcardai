import "server-only";

import type { ProductCardProject } from "@/generated/prisma/client";
import {
  assertUserOwnsFileUrl,
  getCompletedGenerationImageUrlForUser,
  getConceptGenerationImageUrlForMarketplace,
  getMarketplaceCardTabGenerationImageUrl,
} from "@/server/services/productCardProjectAccess";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";

export type SourceKind = "original" | "generated_concept" | "generated_card";

export type MarketplaceImageSource = "original" | "concept_generation";

export async function resolveProductStillImageUrl(
  userId: string,
  project: ProductCardProject,
  sourceType: SourceKind,
  sourceGenerationId: string | null | undefined,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (sourceType === "original") {
    const u = normalizeProductSourceImages(project)[0]?.url ?? project.sourceImageUrl?.trim();
    if (!u) {
      return { ok: false, message: "Загрузите исходное фото товара." };
    }
    const own = await assertUserOwnsFileUrl(userId, u);
    if (!own) {
      return { ok: false, message: "Нет доступа к исходному изображению." };
    }
    return { ok: true, url: u };
  }
  if (!sourceGenerationId?.trim()) {
    return { ok: false, message: "Укажите сгенерированное изображение." };
  }
  const url = await getCompletedGenerationImageUrlForUser(userId, sourceGenerationId.trim());
  if (!url) {
    return { ok: false, message: "Генерация не найдена или ещё не готова." };
  }
  return { ok: true, url };
}

/** Источник миниатюры для вкладки «Карточка товара» (MVP: original | concept). */
export async function resolveMarketplaceCardSource(
  userId: string,
  project: ProductCardProject,
  sourceType: MarketplaceImageSource,
  sourceGenerationId: string | null | undefined,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (sourceType === "original") {
    const u = normalizeProductSourceImages(project)[0]?.url ?? project.sourceImageUrl?.trim();
    if (!u) {
      return { ok: false, message: "Загрузите исходное фото" };
    }
    if (!(await assertUserOwnsFileUrl(userId, u))) {
      return { ok: false, message: "Нет доступа к исходному фото" };
    }
    return { ok: true, url: u };
  }
  if (sourceType === "concept_generation") {
    if (!sourceGenerationId?.trim()) {
      return { ok: false, message: "Выберите сгенерированное фото" };
    }
    const r = await getConceptGenerationImageUrlForMarketplace(
      userId,
      project.id,
      sourceGenerationId.trim(),
    );
    if (!r.ok) {
      return { ok: false, message: r.message };
    }
    return { ok: true, url: r.url };
  }
  return { ok: false, message: "Некорректный источник" };
}

export type ProductVideoImageSourceType =
  | "original"
  | "concept_generation"
  | "marketplace_card_generation";

/**
 * Кадр для product-card video: исходник, concept IMAGE или marketplace_card IMAGE.
 */
export async function resolveProductVideoImageSource(
  userId: string,
  project: ProductCardProject,
  sourceType: ProductVideoImageSourceType,
  sourceGenerationId: string | null | undefined,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (sourceType === "original") {
    const u = normalizeProductSourceImages(project)[0]?.url ?? project.sourceImageUrl?.trim();
    if (!u) {
      return { ok: false, message: "Загрузите исходное фото товара" };
    }
    if (!(await assertUserOwnsFileUrl(userId, u))) {
      return { ok: false, message: "Нет доступа к исходному фото" };
    }
    return { ok: true, url: u };
  }
  if (!sourceGenerationId?.trim()) {
    return { ok: false, message: "Укажите сгенерированное изображение" };
  }
  if (sourceType === "concept_generation") {
    const r = await getConceptGenerationImageUrlForMarketplace(
      userId,
      project.id,
      sourceGenerationId.trim(),
    );
    if (!r.ok) {
      return { ok: false, message: r.message };
    }
    return { ok: true, url: r.url };
  }
  if (sourceType === "marketplace_card_generation") {
    const r = await getMarketplaceCardTabGenerationImageUrl(
      userId,
      project.id,
      sourceGenerationId.trim(),
    );
    if (!r.ok) {
      return { ok: false, message: r.message };
    }
    return { ok: true, url: r.url };
  }
  return { ok: false, message: "Некорректный источник" };
}
