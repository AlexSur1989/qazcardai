import { z } from "zod";

import {
  CARD_BUILDER_AUDIENCES,
  CARD_BUILDER_DEFAULT_MARKETPLACE_ID,
  CARD_BUILDER_GOALS,
  CARD_BUILDER_LANGUAGE_MODES,
  CARD_BUILDER_PRESERVE_ASPECTS,
  CARD_BUILDER_PRICE_SEGMENTS,
  CARD_BUILDER_SALES_STYLES,
  CARD_BUILDER_TEXT_DENSITY,
} from "@/config/card-builder-config";
import {
  CARD_BUILDER_CREATION_MODES,
  CARD_BUILDER_DEFAULT_TARGET_PLATFORM,
  CARD_BUILDER_SINGLE_CARD_TYPES,
  CARD_BUILDER_TARGET_PLATFORMS,
  CARD_BUILDER_UNIVERSAL_CATEGORY_IDS,
  CARD_BUILDER_VISUAL_STYLES,
} from "@/config/card-builder-universal";
import { CARD_BUILDER_PRODUCT_FACT_TYPES } from "@/lib/card-builder-product-facts";

function enumFrom<K extends string>(ids: readonly K[]): [K, ...K[]] {
  if (ids.length === 0) {
    throw new Error("card_builder: empty id list");
  }
  return [ids[0]!, ...ids.slice(1) as K[]];
}

const Z_MARKETPLACE = z.literal(CARD_BUILDER_DEFAULT_MARKETPLACE_ID);
const Z_GOAL = z.enum(enumFrom(CARD_BUILDER_GOALS.map((g) => g.id)));
const Z_PRESERVE = z.enum(enumFrom(CARD_BUILDER_PRESERVE_ASPECTS.map((x) => x.id)));
const Z_AUD = z.enum(enumFrom(CARD_BUILDER_AUDIENCES.map((x) => x.id)));
const Z_PRICE = z.enum(enumFrom(CARD_BUILDER_PRICE_SEGMENTS.map((x) => x.id)));
const Z_STYLE = z.enum(enumFrom(CARD_BUILDER_SALES_STYLES.map((x) => x.id)));
const Z_DENSITY = z.enum(enumFrom(CARD_BUILDER_TEXT_DENSITY.map((x) => x.id)));
const Z_LANG = z.enum(enumFrom(CARD_BUILDER_LANGUAGE_MODES.map((x) => x.id)));
const Z_TARGET_PLATFORM = z.enum(enumFrom(CARD_BUILDER_TARGET_PLATFORMS.map((x) => x.id)));
const Z_UNIVERSAL_CATEGORY = z.enum(enumFrom(CARD_BUILDER_UNIVERSAL_CATEGORY_IDS));
const Z_CREATION_MODE = z.enum(enumFrom(CARD_BUILDER_CREATION_MODES.map((x) => x.id)));
const Z_SINGLE_CARD_TYPE = z.enum(enumFrom(CARD_BUILDER_SINGLE_CARD_TYPES.map((x) => x.id)));
const Z_VISUAL_STYLE = z.enum(enumFrom(CARD_BUILDER_VISUAL_STYLES.map((x) => x.id)));
const Z_FACT_TYPE = z.enum(enumFrom(CARD_BUILDER_PRODUCT_FACT_TYPES));

const Z_APPLIED_MARKETPLACE_RULES = z
  .object({
    defaultAspectRatio: z.string(),
    defaultSize: z.string(),
    mainPhotoTextAllowed: z.boolean(),
    maxBenefitBadges: z.number(),
    sourceLevel: z.enum(["official", "secondary", "default", "mixed"]),
    needsVerification: z.boolean().optional(),
    infographicAllowed: z.boolean(),
    lifestyleAllowed: z.boolean(),
  })
  .strict();

const Z_STYLE_REFERENCE = z
  .object({
    enabled: z.boolean().optional().default(false),
    referenceAssetIds: z.array(z.string().trim().min(1).max(96)).max(3).optional().default([]),
    strength: z.enum(["low", "medium", "high"]).optional().default("medium"),
    useComposition: z.boolean().optional().default(true),
    useBackground: z.boolean().optional().default(true),
    useColors: z.boolean().optional().default(true),
    useTypography: z.boolean().optional().default(true),
    useBadges: z.boolean().optional().default(true),
    useIcons: z.boolean().optional().default(true),
    useMood: z.boolean().optional().default(true),
    useOverallPresentation: z.boolean().optional().default(true),
  })
  .strict();

const Z_PRODUCT_FACT = z
  .object({
    id: z.string().trim().min(4).max(64),
    label: z.string().trim().min(1).max(120),
    value: z.string().trim().min(1).max(400),
    type: Z_FACT_TYPE,
    visibleOnCard: z.boolean().optional(),
    lockedText: z.boolean().optional(),
    source: z.enum(["vision_ai", "user", "category_field"]).optional().default("user"),
    confidence: z.number().min(0).max(1).optional(),
    needsReview: z.boolean().optional(),
  })
  .strict();

/** Поля мастера «Создать карточку»: universal flow (vision → facts → gallery). */
export const cardBuilderPlanFieldsSchema = z
  .object({
    selectedCategory: z.string().trim().min(1).max(64),
    marketplace: Z_MARKETPLACE.default(CARD_BUILDER_DEFAULT_MARKETPLACE_ID),
    goal: Z_GOAL,
    targetPlatform: Z_TARGET_PLATFORM.optional().default(CARD_BUILDER_DEFAULT_TARGET_PLATFORM),
    cardBuilderCategoryKey: Z_UNIVERSAL_CATEGORY.optional().default("auto"),
    creationMode: Z_CREATION_MODE.optional().default("full_gallery"),
    singleCardType: Z_SINGLE_CARD_TYPE.optional().default("auto"),
    visualStyle: Z_VISUAL_STYLE.optional().default("auto"),
    productType: z.string().max(200).optional(),
    productNameGuess: z.string().max(200).optional(),
    categoryManuallyOverridden: z.boolean().optional().default(false),
    productFacts: z.array(Z_PRODUCT_FACT).max(32).optional().default([]),
    visionAnalysis: z.record(z.string(), z.unknown()).optional(),
    gallerySlideCount: z.union([z.literal(6), z.literal(8)]).optional().default(6),
    preserveProduct: z.boolean().optional().default(true),
    preserveAspects: z.array(Z_PRESERVE).default([]),
    allowCreativeStylization: z.boolean().optional(),
    languageMode: Z_LANG.optional().default("auto"),
    audience: Z_AUD,
    priceSegment: Z_PRICE,
    salesStyle: Z_STYLE,
    textDensity: Z_DENSITY,
    marketplaceProfileId: z.string().optional(),
    marketplaceProfileVersion: z.string().optional(),
    appliedMarketplaceRules: Z_APPLIED_MARKETPLACE_RULES.optional(),
    cardBuilderTargetAspectRatio: z.string().optional(),
    cardBuilderTargetSize: z.string().optional(),
    styleReference: Z_STYLE_REFERENCE.optional(),
  })
  .strict();

export type CardBuilderPlanFields = z.infer<typeof cardBuilderPlanFieldsSchema>;

export function coerceCardBuilderPlan(fields: CardBuilderPlanFields): CardBuilderPlanFields {
  return {
    ...fields,
    marketplace: CARD_BUILDER_DEFAULT_MARKETPLACE_ID,
    targetPlatform: fields.targetPlatform ?? CARD_BUILDER_DEFAULT_TARGET_PLATFORM,
    cardBuilderCategoryKey: fields.cardBuilderCategoryKey ?? "auto",
    creationMode: fields.creationMode ?? "full_gallery",
    singleCardType: fields.singleCardType ?? "auto",
    visualStyle: fields.visualStyle ?? "auto",
    productFacts: fields.productFacts ?? [],
  };
}

export const cardBuilderEstimateRequestSchema = z.object({
  source: z.enum(["payload", "saved"]).default("payload"),
  payload: cardBuilderPlanFieldsSchema.optional(),
  mode: z.enum(["single_slide", "full_gallery"]),
  activeSlideId: z.string().trim().min(3).max(120).optional(),
});

export const cardBuilderGenerateSlideBodySchema = z.object({
  slideId: z.string().trim().min(3).max(120),
  clientEstimateCredits: z.number().int().nonnegative().optional().nullable(),
  clientPlanHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "Обновите оценку («Оценить») перед генерацией"),
  useSavedPlan: z.boolean().optional().default(true),
});

export const cardBuilderGenerateGalleryBodySchema = z.object({
  clientEstimateCredits: z.number().int().nonnegative().optional().nullable(),
  clientPlanHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "Обновите оценку всей галереи перед генерацией"),
});

export const cardBuilderSlideTemplateBodySchema = z.object({
  slideId: z.string().trim().min(3).max(120),
  templateId: z.string().trim().min(2).max(80),
});
