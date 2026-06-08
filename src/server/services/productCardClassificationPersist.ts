import type { ProductCardProject } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProductClassifierResult } from "@/lib/product-classifier-result";
import { benefitsToUserText } from "@/lib/product-classifier-result";
import type { ClassifyProductResult } from "@/server/services/productClassifier";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";
import { isProductClassifierReady } from "@/server/services/productClassifierFlow";

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

/** После успешной привязки фото: автоклассификация только если classifier Ready и real Kie разрешён. */
export async function tryAutoClassifyProductProject(
  _userId: string,
  project: ProductCardProject,
): Promise<ProductCardProject> {
  const ready = await isProductClassifierReady();
  if (!ready || process.env.PRODUCT_CLASSIFIER_ALLOW_REAL_KIE !== "true") {
    return project;
  }
  return project;
}

/** Сохранение применённого результата classifier (после «Применить» в UI). */
export async function persistAppliedProductClassifierResult(
  project: ProductCardProject,
  result: ProductClassifierResult,
  sourceImages: ReturnType<typeof normalizeProductSourceImages>,
): Promise<ProductCardProject> {
  const prevMeta = (project.metadata as Record<string, unknown> | null) ?? {};
  const benefitsText = benefitsToUserText(result.suggestedBenefits);

  return prisma.productCardProject.update({
    where: { id: project.id },
    data: {
      title: result.productTitle.trim() || project.title,
      detectedCategory: result.category,
      selectedCategory: result.category,
      categorySource: "ai",
      classificationConfidence: result.confidence,
      classificationReason: result.visibleProduct.trim() || null,
      metadata: {
        ...prevMeta,
        classifierConfidence: result.confidence,
        classifierAppliedAt: new Date().toISOString(),
        classifierResult: result,
        classificationSourceImagesCount: sourceImages.length,
        classificationRunFailed: false,
        marketplaceCard: {
          ...((prevMeta.marketplaceCard as Record<string, unknown> | undefined) ?? {}),
          simpleCard: {
            ...(
              (prevMeta.marketplaceCard as { simpleCard?: Record<string, unknown> } | undefined)
                ?.simpleCard ?? {}
            ),
            settings: {
              ...(
                (
                  prevMeta.marketplaceCard as
                    | { simpleCard?: { settings?: Record<string, unknown> } }
                    | undefined
                )?.simpleCard?.settings ?? {}
              ),
              productLabel: result.productTitle.trim(),
              userText: benefitsText,
            },
          },
        },
      },
    },
  });
}
