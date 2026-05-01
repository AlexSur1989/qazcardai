import { getRegistryEntry } from "@/config/app-settings-registry";
import { validateAppSettingValueForType } from "@/lib/app-setting-value";
import type { Prisma } from "@/generated/prisma/client";

export const MODERATION_APP_SETTING_KEYS = [
  "MODERATION_ENABLED",
  "MODERATION_BANNED_WORDS",
  "MODERATION_BLOCKED_PATTERNS",
  "MODERATION_MAX_PROMPT_LENGTH",
  "MODERATION_BLOCK_NSFW",
  "MODERATION_BLOCK_DEEPFAKE",
  "MODERATION_BLOCK_MINORS",
  "MODERATION_BLOCK_ILLEGAL",
  "MODERATION_REVIEW_MODE",
] as const;

export type ModerationAppSettingKey = (typeof MODERATION_APP_SETTING_KEYS)[number];

export type ModerationSettingsPatch = Partial<
  Record<ModerationAppSettingKey, unknown>
>;

/**
 * Возвращает значение, готовое к записи в `AppSetting.value`.
 */
export function validateAndCoerceModerationValue(
  key: ModerationAppSettingKey,
  value: unknown,
):
  | { ok: true; value: Prisma.InputJsonValue }
  | { ok: false; message: string } {
  const def = getRegistryEntry(key);
  if (!def) {
    return { ok: false, message: "unknown_key" };
  }
  if (key === "MODERATION_BANNED_WORDS" || key === "MODERATION_BLOCKED_PATTERNS") {
    if (!Array.isArray(value)) {
      return { ok: false, message: "Ожидается JSON array строк" };
    }
    if (!value.every((v) => typeof v === "string")) {
      return { ok: false, message: "Все элементы списка должны быть строками" };
    }
    return { ok: true, value: value as Prisma.InputJsonValue };
  }
  if (key === "MODERATION_MAX_PROMPT_LENGTH") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, message: "MODERATION_MAX_PROMPT_LENGTH: ожидается число" };
    }
    const n = Math.floor(value);
    if (n < 1 || n > 1_000_000) {
      return { ok: false, message: "MODERATION_MAX_PROMPT_LENGTH: 1..1000000" };
    }
    return { ok: true, value: n as unknown as Prisma.InputJsonValue };
  }
  return validateAppSettingValueForType(def.type, value) as
    | { ok: true; value: Prisma.InputJsonValue }
    | { ok: false; message: string };
}

export function parseModerationSettingsBody(
  body: unknown,
):
  | { ok: true; patch: ModerationSettingsPatch }
  | { ok: false; message: string } {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Некорректный body" };
  }
  const o = body as Record<string, unknown>;
  const patch: ModerationSettingsPatch = {};
  for (const key of MODERATION_APP_SETTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(o, key)) {
      patch[key] = o[key];
    }
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: "Нет полей MODERATION_*" };
  }
  return { ok: true, patch };
}
