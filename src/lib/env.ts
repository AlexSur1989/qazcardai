/**
 * Центральное место для переменных окружения (Stage 17 — строгая валидация).
 * Сейчас только безопасные публичные значения для клиента.
 */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "",
} as const;
