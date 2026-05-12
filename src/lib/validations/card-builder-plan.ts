import { z } from "zod";

export const cardBuilderPlanFieldsSchema = z.object({
  selectedCategory: z.string().trim().min(1).max(64),
  marketplace: z.string().trim().min(1).max(64),
  goal: z.string().trim().min(1).max(96),
  preserveProduct: z.boolean().optional().default(true),
  preserveAspects: z.array(z.string()).default([]),
  allowCreativeStylization: z.boolean().optional(),
  benefits: z.array(z.string()).default([]),
  benefitsExtra: z.string().max(2000).optional(),
  mustShow: z.array(z.string()).default([]),
  audience: z.string().trim().min(1).max(64),
  priceSegment: z.string().trim().min(1).max(32),
  salesStyle: z.string().trim().min(1).max(64),
  textDensity: z.string().trim().min(1).max(64),
});
