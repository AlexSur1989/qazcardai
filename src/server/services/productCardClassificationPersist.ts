import type { ProductCardProject } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ClassifyProductResult } from "@/server/services/productClassifier";
import { classifyProductImage } from "@/server/services/productClassifier";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";
import { checkRateLimit } from "@/server/services/rateLimitService";

/** Сохранение результата классификатора и метаданных (POST /classify и автопосле загрузки фото). */
export async function persistProductCardClassification(
  project: ProductCardProject,
  result: ClassifyProductResult,
  sourceImages: ReturnType<typeof normalizeProductSourceImages>,
): Promise<ProductCardProject> {
  const wasManual = project.categorySource === "manual";
  const prevSelected = project.selectedCategory;
  const prevCategorySource = project.categorySource;

  const nextSource: "ai" | "mock" =
    result.provider === "mock" ? "mock" : "ai";
  const failed = result.classifierFailed === true;
  const keepUserSelection = failed && !wasManual;

  const categorySourceAfter: "ai" | "manual" | "mock" = wasManual
    ? "manual"
    : keepUserSelection
      ? prevCategorySource === "mock" || prevCategorySource === "ai"
        ? prevCategorySource
        : "ai"
      : nextSource;

  const selectedCategoryComputed = wasManual
    ? project.selectedCategory
    : keepUserSelection && prevSelected?.trim()
      ? prevSelected
      : (result.category as string);

  return prisma.productCardProject.update({
    where: { id: project.id },
    data: {
      detectedCategory: result.category,
      classificationConfidence: result.confidence,
      classificationReason: result.reason,
      selectedCategory: selectedCategoryComputed,
      categorySource: categorySourceAfter,
      metadata: {
        ...((project.metadata as Record<string, unknown> | null) ?? {}),
        classificationSourceImagesCount: sourceImages.length,
        classificationProvider: result.provider,
        classificationModel: result.model,
        classificationRunFailed: failed,
      },
    },
  });
}

/** После успешной привязки фото: по возможности вызвать классификатор и обновить проект. */
export async function tryAutoClassifyProductProject(
  userId: string,
  project: ProductCardProject,
): Promise<ProductCardProject> {
  const sourceImages = normalizeProductSourceImages(project);
  const main =
    sourceImages.find((s) => s.role === "main") ?? sourceImages[0] ?? null;
  const url = main?.url?.trim() ?? project.sourceImageUrl?.trim();
  if (!url) return project;

  const rl = await checkRateLimit("classify", userId, 15, 60);
  if (!rl.allowed) return project;

  try {
    const result = await classifyProductImage(url);
    return persistProductCardClassification(project, result, sourceImages);
  } catch {
    return project;
  }
}
