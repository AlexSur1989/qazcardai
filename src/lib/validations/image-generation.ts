import { z } from "zod";

export const imageGenerationBodySchema = z.object({
  modelId: z.string().trim().min(1, "Укажите модель"),
  settings: z
    .record(z.string(), z.unknown())
    .optional()
    .transform((v) => v ?? {}),
  prompt: z
    .string()
    .trim()
    .min(1, "Введите промпт")
    .max(20_000, "Промпт слишком длинный"),
  negativePrompt: z
    .string()
    .max(20_000)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? undefined : v)),
  aspectRatio: z
    .string()
    .max(32)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? undefined : v)),
  resolution: z
    .string()
    .max(64)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? undefined : v)),
  seed: z
    .number()
    .int()
    .optional()
    .nullable()
    .transform((v) => (v == null || v === undefined ? undefined : v)),
  inputFiles: z
    .array(z.string().min(1))
    .max(8, "Слишком много файлов")
    .optional()
    .transform((v) => (v == null || v.length === 0 ? undefined : v)),
});

export type ImageGenerationBody = z.infer<typeof imageGenerationBodySchema>;
