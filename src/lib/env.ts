/**
 * Обязательные переменные окружения (Stage 17).
 * Значения секретов никогда не логируем — только имена отсутствующих переменных.
 */

/** Проверяемые критичные ключи (без вывода значений). */
export const REQUIRED_ENV_NAMES = [
  "DATABASE_URL",
  "KIE_API_KEY",
  "KIE_BASE_URL",
  "REDIS_URL",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET",
] as const;

function hasValue(name: (typeof REQUIRED_ENV_NAMES)[number]): boolean {
  return Boolean(process.env[name]?.trim());
}

/**
 * Секрет сессии NextAuth: принимаем AUTH_SECRET или NEXTAUTH_SECRET (не логируем).
 */
function hasAuthSecret(): boolean {
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
    if (!hasValue(n)) m.push(n);
  }
  if (!hasAuthSecret()) {
    m.push("AUTH_SECRET (или NEXTAUTH_SECRET)");
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
