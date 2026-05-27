import "server-only";

import {
  mergeCardBuilderBlock,
  readCardBuilderBlock,
  type CardBuilderProjectBlock,
  type CardBuilderSourceImage,
  type CardBuilderStoredSettings,
} from "@/server/services/productCardCardBuilderMeta";
import { assertUserOwnsFileUrl, getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";

export type { CardBuilderSourceImage } from "@/server/services/productCardCardBuilderMeta";

export function parseCardBuilderSourceImage(raw: unknown): CardBuilderSourceImage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim() : "";
  const fileId = typeof o.fileId === "string" ? o.fileId.trim() : "";
  if (!url || !fileId) return null;
  const out: CardBuilderSourceImage = { url, fileId };
  if (typeof o.fileName === "string" && o.fileName.trim()) out.fileName = o.fileName.trim();
  if (typeof o.size === "number" && Number.isFinite(o.size)) out.size = o.size;
  if (typeof o.updatedAt === "string" && o.updatedAt.trim()) out.updatedAt = o.updatedAt.trim();
  return out;
}

async function resolveProjectMainSourceImage(
  userId: string,
  projectId: string,
): Promise<{ ok: true; url: string; fileId: string } | { ok: false; error: string; status: number }> {
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }

  const sources = normalizeProductSourceImages(project);
  const main = sources[0];
  const url = main?.url?.trim() ?? project.sourceImageUrl?.trim() ?? "";
  const fileId = main?.fileId?.trim() ?? project.sourceImageFileId?.trim() ?? "";
  if (!url) {
    return {
      ok: false,
      error: "Загрузите фото для «Создать карточку»",
      status: 400,
    };
  }
  if (!(await assertUserOwnsFileUrl(userId, url))) {
    return { ok: false, error: "Нет доступа к файлу", status: 403 };
  }
  return { ok: true, url, fileId: fileId || url };
}

export async function resolveCardBuilderSourceImage(
  userId: string,
  projectId: string,
): Promise<{ ok: true; url: string; fileId: string } | { ok: false; error: string; status: number }> {
  const blk = await readCardBuilderBlock(projectId);
  const img = parseCardBuilderSourceImage(blk?.sourceImage);
  if (img) {
    if (!(await assertUserOwnsFileUrl(userId, img.url))) {
      return { ok: false, error: "Нет доступа к файлу", status: 403 };
    }
    return { ok: true, url: img.url, fileId: img.fileId };
  }

  return resolveProjectMainSourceImage(userId, projectId);
}

export async function resolveProjectSourceImageByFileId(
  userId: string,
  projectId: string,
  fileId: string,
): Promise<{ ok: true; url: string; fileId: string } | { ok: false; error: string; status: number }> {
  const id = fileId.trim();
  if (!id) {
    return { ok: false, error: "Укажите фото товара", status: 400 };
  }

  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }

  const sources = normalizeProductSourceImages(project);
  const match = sources.find((s) => s.fileId?.trim() === id);
  const url = match?.url?.trim() ?? "";
  if (url) {
    if (!(await assertUserOwnsFileUrl(userId, url))) {
      return { ok: false, error: "Нет доступа к файлу", status: 403 };
    }
    return { ok: true, url, fileId: id };
  }

  return resolveProjectMainSourceImage(userId, projectId);
}

export async function saveCardBuilderSourceImage(
  projectId: string,
  image: Omit<CardBuilderSourceImage, "updatedAt">,
): Promise<void> {
  const blk = await readCardBuilderBlock(projectId);
  const prevSettings: CardBuilderStoredSettings = blk?.settings ?? ({} as CardBuilderStoredSettings);

  const patch: Partial<CardBuilderProjectBlock> = {
    sourceImage: {
      ...image,
      updatedAt: new Date().toISOString(),
    },
    settings: {
      ...prevSettings,
      visionAnalysis: undefined,
      productFacts: [],
      updatedAt: new Date().toISOString(),
    },
  };

  await mergeCardBuilderBlock(projectId, patch);
}

export async function clearCardBuilderSourceImage(projectId: string): Promise<void> {
  const blk = await readCardBuilderBlock(projectId);
  const prevSettings: CardBuilderStoredSettings = blk?.settings ?? ({} as CardBuilderStoredSettings);

  await mergeCardBuilderBlock(projectId, {
    sourceImage: undefined,
    settings: {
      ...prevSettings,
      visionAnalysis: undefined,
      productFacts: [],
      updatedAt: new Date().toISOString(),
    },
  });
}
