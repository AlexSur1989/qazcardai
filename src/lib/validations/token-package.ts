import { z } from "zod";

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const tokenPackageFormSchema = z
  .object({
    name: z.string().trim().min(1, "Укажите название").max(200),
    slug: z
      .string()
      .trim()
      .min(1, "Укажите slug")
      .max(64)
      .regex(slugRe, "Slug: строчные латинские буквы, цифры, дефисы"),
    priceKzt: z.coerce.number().int("Цена: целое тенге").positive("Цена > 0"),
    baseTokens: z.coerce.number().int("База: целое").positive("База > 0"),
    bonusTokens: z.coerce.number().int("Бонус: целое").min(0, "Бонус ≥ 0"),
    description: z
      .string()
      .max(2000)
      .optional()
      .transform((s) => (s?.trim() ? s.trim() : undefined)),
    sortOrder: z.coerce.number().int("Порядок: целое"),
    isActive: z.boolean().default(true),
  })
  .transform((d) => ({
    ...d,
    totalTokens: d.baseTokens + d.bonusTokens,
  }));

export type TokenPackageFormValues = z.infer<typeof tokenPackageFormSchema>;
