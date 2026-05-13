
import { Prisma } from "@/generated/prisma/client";

import { getFullModerationConfig } from "./config";
import {
  DEEPFAKE_KEYWORD_FRAGMENTS,
  ILLEGAL_KEYWORD_FRAGMENTS,
  MINORS_UNSAFE_KEYWORD_FRAGMENTS,
  NSFW_KEYWORD_FRAGMENTS,
} from "./category-keywords";
import { persistBlockedModerationEvent } from "./moderation-log";
import type { ModerationResult } from "./types";

const RULE = {
  MAX_PROMPT_LENGTH: "MAX_PROMPT_LENGTH",
  BANNED_WORD: "BANNED_WORD",
  BLOCKED_PATTERN: "BLOCKED_PATTERN",
  NSFW: "NSFW",
  DEEPFAKE: "DEEPFAKE",
  MINORS: "MINORS",
  ILLEGAL: "ILLEGAL",
  REVIEW_MODE: "REVIEW_MODE",
} as const;

const R = {
  tooLong: "Prompt is too long",
  bannedWord: "Prompt contains banned word",
  pattern: "Prompt matches blocked pattern",
  nsfw: "Prompt contains disallowed content (NSFW)",
  deepfake: "Prompt contains disallowed content (deepfake)",
  minors: "Prompt contains disallowed content (minors safety)",
  illegal: "Prompt contains disallowed content (illegal)",
  review: "Manual review required",
} as const;

function combineParts(
  prompt: string,
  negative: string,
  extra: string[] | null | undefined,
): { combined: string; forLength: string; full: string } {
  const p = (prompt ?? "").trim();
  const n = (negative ?? "").trim();
  const ex = (extra ?? [])
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0);
  const combined = `${p} ${n} ${ex.join(" ")}`.trim().toLowerCase();
  const full = `${p} ${n} ${ex.join(" ")}`.trim();
  return { combined, forLength: p, full };
}

function firstRegexHit(
  patterns: string[],
  text: string,
): { source: string; match: string } | null {
  for (const source of patterns) {
    const p = (source ?? "").trim();
    if (!p) continue;
    try {
      const re = new RegExp(p, "iu");
      const m = re.exec(text);
      if (m) {
        return { source: p, match: m[0] };
      }
    } catch (e) {
      console.warn(
        "[moderation] invalid MODERATION_BLOCKED_PATTERNS entry skipped:",
        p.slice(0, 80),
        e,
      );
    }
  }
  return null;
}

function findBannedFromList(banned: string[], combinedLower: string): string | null {
  for (const w of banned) {
    const f = w.trim().toLowerCase();
    if (!f) continue;
    if (combinedLower.includes(f)) {
      return f;
    }
  }
  return null;
}

function shouldSkipPersistence(flow: string | undefined): boolean {
  return flow === "admin_test";
}

async function logBlock(
  input: ModerationInput,
  full: string,
  block: Extract<ModerationResult, { allowed: false }>,
) {
  if (shouldSkipPersistence(input.flow)) {
    return;
  }
  const meta: Prisma.InputJsonValue | undefined = input.metadata
    ? (input.metadata as Prisma.InputJsonValue)
    : undefined;
  await persistBlockedModerationEvent({
    userId: input.userId,
    modelId: input.modelId,
    generationId: input.generationId,
    flow: input.flow,
    fullPrompt: full,
    reason: block.reason,
    rule: block.rule,
    matchedText: block.matchedText,
    severity: block.severity,
    metadata: meta,
  });
}

export type ModerationInput = {
  prompt: string;
  negativePrompt?: string | null;
  extraTexts?: string[] | null;
  /** Только пользовательские строки (card_builder и др.): длина и banned/NSFW не зависят от длинных системных инструкций. */
  userDerivedTextForModeration?: string | null;
  userId?: string;
  modelId?: string;
  generationId?: string | null;
  flow?: string;
  metadata?: Record<string, unknown>;
};

export async function moderateGenerationInput(
  input: ModerationInput,
): Promise<ModerationResult> {
  const basis =
    input.userDerivedTextForModeration != null
      ? String(input.userDerivedTextForModeration)
      : input.prompt;
  const { combined, forLength, full } = combineParts(
    basis,
    String(input.negativePrompt ?? ""),
    input.extraTexts,
  );
  const config = await getFullModerationConfig();
  if (!config.enabled) {
    return { allowed: true };
  }

  if (forLength.length > config.maxPromptLength) {
    const block: Extract<ModerationResult, { allowed: false }> = {
      allowed: false,
      reason: R.tooLong,
      rule: RULE.MAX_PROMPT_LENGTH,
      matchedText: forLength.slice(0, 200),
      severity: "medium",
    };
    await logBlock(input, full, block);
    return block;
  }

  if (combined.length === 0) {
    return { allowed: true };
  }

  const bannedHit = findBannedFromList(config.bannedWords, combined);
  if (bannedHit) {
    const block: Extract<ModerationResult, { allowed: false }> = {
      allowed: false,
      reason: R.bannedWord,
      rule: RULE.BANNED_WORD,
      matchedText: bannedHit,
      severity: "high",
    };
    await logBlock(input, full, block);
    return block;
  }

  const rx = firstRegexHit(config.blockedPatterns, combined);
  if (rx) {
    const block: Extract<ModerationResult, { allowed: false }> = {
      allowed: false,
      reason: R.pattern,
      rule: RULE.BLOCKED_PATTERN,
      matchedText: rx.match.slice(0, 200),
      severity: "high",
    };
    await logBlock(input, full, block);
    return block;
  }

  if (config.blockNsfw) {
    for (const frag of NSFW_KEYWORD_FRAGMENTS) {
      if (combined.includes(frag)) {
        const block: Extract<ModerationResult, { allowed: false }> = {
          allowed: false,
          reason: R.nsfw,
          rule: RULE.NSFW,
          matchedText: frag,
          severity: "high",
        };
        await logBlock(input, full, block);
        return block;
      }
    }
  }
  if (config.blockDeepfake) {
    for (const frag of DEEPFAKE_KEYWORD_FRAGMENTS) {
      if (combined.includes(frag)) {
        const block: Extract<ModerationResult, { allowed: false }> = {
          allowed: false,
          reason: R.deepfake,
          rule: RULE.DEEPFAKE,
          matchedText: frag,
          severity: "high",
        };
        await logBlock(input, full, block);
        return block;
      }
    }
  }
  if (config.blockMinors) {
    for (const frag of MINORS_UNSAFE_KEYWORD_FRAGMENTS) {
      if (combined.includes(frag)) {
        const block: Extract<ModerationResult, { allowed: false }> = {
          allowed: false,
          reason: R.minors,
          rule: RULE.MINORS,
          matchedText: frag,
          severity: "high",
        };
        await logBlock(input, full, block);
        return block;
      }
    }
  }
  if (config.blockIllegal) {
    for (const frag of ILLEGAL_KEYWORD_FRAGMENTS) {
      if (combined.includes(frag)) {
        const block: Extract<ModerationResult, { allowed: false }> = {
          allowed: false,
          reason: R.illegal,
          rule: RULE.ILLEGAL,
          matchedText: frag,
          severity: "high",
        };
        await logBlock(input, full, block);
        return block;
      }
    }
  }

  if (config.reviewMode) {
    const block: Extract<ModerationResult, { allowed: false }> = {
      allowed: false,
      reason: R.review,
      rule: RULE.REVIEW_MODE,
      severity: "medium",
    };
    await logBlock(input, full, block);
    return block;
  }

  return { allowed: true };
}
