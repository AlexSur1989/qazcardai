import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { TelegramLoginWidgetPayload } from "@/lib/telegram-profile";

export const TELEGRAM_LOGIN_MAX_AGE_SEC = 86_400;

export type TelegramLoginVerifyReason =
  | "missing_id"
  | "missing_hash"
  | "missing_auth_date"
  | "invalid_auth_date"
  | "expired_auth_date"
  | "future_auth_date"
  | "invalid_payload"
  | "invalid_hash"
  | "ok";

export type TelegramLoginVerifyResult =
  | {
      ok: true;
      payload: TelegramLoginWidgetPayload & {
        id: string;
        auth_date: string;
        hash: string;
      };
    }
  | {
      ok: false;
      reason: Exclude<TelegramLoginVerifyReason, "ok">;
      /** Имена полей data_check_string (без значений) — только для server debug. */
      fieldKeys?: string[];
    };

function buildDataCheckString(fields: Record<string, string>): string {
  return Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
}

/** Поля для data_check_string: все кроме hash; пустые/undefined пропускаем. */
export function payloadToCheckFields(
  payload: TelegramLoginWidgetPayload,
): Record<string, string> | null {
  if (!payload.id?.trim() || !payload.auth_date?.trim() || !payload.hash?.trim()) {
    return null;
  }

  const fields: Record<string, string> = {
    auth_date: payload.auth_date.trim(),
    id: payload.id.trim(),
  };

  for (const key of ["first_name", "last_name", "username", "photo_url"] as const) {
    const value = payload[key]?.trim();
    if (value) fields[key] = value;
  }

  return fields;
}

export function computeTelegramLoginHash(
  fields: Record<string, string>,
  botToken: string,
): string {
  const dataCheckString = buildDataCheckString(fields);
  const secretKey = createHash("sha256").update(botToken).digest();
  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

function compareTelegramHashes(computed: string, expectedRaw: string): boolean {
  const expected = expectedRaw.trim().toLowerCase();
  const actual = computed.toLowerCase();
  try {
    const a = Buffer.from(actual, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Проверка hash и auth_date для Telegram Login Widget. */
export function verifyTelegramLoginPayload(
  payload: TelegramLoginWidgetPayload,
  botToken: string,
  options?: { maxAgeSec?: number; nowSec?: number },
): TelegramLoginVerifyResult {
  const maxAgeSec = options?.maxAgeSec ?? TELEGRAM_LOGIN_MAX_AGE_SEC;
  const nowSec = options?.nowSec ?? Math.floor(Date.now() / 1000);

  if (!payload.id?.trim()) {
    return { ok: false, reason: "missing_id" };
  }
  if (!payload.hash?.trim()) {
    return { ok: false, reason: "missing_hash" };
  }
  if (!payload.auth_date?.trim()) {
    return { ok: false, reason: "missing_auth_date" };
  }

  const authDate = Number.parseInt(payload.auth_date.trim(), 10);
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, reason: "invalid_auth_date" };
  }
  if (nowSec - authDate > maxAgeSec) {
    return { ok: false, reason: "expired_auth_date" };
  }
  if (authDate - nowSec > 60) {
    return { ok: false, reason: "future_auth_date" };
  }

  const fields = payloadToCheckFields(payload);
  if (!fields) {
    return { ok: false, reason: "invalid_payload" };
  }

  const fieldKeys = Object.keys(fields);
  const computed = computeTelegramLoginHash(fields, botToken);
  if (!compareTelegramHashes(computed, payload.hash)) {
    return { ok: false, reason: "invalid_hash", fieldKeys };
  }

  return {
    ok: true,
    payload: {
      ...payload,
      id: payload.id.trim(),
      auth_date: payload.auth_date.trim(),
      hash: payload.hash.trim(),
    },
  };
}
