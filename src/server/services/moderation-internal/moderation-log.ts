
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const PREVIEW = 300;

function preview(s: string): string {
  const t = (s ?? "").trim();
  if (t.length <= PREVIEW) return t;
  return `${t.slice(0, PREVIEW)}…`;
}

/**
 * Сохраняет запись в ModerationLog. Не пишет file/base64 в preview.
 * Без userId+modelId лог пропускается (например тест в админке).
 */
export async function persistBlockedModerationEvent(p: {
  userId?: string | null;
  modelId?: string | null;
  generationId?: string | null;
  flow?: string | null;
  fullPrompt: string;
  reason: string;
  rule: string;
  matchedText?: string;
  severity?: "low" | "medium" | "high" | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  if (!p.userId || !p.modelId) {
    return;
  }
  try {
    await prisma.moderationLog.create({
      data: {
        userId: p.userId,
        modelId: p.modelId,
        generationId: p.generationId ?? null,
        flow: p.flow?.slice(0, 64) ?? null,
        promptPreview: preview(p.fullPrompt),
        reason: p.reason.slice(0, 2000),
        rule: p.rule.slice(0, 128),
        matchedText: p.matchedText ? p.matchedText.slice(0, 500) : null,
        severity: p.severity ?? null,
        metadata: p.metadata,
      },
    });
  } catch (e) {
    console.error("[moderation] persistBlockedModerationEvent failed", e);
  }
}
