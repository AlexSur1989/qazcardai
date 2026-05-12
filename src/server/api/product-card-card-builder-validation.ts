import { z } from "zod";

import {
  CARD_BUILDER_AUDIENCES,
  CARD_BUILDER_BENEFIT_TAGS,
  CARD_BUILDER_GOALS,
  CARD_BUILDER_MARKETPLACES,
  CARD_BUILDER_MUST_SHOW,
  CARD_BUILDER_PRESERVE_ASPECTS,
  CARD_BUILDER_PRICE_SEGMENTS,
  CARD_BUILDER_SALES_STYLES,
  CARD_BUILDER_TEXT_DENSITY,
} from "@/config/card-builder-presets";

function enumFrom<K extends string>(ids: readonly K[]): [K, ...K[]] {
  if (ids.length === 0) {
    throw new Error("card_builder: empty id list");
  }
  return [ids[0]!, ...ids.slice(1) as K[]];
}

const Z_MARKETPLACE = z.enum(enumFrom(CARD_BUILDER_MARKETPLACES.map((m) => m.id)));
const Z_GOAL = z.enum(enumFrom(CARD_BUILDER_GOALS.map((g) => g.id)));
const Z_PRESERVE = z.enum(enumFrom([...CARD_BUILDER_PRESERVE_ASPECTS]));
const Z_TAG = z.enum(enumFrom(CARD_BUILDER_BENEFIT_TAGS.map((x) => x.id)));
const Z_MUST = z.enum(enumFrom(CARD_BUILDER_MUST_SHOW.map((x) => x.id)));
const Z_AUD = z.enum(enumFrom(CARD_BUILDER_AUDIENCES.map((x) => x.id)));
const Z_PRICE = z.enum(enumFrom(CARD_BUILDER_PRICE_SEGMENTS.map((x) => x.id)));
const Z_STYLE = z.enum(enumFrom(CARD_BUILDER_SALES_STYLES.map((x) => x.id)));
const Z_DENSITY = z.enum(enumFrom(CARD_BUILDER_TEXT_DENSITY.map((x) => x.id)));

/** Настройки мастера «Создать карточку» для плана и последующих генераций. */
export const cardBuilderWizardBodySchema = z.object({
  marketplace: Z_MARKETPLACE,
  goal: Z_GOAL,
  preserveProduct: z.boolean().optional().default(true),
  preserveAspects: z.array(Z_PRESERVE).optional().default([]),
  allowCreativeStyle: z.boolean().optional().default(false),
  benefitsTags: z.array(Z_TAG).optional().default([]),
  benefitsExtra: z.string().max(2000).optional().default(""),
  mustShow: z.array(Z_MUST).optional().default([]),
  audience: z.union([Z_AUD, z.null()]).optional(),
  priceSegment: z.union([Z_PRICE, z.null()]).optional(),
  salesStyle: Z_STYLE,
  textDensity: Z_DENSITY,
});

export const cardBuilderEstimateBodySchema = z.object({
  operation: z.enum(["plan", "slide", "gallery_6", "gallery_8"]),
  salesStyle: Z_STYLE,
  textDensity: Z_DENSITY,
});

export const cardBuilderGenerateSlideBodySchema = z.object({
  slideId: z.string().trim().min(3).max(120),
  clientEstimateCredits: z.number().int().nonnegative().optional().nullable(),
});

export const cardBuilderGenerateGalleryBodySchema = z.object({
  clientEstimateCredits: z.number().int().nonnegative().optional().nullable(),
});
