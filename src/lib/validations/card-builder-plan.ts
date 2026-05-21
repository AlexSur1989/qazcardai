import { z } from "zod";

import { PRODUCT_CATEGORY_IDS } from "@/config/product-card-categories";
import {
  CATEGORY_FIELD_KEY_MAX_CHARS,
  CATEGORY_FIELD_VALUE_MAX_CHARS,
} from "@/lib/card-builder-category-fields-runtime";
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

const PRODUCT_CATEGORY_ID_SET = new Set<string>(PRODUCT_CATEGORY_IDS);

const Z_CATEGORY_FIELD_MAP = z.record(
  z.string().max(CATEGORY_FIELD_KEY_MAX_CHARS),
  z.string().max(CATEGORY_FIELD_VALUE_MAX_CHARS),
);

/**
 * Частичный архив полей по категориям: UI шлёт только заполненные категории, не все enum-ключи.
 * (z.record(Z_PRODUCT_CATEGORY, …) в Zod 4 требует полный набор ключей enum.)
 */
const Z_CATEGORY_FIELDS_BY_CATEGORY = z
  .preprocess(
    (val) => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) {
        return undefined;
      }
      return val;
    },
    z
      .record(z.string(), Z_CATEGORY_FIELD_MAP)
      .superRefine((record, ctx) => {
        for (const key of Object.keys(record)) {
          if (!PRODUCT_CATEGORY_ID_SET.has(key)) {
            ctx.addIssue({
              code: "custom",
              path: [key],
              message: `Неизвестная категория «${key}». Укажите одну из допустимых категорий товара.`,
            });
          }
        }
      })
      .transform((record) => {
        const out: Partial<
          Record<(typeof PRODUCT_CATEGORY_IDS)[number], Record<string, string>>
        > = {};
        for (const [key, vals] of Object.entries(record)) {
          if (!PRODUCT_CATEGORY_ID_SET.has(key)) continue;
          if (vals && typeof vals === "object" && Object.keys(vals).length > 0) {
            out[key as (typeof PRODUCT_CATEGORY_IDS)[number]] = vals;
          }
        }
        return Object.keys(out).length > 0 ? out : undefined;
      })
      .optional(),
  );

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
    useComposition: z.boolean().optional().default(false),
    useBackground: z.boolean().optional().default(false),
    useColors: z.boolean().optional().default(false),
    useTypography: z.boolean().optional().default(false),
    useBadges: z.boolean().optional().default(false),
    useIcons: z.boolean().optional().default(false),
    useMood: z.boolean().optional().default(false),
    useOverallPresentation: z.boolean().optional().default(false),
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
    categoryFields: z
      .object({
        categoryKey: z.string().trim().min(1).max(64),
        values: Z_CATEGORY_FIELD_MAP.optional(),
      })
      .optional(),
    categoryFieldsByCategory: Z_CATEGORY_FIELDS_BY_CATEGORY,
    styleReference: Z_STYLE_REFERENCE.optional(),
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
