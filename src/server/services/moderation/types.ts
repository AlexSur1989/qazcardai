export type ModerationResult =
  | { allowed: true }
  | {
      allowed: false;
      /** Стабильный id правила (лог, metadata) */
      ruleId: string;
      /** Текст для пользователя/админа (без внутренних деталей) */
      reason: string;
      /** Совпавший фрагмент/паттерн (усечённо) */
      matched: string;
    };

export type ModerationRule = {
  id: string;
  /**
   * @returns null если ок, иначе короткое объяснение
   */
  check(combinedLowercase: string): string | null;
};
