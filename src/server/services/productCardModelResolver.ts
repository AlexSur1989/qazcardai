
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
  if (!slug) {
    if (productCardModelType === "PRODUCT_CARD_BUILDER") {
      return prisma.aiModel.findFirst({
        where: {
          scope: "PRODUCT_CARD",
          productCardModelType: "PRODUCT_CARD_BUILDER",
          isActive: true,
          type: "IMAGE",
        },
        orderBy: { name: "asc" },
      });
    }
    return null;
  }

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
    if (!dedicated.supportsImageInput) return null;
    return { model: dedicated, fallbackFromMarketplaceCard: false };
  }

  const mp = await resolveStrictProductCardModel("PRODUCT_MARKETPLACE_CARD");
  if (mp && mp.supportsImageInput) {
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

/** Классификатор категории по фото (Product Card). */
export async function resolveDefaultProductClassifierModel(): Promise<AiModel | null> {
  return resolveStrictProductCardModel("PRODUCT_CLASSIFIER");
}

/** Модель анализа фото для card_builder; fallback — PRODUCT_CLASSIFIER. */
export async function resolveProductCardVisionModel(): Promise<AiModel | null> {
  const envSlug = (process.env.PRODUCT_CARD_VISION_MODEL_SLUG ?? "").trim();
  if (envSlug) {
    const wrongScope = await prisma.aiModel.findFirst({
      where: { slug: envSlug, isActive: true, scope: "GENERAL" },
      select: { id: true },
    });
    if (wrongScope) {
      throw new ProductCardModelMisconfiguredError(envSlug);
    }
    const bySlug = await prisma.aiModel.findFirst({
      where: {
        slug: envSlug,
        scope: "PRODUCT_CARD",
        isActive: true,
        supportsImageInput: true,
      },
    });
    if (bySlug) return bySlug;
  }
  return resolveDefaultProductClassifierModel();
}

/** card_builder требует image input для сохранения товара 1:1. */
export function cardBuilderModelProductImageError(model: AiModel): string | null {
  if (model.supportsImageInput) return null;
  return `Модель «${model.slug}» не поддерживает исходное фото товара и не подходит для «Создать карточку».`;
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
