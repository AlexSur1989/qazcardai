/**
 * Список по умолчанию + доп. из AppSetting `moderation_settings` (см. .env.example).
 * Расширяйте правила через `bannedSubstrings` в JSON либо новые `ModerationRule` в `server/services/moderation`.
 */
export const MODERATION_APP_SETTING_KEY = "moderation_settings" as const;

/** Токен для ручного теста: включите в промпт `__E2E_MOD_BLOCK__` — ожидается BLOCKED. */
export const DEFAULT_MODERATION_BANNED_SUBSTRINGS: string[] = ["__E2E_MOD_BLOCK__"];
