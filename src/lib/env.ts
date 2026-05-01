/**
 * Обязательные переменные окружения (Stage 17).
 * Значения секретов никогда не логируем — только имена отсутствующих переменных.
 *
 * QUEUE_MODE:
 * - `inline` — локальная разработка без Redis/Bull; `REDIS_URL` не обязателен.
 * - `redis` (по умолчанию) — BullMQ, нужен `REDIS_URL` и процесс `npm run worker`.
 */

import {
  isLocalUploadStorageEffective,
  isUploadStorageLocalExplicitInProduction,
} from "@/lib/upload-storage-mode";

function isQueueModeInline(): boolean {
  return process.env.QUEUE_MODE?.trim().toLowerCase() === "inline";
}

/** В development при локальном хранилище (по умолчанию) S3-переменные не обязательны. */
function shouldRequireS3Env(): boolean {
  if (isUploadStorageLocalExplicitInProduction()) {
    return false;
  }
  if (process.env.NODE_ENV === "production") {
    return true;
  }
  return !isLocalUploadStorageEffective();
}

const S3_ENV_NAMES = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET",
] as const;

/** Проверяемые критичные ключи (без вывода значений). */
export const REQUIRED_ENV_NAMES = [
  "DATABASE_URL",
  "KIE_API_KEY",
  "KIE_BASE_URL",
  "REDIS_URL",
  ...S3_ENV_NAMES,
] as const;

function hasValue(name: (typeof REQUIRED_ENV_NAMES)[number]): boolean {
  return Boolean(process.env[name]?.trim());
}

/**
 * Секрет сессии NextAuth: принимаем AUTH_SECRET или NEXTAUTH_SECRET (не логируем).
 * Экспорт для проверок (например чек-лист запуска).
 */
export function hasAuthSecret(): boolean {
  return Boolean(
    process.env.AUTH_SECRET?.trim() ?? process.env.NEXTAUTH_SECRET?.trim(),
  );
}

/**
 * Список отсутствующих обязательных переменных (уже с учётом алиаса auth secret).
 */
export function getMissingRequiredEnv(): string[] {
  const m: string[] = [];
  for (const n of REQUIRED_ENV_NAMES) {
    if (n === "REDIS_URL" && isQueueModeInline()) {
      continue;
    }
    if ((S3_ENV_NAMES as readonly string[]).includes(n) && !shouldRequireS3Env()) {
      continue;
    }
    if (!hasValue(n)) m.push(n);
  }
  if (!hasAuthSecret()) {
    m.push("AUTH_SECRET (или NEXTAUTH_SECRET)");
  }
  if (isUploadStorageLocalExplicitInProduction()) {
    m.push("UPLOAD_STORAGE=local запрещён в production (нужен S3)");
  }
  return m;
}

/**
 * Логи без секретов: только перечисление имён.
 */
export function assertRequiredEnvOrThrow(): void {
  const missing = getMissingRequiredEnv();
  if (missing.length === 0) return;
  const msg = `[env] Не заданы обязательные переменные: ${missing.join(
    ", ",
  )}. См. .env.example.`;
  console.error(msg);
  throw new Error(msg);
}

/**
 * `true` во время `next build` / анализа, когда полный .env намеренно не задан.
 */
export function shouldSkipEnvValidationInThisProcess(): boolean {
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    return true;
  }
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return true;
  }
  return false;
}

/**
 * Клиентский фрагмент (только публичные поля, без секретов).
 */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "",
} as const;
