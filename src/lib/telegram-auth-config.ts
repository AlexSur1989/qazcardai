/**
 * Флаги и проверки для входа через Telegram (OIDC). Секреты не экспортируем.
 */

export function isTelegramAuthEnabledFlag(): boolean {
  return process.env.TELEGRAM_AUTH_ENABLED?.trim().toLowerCase() === "true";
}

/** OIDC: Client ID + Secret из BotFather (Web Login). */
export function isTelegramOidcConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_CLIENT_ID?.trim() &&
      process.env.TELEGRAM_CLIENT_SECRET?.trim(),
  );
}

/** Показывать кнопку и регистрировать провайдер в NextAuth. */
export function isTelegramAuthConfigured(): boolean {
  return isTelegramAuthEnabledFlag() && isTelegramOidcConfigured();
}

/** Для страниц login/register (server components). */
export function telegramAuthEnabledForUi(): boolean {
  return isTelegramAuthConfigured();
}

/**
 * Предупреждение в лог при расхождении с APP_URL (не бросает).
 */
export function warnIfTelegramAllowedOriginMismatch(): void {
  const allowed = process.env.TELEGRAM_ALLOWED_ORIGIN?.trim();
  const base =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (!allowed || !base) return;
  try {
    if (new URL(allowed).origin !== new URL(base).origin) {
      console.warn(
        "[telegram] TELEGRAM_ALLOWED_ORIGIN не совпадает с origin AUTH_URL/NEXTAUTH_URL/APP_URL",
      );
    }
  } catch {
    console.warn("[telegram] TELEGRAM_ALLOWED_ORIGIN некорректен");
  }
}
