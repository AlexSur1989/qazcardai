import { MODERATION_APP_SETTING_KEY } from "@/lib/moderation-defaults";

/** Должен совпадать с `RATE_UPLOAD_APP_SETTING_KEY` в rate-upload-settings (без server-only импорта для client). */
const RATE_UPLOAD_LIMITS_KEY = "rate_upload_limits" as const;

/** Ключи, которые нельзя удалять из UI (критичная конфигурация). */
export const NON_DELETABLE_APP_SETTING_KEYS = new Set<string>([
  MODERATION_APP_SETTING_KEY,
  RATE_UPLOAD_LIMITS_KEY,
]);

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,126}$/;

export function isValidAppSettingKey(key: string): boolean {
  return KEY_RE.test(key.trim());
}

export function canDeleteAppSettingKey(key: string): boolean {
  return !NON_DELETABLE_APP_SETTING_KEYS.has(key.trim());
}
