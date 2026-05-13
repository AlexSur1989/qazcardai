import { z } from "zod";

import {
  CARD_BUILDER_AUDIENCES,
  CARD_BUILDER_BENEFIT_TAGS,
  CARD_BUILDER_GOALS,
  CARD_BUILDER_LANGUAGE_MODES,
  CARD_BUILDER_MARKETPLACES,
  CARD_BUILDER_MUST_SHOW,
  CARD_BUILDER_PRESERVE_ASPECTS,
  CARD_BUILDER_PRICE_SEGMENTS,
  CARD_BUILDER_SALES_STYLES,
  CARD_BUILDER_TEXT_DENSITY,
} from "@/config/card-builder-config";

function enumFrom<K extends string>(ids: readonly K[]): [K, ...K[]] {
  if (ids.length === 0) {
    throw new Error("card_builder: empty id list");
  }
  return [ids[0]!, ...ids.slice(1) as K[]];
}

const Z_MARKETPLACE = z.enum(enumFrom(CARD_BUILDER_MARKETPLACES.map((m) => m.id)));
const Z_GOAL = z.enum(enumFrom(CARD_BUILDER_GOALS.map((g) => g.id)));
const Z_PRESERVE = z.enum(enumFrom(CARD_BUILDER_PRESERVE_ASPECTS.map((x) => x.id)));
const Z_TAG = z.enum(enumFrom(CARD_BUILDER_BENEFIT_TAGS.map((x) => x.id)));
const Z_MUST = z.enum(enumFrom(CARD_BUILDER_MUST_SHOW.map((x) => x.id)));
const Z_AUD = z.enum(enumFrom(CARD_BUILDER_AUDIENCES.map((x) => x.id)));
const Z_PRICE = z.enum(enumFrom(CARD_BUILDER_PRICE_SEGMENTS.map((x) => x.id)));
const Z_STYLE = z.enum(enumFrom(CARD_BUILDER_SALES_STYLES.map((x) => x.id)));
const Z_DENSITY = z.enum(enumFrom(CARD_BUILDER_TEXT_DENSITY.map((x) => x.id)));
const Z_LANG = z.enum(enumFrom(CARD_BUILDER_LANGUAGE_MODES.map((x) => x.id)));

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

/** Поля мастера «Создать карточку»: те же значения, что и в UI (card-builder-config). */
export const cardBuilderPlanFieldsSchema = z
  .object({
    selectedCategory: z.string().trim().min(1).max(64),
    marketplace: Z_MARKETPLACE,
    goal: Z_GOAL,
    preserveProduct: z.boolean().optional().default(true),
    preserveAspects: z.array(Z_PRESERVE).default([]),
    allowCreativeStylization: z.boolean().optional(),
    benefits: z.array(Z_TAG).default([]),
    benefitsExtra: z.string().max(2000).optional(),
    /** Копия `benefits` для metadata (семантические акценты, не verbatim-текст). */
    semanticBenefits: z.array(Z_TAG).optional(),
    /** Копия `benefitsExtra` — текст из «Дополнительные преимущества». */
    additionalBenefits: z.string().max(2000).optional(),
    subtitle: z.string().max(300).optional(),
    dimensions: z.string().max(500).optional(),
    languageMode: Z_LANG.optional().default("auto"),
    mustShow: z.array(Z_MUST).default([]),
    audience: Z_AUD,
    priceSegment: Z_PRICE,
    salesStyle: Z_STYLE,
    textDensity: Z_DENSITY,
    marketplaceProfileId: z.string().optional(),
    marketplaceProfileVersion: z.string().optional(),
    appliedMarketplaceRules: Z_APPLIED_MARKETPLACE_RULES.optional(),
    cardBuilderTargetAspectRatio: z.string().optional(),
    cardBuilderTargetSize: z.string().optional(),
  })
  .strict();

export type CardBuilderPlanFields = z.infer<typeof cardBuilderPlanFieldsSchema>;

/** Нормализует сохранённые зеркала `semanticBenefits` / `additionalBenefits` перед генерацией. */
export function coerceCardBuilderPlan(fields: CardBuilderPlanFields): CardBuilderPlanFields {
  const benefits = fields.benefits?.length ? fields.benefits : (fields.semanticBenefits ?? []);
  const mergedExtra =
    (fields.benefitsExtra?.trim() || fields.additionalBenefits?.trim() || "") || undefined;
  return {
    ...fields,
    benefits,
    benefitsExtra: mergedExtra,
    semanticBenefits: [...benefits],
    additionalBenefits: mergedExtra ?? "",
  };
}

export const cardBuilderEstimateRequestSchema = z.object({
  source: z.enum(["payload", "saved"]).default("payload"),
  payload: cardBuilderPlanFieldsSchema.optional(),
  mode: z.enum(["single_slide", "full_gallery"]),
  /** Для single_slide при полной галерее или multi — роль активного слайда для точной цены */
  activeSlideId: z.string().trim().min(3).max(120).optional(),
});

export const cardBuilderGenerateSlideBodySchema = z.object({
  slideId: z.string().trim().min(3).max(120),
  clientEstimateCredits: z.number().int().nonnegative().optional().nullable(),
  /** SHA-256 плана галереи (поле «planHash» из ответа /estimate/card-builder). */
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
