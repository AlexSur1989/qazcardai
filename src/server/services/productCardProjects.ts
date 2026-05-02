
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PRODUCT_CATEGORY_IDS } from "@/config/product-card-categories";

const CATEGORY_SET = new Set<string>(PRODUCT_CATEGORY_IDS as readonly string[]);
const SOURCE_IMAGE_ROLES = ["main", "side", "back", "detail"] as const;
const SOURCE_IMAGE_ROLE_SET = new Set<string>(SOURCE_IMAGE_ROLES);
const MAX_SOURCE_IMAGES = 4;

export type ProductSourceImageRole = (typeof SOURCE_IMAGE_ROLES)[number];

export type ProductSourceImage = {
  fileId: string | null;
  url: string;
  role: ProductSourceImageRole;
  order: number;
};

export type ProductSourceImageInput = {
  fileId: string;
  role: ProductSourceImageRole;
  order: number;
};

function assertValidCategoryId(id: string | null | undefined): void {
  if (id == null || id === "") return;
  if (!CATEGORY_SET.has(id)) {
    throw new Error("РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ РєР°С‚РµРіРѕСЂРёСЏ С‚РѕРІР°СЂР°");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorWithCode(message: string, code: string): Error & { code?: string } {
  const err = new Error(message) as Error & { code?: string };
  err.code = code;
  return err;
}

function isSourceImageRole(value: unknown): value is ProductSourceImageRole {
  return typeof value === "string" && SOURCE_IMAGE_ROLE_SET.has(value);
}

function isValidStoredFileUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/api/files/") || trimmed.startsWith("/storage/")) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") return true;
    if (process.env.NODE_ENV !== "production" && parsed.protocol === "http:") {
      return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    }
    return false;
  } catch {
    return false;
  }
}

function sourceImageFromUnknown(value: unknown): ProductSourceImage | null {
  if (!isRecord(value)) return null;
  const url = typeof value.url === "string" ? value.url.trim() : "";
  const role = value.role;
  const order = value.order;
  if (!url || !isSourceImageRole(role) || typeof order !== "number") {
    return null;
  }
  if (!Number.isInteger(order) || order < 0 || order >= MAX_SOURCE_IMAGES) {
    return null;
  }
  const fileId = typeof value.fileId === "string" && value.fileId.trim() !== ""
    ? value.fileId.trim()
    : null;
  return { fileId, url, role, order };
}

export function normalizeProductSourceImages(project: {
  sourceImages?: unknown;
  sourceImageFileId?: string | null;
  sourceImageUrl?: string | null;
}): ProductSourceImage[] {
  if (Array.isArray(project.sourceImages)) {
    const parsed = project.sourceImages
      .map(sourceImageFromUnknown)
      .filter((x): x is ProductSourceImage => x != null)
      .sort((a, b) => a.order - b.order)
      .slice(0, MAX_SOURCE_IMAGES);
    if (parsed.length > 0 && parsed[0]?.role === "main") {
      return parsed;
    }
  }

  const url = project.sourceImageUrl?.trim() ?? "";
  if (!url) return [];
  return [
    {
      fileId: project.sourceImageFileId?.trim() || null,
      url,
      role: "main",
      order: 0,
    },
  ];
}

export type CreateProductCardProjectInput = {
  title?: string | null;
};

export type UpdateProductCardProjectInput = {
  title?: string | null;
  selectedCategory?: string | null;
  categorySource?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/**
 * РЎРѕР·РґР°С‚СЊ РїСѓСЃС‚РѕР№ РїСЂРѕРµРєС‚ (Р±РµР· РёСЃС…РѕРґРЅРѕРіРѕ С„РѕС‚Рѕ; С„РѕС‚Рѕ вЂ” РѕС‚РґРµР»СЊРЅС‹Рј attach).
 */
export async function createProductCardProject(
  userId: string,
  input: CreateProductCardProjectInput = {},
) {
  return prisma.productCardProject.create({
    data: {
      userId,
      title: input.title ?? null,
      status: "DRAFT",
    },
  });
}

export async function getProductCardProject(userId: string, projectId: string) {
  const p = await prisma.productCardProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!p) {
    const err = new Error("РџСЂРѕРµРєС‚ РЅРµ РЅР°Р№РґРµРЅ");
    (err as Error & { code?: string }).code = "NOT_FOUND";
    throw err;
  }
  return p;
}

export async function updateProductCardProject(
  userId: string,
  projectId: string,
  input: UpdateProductCardProjectInput,
) {
  await getProductCardProject(userId, projectId);
  if (input.selectedCategory != null) {
    assertValidCategoryId(input.selectedCategory);
  }
  const data: Prisma.ProductCardProjectUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.selectedCategory !== undefined) data.selectedCategory = input.selectedCategory;
  if (input.categorySource !== undefined) data.categorySource = input.categorySource;
  if (input.metadata !== undefined) data.metadata = input.metadata;
  return prisma.productCardProject.update({
    where: { id: projectId },
    data,
  });
}

const IMAGE_FILE_TYPES = new Set(["image"]);

/** РњРѕРґРµР»СЊ/СЃС‚СЂРѕРєР° id вЂ” РґР»СЏ СЃРёРіРЅР°С‚СѓСЂС‹ В«uploadedFileВ» РёР· СЃРїРµС†РёС„РёРєР°С†РёРё. */
export type SourceUploadedFileInput =
  | string
  | { id: string; userId: string; fileType: string; url: string | null };

/**
 * РџСЂРёРІСЏР·Р°С‚СЊ СЂР°РЅРµРµ Р·Р°РіСЂСѓР¶РµРЅРЅС‹Р№ С„Р°Р№Р» Рє РїСЂРѕРµРєС‚Сѓ: С‚РѕР»СЊРєРѕ СЃРІРѕР№ С„Р°Р№Р», С‚РѕР»СЊРєРѕ РёР·РѕР±СЂР°Р¶РµРЅРёРµ.
 * РњРѕР¶РЅРѕ РїРµСЂРµРґР°С‚СЊ `id` РёР»Рё РѕР±СЉРµРєС‚ СЃ id/userId (userId СЃРІРµСЂСЏРµС‚СЃСЏ).
 */
export async function attachSourceImageToProject(
  userId: string,
  projectId: string,
  uploadedFile: SourceUploadedFileInput,
) {
  const fileId = typeof uploadedFile === "string" ? uploadedFile : uploadedFile.id;
  if (typeof uploadedFile === "object" && uploadedFile.userId !== userId) {
    throw errorWithCode(
      "Р¤Р°Р№Р» РЅРµ РЅР°Р№РґРµРЅ РёР»Рё РїСЂРёРЅР°РґР»РµР¶РёС‚ РґСЂСѓРіРѕРјСѓ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ",
      "FILE_FORBIDDEN",
    );
  }
  return updateProductSourceImages({
    userId,
    projectId,
    images: [{ fileId, role: "main", order: 0 }],
  });
}

export async function updateProductSourceImages(input: {
  userId: string;
  projectId: string;
  images: ProductSourceImageInput[];
}) {
  const { userId, projectId, images } = input;
  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_SOURCE_IMAGES) {
    throw errorWithCode("Р”РѕР±Р°РІСЊС‚Рµ РѕС‚ 1 РґРѕ 4 С„РѕС‚Рѕ С‚РѕРІР°СЂР°.", "INVALID_SOURCE_IMAGES");
  }

  const sorted = [...images].sort((a, b) => a.order - b.order);
  if (sorted[0]?.role !== "main" || sorted[0]?.order !== 0) {
    throw errorWithCode("РџРµСЂРІРѕРµ С„РѕС‚Рѕ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РіР»Р°РІРЅС‹Рј.", "MAIN_REQUIRED");
  }

  const seenOrders = new Set<number>();
  const seenRoles = new Set<string>();
  for (const img of sorted) {
    if (!isSourceImageRole(img.role)) {
      throw errorWithCode("РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ СЂРѕР»СЊ С„РѕС‚Рѕ.", "INVALID_ROLE");
    }
    if (!Number.isInteger(img.order) || img.order < 0 || img.order >= MAX_SOURCE_IMAGES) {
      throw errorWithCode("РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РїРѕСЂСЏРґРѕРє С„РѕС‚Рѕ.", "INVALID_ORDER");
    }
    if (seenOrders.has(img.order)) {
      throw errorWithCode("РџРѕСЂСЏРґРѕРє С„РѕС‚Рѕ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ СѓРЅРёРєР°Р»СЊРЅС‹Рј.", "DUPLICATE_ORDER");
    }
    if (seenRoles.has(img.role)) {
      throw errorWithCode("Р РѕР»Рё С„РѕС‚Рѕ РЅРµ РґРѕР»Р¶РЅС‹ РїРѕРІС‚РѕСЂСЏС‚СЊСЃСЏ.", "DUPLICATE_ROLE");
    }
    if (typeof img.fileId !== "string" || img.fileId.trim() === "") {
      throw errorWithCode("РЈРєР°Р¶РёС‚Рµ fileId РґР»СЏ РєР°Р¶РґРѕРіРѕ С„РѕС‚Рѕ.", "INVALID_FILE_ID");
    }
    seenOrders.add(img.order);
    seenRoles.add(img.role);
  }

  await getProductCardProject(userId, projectId);

  const fileIds = sorted.map((img) => img.fileId.trim());
  const files = await prisma.uploadedFile.findMany({
    where: { id: { in: fileIds }, userId },
  });
  const byId = new Map(files.map((file) => [file.id, file]));

  const normalized: ProductSourceImage[] = sorted.map((img) => {
    const file = byId.get(img.fileId.trim());
    if (!file) {
      throw errorWithCode(
        "Uploaded file not found or unavailable",
        "UPLOADED_FILE_NOT_FOUND",
      );
    }
    if (!IMAGE_FILE_TYPES.has(file.fileType) && !file.mimeType.toLowerCase().startsWith("image/")) {
      throw errorWithCode("РќСѓР¶РµРЅ С„Р°Р№Р»-РёР·РѕР±СЂР°Р¶РµРЅРёРµ", "NOT_IMAGE");
    }
    const publicUrl = file.url?.trim() ?? "";
    if (!publicUrl || !isValidStoredFileUrl(publicUrl)) {
      throw errorWithCode(
        "Uploaded file URL is invalid. Please upload the image again.",
        "INVALID_UPLOADED_FILE_URL",
      );
    }
    return {
      fileId: file.id,
      url: publicUrl,
      role: img.role,
      order: img.order,
    };
  });

  const main = normalized[0];
  return prisma.productCardProject.update({
    where: { id: projectId },
    data: {
      sourceImageFileId: main.fileId,
      sourceImageUrl: main.url,
      sourceImages: normalized as unknown as Prisma.InputJsonValue,
    },
  });
}

export type SetProjectCategoryInput = {
  selectedCategory: string;
  categorySource: "manual" | "ai" | "mock";
  detectedCategory?: string | null;
  classificationConfidence?: number | null;
  classificationReason?: string | null;
};

export async function setProjectCategory(
  userId: string,
  projectId: string,
  input: SetProjectCategoryInput,
) {
  assertValidCategoryId(input.selectedCategory);
  if (input.detectedCategory != null) {
    assertValidCategoryId(input.detectedCategory);
  }
  await getProductCardProject(userId, projectId);
  return prisma.productCardProject.update({
    where: { id: projectId },
    data: {
      selectedCategory: input.selectedCategory,
      categorySource: input.categorySource,
      ...(input.detectedCategory !== undefined
        ? { detectedCategory: input.detectedCategory }
        : {}),
      ...(input.classificationConfidence !== undefined
        ? { classificationConfidence: input.classificationConfidence }
        : {}),
      ...(input.classificationReason !== undefined
        ? { classificationReason: input.classificationReason }
        : {}),
    },
  });
}
