import { z } from "zod";

import {
  SIMPLE_CARD_ASPECT_RATIOS,
  SIMPLE_CARD_CREATIVITY_DEFAULT,
  SIMPLE_CARD_CREATIVITY_MAX,
  SIMPLE_CARD_CREATIVITY_MIN,
  SIMPLE_CARD_DEFAULT_ASPECT_RATIO,
  SIMPLE_CARD_DEFAULT_STYLE_MODE,
  SIMPLE_CARD_STYLE_MODES,
  SIMPLE_CARD_USER_TEXT_MAX,
  type SimpleCardAspectRatio,
  type SimpleCardStyleMode,
} from "@/config/simple-product-card";

function enumFrom<K extends string>(ids: readonly K[]): [K, ...K[]] {
  if (ids.length === 0) throw new Error("simple card: empty id list");
  return [ids[0]!, ...ids.slice(1) as K[]];
}

const Z_STYLE = z.enum(enumFrom(SIMPLE_CARD_STYLE_MODES));
const Z_ASPECT = z.enum(enumFrom(SIMPLE_CARD_ASPECT_RATIOS));

export const simpleProductCardRequestSchema = z
  .object({
    productPhotoId: z.string().trim().min(1).max(96),
    userText: z.string().trim().min(1).max(SIMPLE_CARD_USER_TEXT_MAX),
    styleMode: Z_STYLE.default(SIMPLE_CARD_DEFAULT_STYLE_MODE),
    useReference: z.boolean().optional().default(false),
    referenceImageId: z.string().trim().min(1).max(96).nullable().optional(),
    referenceCreativity: z
      .number()
      .int()
      .min(SIMPLE_CARD_CREATIVITY_MIN)
      .max(SIMPLE_CARD_CREATIVITY_MAX)
      .nullable()
      .optional(),
    aspectRatio: Z_ASPECT.default(SIMPLE_CARD_DEFAULT_ASPECT_RATIO),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.styleMode === "premium") {
      if (data.referenceImageId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Премиум стиль не использует фото-референс",
          path: ["referenceImageId"],
        });
      }
      if (data.referenceCreativity != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Премиум стиль не использует креативность референса",
          path: ["referenceCreativity"],
        });
      }
      if (data.useReference) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Премиум стиль не поддерживает референс",
          path: ["useReference"],
        });
      }
      return;
    }

    if (data.styleMode === "reference") {
      if (!data.referenceImageId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Загрузите фото-референс для этого стиля",
          path: ["referenceImageId"],
        });
      }
      return;
    }

    // classic
    if (data.useReference) {
      if (!data.referenceImageId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Загрузите фото-референс или выключите эту опцию",
          path: ["referenceImageId"],
        });
      }
    } else if (data.referenceImageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выключите опцию референса или загрузите фото",
        path: ["referenceImageId"],
      });
    }
  });

export type SimpleProductCardRequest = z.infer<typeof simpleProductCardRequestSchema>;

export function normalizeSimpleCardPayload(
  input: SimpleProductCardRequest,
): SimpleProductCardRequest {
  const styleMode = input.styleMode as SimpleCardStyleMode;
  if (styleMode === "premium") {
    return {
      ...input,
      useReference: false,
      referenceImageId: null,
      referenceCreativity: null,
    };
  }
  if (styleMode === "reference") {
    return {
      ...input,
      useReference: true,
      referenceCreativity: input.referenceCreativity ?? SIMPLE_CARD_CREATIVITY_DEFAULT,
    };
  }
  // classic
  if (!input.useReference) {
    return {
      ...input,
      useReference: false,
      referenceImageId: null,
      referenceCreativity: null,
    };
  }
  return {
    ...input,
    useReference: true,
    referenceCreativity: input.referenceCreativity ?? SIMPLE_CARD_CREATIVITY_DEFAULT,
  };
}

export function simpleCardUsesReference(payload: SimpleProductCardRequest): boolean {
  if (payload.styleMode === "premium") return false;
  if (payload.styleMode === "reference") return true;
  return payload.styleMode === "classic" && payload.useReference === true;
}

export function aspectRatioToSimpleCardSizeId(aspect: SimpleCardAspectRatio): string {
  const map: Record<SimpleCardAspectRatio, string> = {
    "1:1": "1x1",
    "4:3": "4x3",
    "3:4": "3x4",
    "16:9": "16x9",
    "9:16": "9x16",
  };
  return map[aspect];
}

export const simpleProductCardEstimateSchema = z.object({
  payload: simpleProductCardRequestSchema,
  productLabel: z.string().trim().max(200).optional(),
});

export const simpleProductCardGenerateSchema = z.object({
  payload: simpleProductCardRequestSchema,
  clientEstimateCredits: z.number().int().nonnegative().optional().nullable(),
  productLabel: z.string().trim().max(200).optional(),
});
