
import type { AiModel } from "@/generated/prisma/client";
import type { GenerationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  defaultSlugForProductCardType,
  getProductCardSettings,
  PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
  type ProductCardModelType,
} from "@/server/services/productCardSettings";

export class ProductCardModelResolverError extends Error {
  constructor() {
    super(PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE);
    this.name = "ProductCardModelResolverError";
  }
}

/** Slug из настроек указывает на GENERAL-модель вместо PRODUCT_CARD. */
export class ProductCardModelMisconfiguredError extends Error {
  constructor(slug: string) {
    super(
      `Некорректная конфигурация карточки товара: slug «${slug}» сопоставлен записи scope GENERAL. Назначьте модель с scope PRODUCT_CARD в админке (настройки приложения).`,
    );
    this.name = "ProductCardModelMisconfiguredError";
  }
}

function expectedGenerationType(productCardModelType: ProductCardModelType): GenerationType {
  return productCardModelType === "PRODUCT_VIDEO" ? "VIDEO" : "IMAGE";
}

async function resolveStrictProductCardModel(
  productCardModelType: ProductCardModelType,
): Promise<AiModel | null> {
  const settings = await getProductCardSettings();
  const slug = defaultSlugForProductCardType(settings, productCardModelType);
  if (!slug) return null;

  const wrongScope = await prisma.aiModel.findFirst({
    where: { slug, isActive: true, scope: "GENERAL" },
    select: { id: true },
  });
  if (wrongScope) {
    throw new ProductCardModelMisconfiguredError(slug);
  }

  return prisma.aiModel.findFirst({
    where: {
      slug,
      scope: "PRODUCT_CARD",
      productCardModelType,
      isActive: true,
      type: expectedGenerationType(productCardModelType),
    },
  });
}

export async function requireProductCardModel(
  productCardModelType: ProductCardModelType,
): Promise<AiModel> {
  const model = await resolveStrictProductCardModel(productCardModelType);
  if (!model) throw new ProductCardModelResolverError();
  return model;
}

export async function resolveDefaultProductConceptImageModel(): Promise<AiModel | null> {
  return resolveStrictProductCardModel("PRODUCT_CONCEPT_IMAGE");
}

export async function resolveDefaultMarketplaceCardModel(): Promise<AiModel | null> {
  return resolveStrictProductCardModel("PRODUCT_MARKETPLACE_CARD");
}

export async function resolveProductVideoModel(
  slug?: string | null,
): Promise<AiModel | null> {
  const settings = await getProductCardSettings();
  const targetSlug = (slug?.trim() || settings.videoModelSlug).trim();
  if (!targetSlug) return null;

  const wrongScope = await prisma.aiModel.findFirst({
    where: { slug: targetSlug, isActive: true, scope: "GENERAL" },
    select: { id: true },
  });
  if (wrongScope) {
    throw new ProductCardModelMisconfiguredError(targetSlug);
  }

  return prisma.aiModel.findFirst({
    where: {
      slug: targetSlug,
      scope: "PRODUCT_CARD",
      productCardModelType: "PRODUCT_VIDEO",
      isActive: true,
      type: "VIDEO",
    },
  });
}

export async function resolveDefaultProductVideoModel(): Promise<AiModel | null> {
  return resolveProductVideoModel(null);
}

export async function listActiveProductVideoModels(): Promise<
  { slug: string; name: string }[]
> {
  return prisma.aiModel.findMany({
    where: {
      scope: "PRODUCT_CARD",
      productCardModelType: "PRODUCT_VIDEO",
      isActive: true,
      type: "VIDEO",
    },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function resolveDefaultProductClassifierModel(): Promise<AiModel | null> {
  return resolveStrictProductCardModel("PRODUCT_CLASSIFIER");
}

export function marketplaceModelProductImageError(model: AiModel): string | null {
  if (model.supportsImageInput) return null;
  return `Модель «${model.slug}» не поддерживает исходное фото товара.`;
}

export async function resolveActiveModel(
  type: GenerationType,
  envSlugKey: string,
  requireImageInput: boolean,
): Promise<AiModel | null> {
  void envSlugKey;
  void requireImageInput;
  return type === "VIDEO"
    ? resolveStrictProductCardModel("PRODUCT_VIDEO")
    : resolveStrictProductCardModel("PRODUCT_CONCEPT_IMAGE");
}
