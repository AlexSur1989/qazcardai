
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

  /** Для билдера: явный slug в настройках может указывать на любую PRODUCT_CARD IMAGE для fallback */
  const bypassStrictType =
    productCardModelType === "PRODUCT_CARD_BUILDER" &&
    settings.cardBuilderModelSlug.trim().length > 0;

  if (bypassStrictType) {
    const slug = settings.cardBuilderModelSlug.trim();
    const wrongScope = await prisma.aiModel.findFirst({
      where: { slug, isActive: true, scope: "GENERAL" },
      select: { id: true },
    });
    if (wrongScope) {
      throw new ProductCardModelMisconfiguredError(slug);
    }
    const bySlug = await prisma.aiModel.findFirst({
      where: {
        slug,
        scope: "PRODUCT_CARD",
        isActive: true,
        type: "IMAGE",
      },
    });
    return bySlug;
  }

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
 * Модель сценария «Создать карточку»: PRODUCT_CARD_BUILDER или явный slug;
 * затем безопасный fallback на маркетплейс (metadata фиксирует fallbackFromMarketplaceCard).
 */
export async function resolveCardBuilderImageModel(): Promise<{
  model: AiModel;
  fallbackFromMarketplaceCard: boolean;
} | null> {
  const settings = await getProductCardSettings();
  if (settings.cardBuilderModelSlug.trim()) {
    try {
      const m = await resolveStrictProductCardModel("PRODUCT_CARD_BUILDER");
      if (m && m.productCardModelType === "PRODUCT_CARD_BUILDER") {
        return { model: m, fallbackFromMarketplaceCard: false };
      }
      if (m) {
        return {
          model: m,
          fallbackFromMarketplaceCard: m.productCardModelType !== "PRODUCT_CARD_BUILDER",
        };
      }
    } catch {
      /* misconfig */
    }
  }

  const dedicated = await resolveStrictProductCardModel("PRODUCT_CARD_BUILDER");
  if (dedicated && dedicated.productCardModelType === "PRODUCT_CARD_BUILDER") {
    return { model: dedicated, fallbackFromMarketplaceCard: false };
  }

  const mp = await resolveStrictProductCardModel("PRODUCT_MARKETPLACE_CARD");
  if (mp) {
    return { model: mp, fallbackFromMarketplaceCard: true };
  }
  return null;
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
