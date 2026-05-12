
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

/**
 * Default image model для «Фото с концепциями».
 */
export async function resolveDefaultProductConceptImageModel(): Promise<AiModel | null> {
  return resolveStrictProductCardModel("PRODUCT_CONCEPT_IMAGE");
}

/**
 * Карточка маркетплейса.
 */
export async function resolveDefaultMarketplaceCardModel(): Promise<AiModel | null> {
  return resolveStrictProductCardModel("PRODUCT_MARKETPLACE_CARD");
}

export type ResolvedCardBuilderImageModel =
  | { model: AiModel; usedFallbackMarketplaceCard: false }
  | { model: AiModel; usedFallbackMarketplaceCard: true };

/**
 * Модель для «Создать карточку»: сначала PRODUCT_CARD_BUILDER, иначе — карточка витрины
 * (fallback разрешён спецификацией; флаг уходит в метаданные).
 */
export async function resolveCardBuilderImageModel(): Promise<ResolvedCardBuilderImageModel | null> {
  const primary = await resolveStrictProductCardModel("PRODUCT_CARD_BUILDER");
  if (primary) {
    return { model: primary, usedFallbackMarketplaceCard: false };
  }
  const fb = await resolveStrictProductCardModel("PRODUCT_MARKETPLACE_CARD");
  if (fb) {
    return { model: fb, usedFallbackMarketplaceCard: true };
  }
  return null;
}

/**
 * Видео «карточка товара» (image-to-video).
 */
export async function resolveDefaultProductVideoModel(): Promise<AiModel | null> {
  return resolveStrictProductCardModel("PRODUCT_VIDEO");
}

/** Классификатор категории по фото (Product Card). */
export async function resolveDefaultProductClassifierModel(): Promise<AiModel | null> {
  return resolveStrictProductCardModel("PRODUCT_CLASSIFIER");
}

/**
 * Backwards-compatible wrapper. Product Card model lookup is strict and never falls
 * back to GENERAL models.
 */
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
