import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const adminModelTestBodySchema = z.object({
  prompt: z.string().min(1, "prompt required"),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
  inputFiles: z.array(z.string()).optional(),
  negativePrompt: z.string().nullable().optional(),
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
  seed: z.number().optional(),
  durationSec: z.number().optional(),
});

export type AdminModelTestBody = z.infer<typeof adminModelTestBodySchema>;

export async function loadAiModelForAdminTest(modelId: string) {
  return prisma.aiModel.findFirst({ where: { id: modelId, isActive: true } });
}
