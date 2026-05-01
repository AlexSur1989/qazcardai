export type ModerationResult =
  | { allowed: true }
  | {
      allowed: false;
      /** Техническое/операционное описание (и для лога reason) */
      reason: string;
      /** Стабильный код правила: MAX_PROMPT_LENGTH, BANNED_WORD, … */
      rule: string;
      matchedText?: string;
      severity?: "low" | "medium" | "high";
    };

export type ModerationRule = {
  id: string;
  check(combinedLowercase: string): string | null;
};
