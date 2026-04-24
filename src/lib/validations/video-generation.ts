import { z } from "zod";

export const videoGenerationBodySchema = z.object({
  modelId: z.string().trim().min(1, "Укажите модель"),
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
  /** Длительность в секундах, если применимо к API модели. */
  durationSec: z
    .number()
    .int()
    .min(1)
    .max(3600)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === undefined ? undefined : v)),
  inputFiles: z
    .array(z.string().min(1))
    .max(8, "Слишком много файлов")
    .optional()
    .transform((v) => (v == null || v.length === 0 ? undefined : v)),
});

export type VideoGenerationBody = z.infer<typeof videoGenerationBodySchema>;
