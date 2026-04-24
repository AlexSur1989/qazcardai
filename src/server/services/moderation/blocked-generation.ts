import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { AiModel } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { ModerationResult } from "./types";

type BlockedInput = {
  userId: string;
  model: Pick<AiModel, "id" | "costCredits">;
  type: "IMAGE" | "VIDEO";
  prompt: string;
  negativePrompt: string | null;
  inputFiles: Prisma.InputJsonValue | undefined;
  metadata: Prisma.InputJsonValue | undefined;
  mod: Extract<ModerationResult, { allowed: false }>;
};

/**
 * Без резерва кредитов, без очереди. `costCredits` = 0 (не удерживали/не списывали).
 */
export async function createBlockedByModeration(
  b: BlockedInput,
): Promise<{ id: string }> {
  const now = new Date();
  const meta = mergeModMeta(b.metadata, {
    moderation: { ruleId: b.mod.ruleId, matched: b.mod.matched },
  });
  return prisma.generation.create({
    data: {
      userId: b.userId,
      modelId: b.model.id,
      type: b.type,
      status: "BLOCKED",
      prompt: b.prompt,
      negativePrompt: b.negativePrompt,
      costCredits: 0,
      errorMessage: b.mod.reason.slice(0, 8000),
      inputFiles: b.inputFiles,
      metadata: meta,
      completedAt: now,
    },
    select: { id: true },
  });
}

function mergeModMeta(
  current: Prisma.JsonValue | Prisma.InputJsonValue | undefined,
  mod: Prisma.JsonObject,
): Prisma.InputJsonValue {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Prisma.JsonObject)
      : {};
  return { ...base, ...mod } as Prisma.InputJsonValue;
}
