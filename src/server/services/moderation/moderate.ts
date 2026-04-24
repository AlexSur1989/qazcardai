import "server-only";

import { createBannedSubstringsRule } from "./rules-banned-substrings";
import { getModerationConfig } from "./config";
import type { ModerationResult, ModerationRule } from "./types";

/**
 * Собирает правила. Новые стратегии (regex, allowlist) — добавлять в этот список.
 */
function buildRules(banned: string[]): ModerationRule[] {
  if (banned.length === 0) {
    return [];
  }
  return [createBannedSubstringsRule(banned)];
}

/**
 * Модерация до резерва кредитов и вызова Kie. Только server-side.
 */
export async function moderateGenerationInput(input: {
  prompt: string;
  negativePrompt?: string | null;
}): Promise<ModerationResult> {
  const prompt = (input.prompt ?? "").trim();
  const neg = (input.negativePrompt ?? "").trim();
  const config = await getModerationConfig();
  if (!config.enabled) {
    return { allowed: true };
  }
  const combined = `${prompt} ${neg}`.trim().toLowerCase();
  if (combined.length === 0) {
    return { allowed: true };
  }
  const rules = buildRules(config.bannedSubstrings);
  for (const rule of rules) {
    const hit = rule.check(combined);
    if (hit) {
      return {
        allowed: false,
        ruleId: rule.id,
        reason:
          "Промпт не прошёл модерацию. Измените формулировку или обратитесь в поддержку.",
        matched: hit.slice(0, 200),
      };
    }
  }
  return { allowed: true };
}
