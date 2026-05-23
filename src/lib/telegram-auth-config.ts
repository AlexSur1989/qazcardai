import { getPublicAppUrl } from "@/lib/auth-public-url";

/**
 * Флаги и проверки для Telegram Login Widget. TELEGRAM_BOT_TOKEN — только server-side.
 */

export function isTelegramAuthEnabledFlag(): boolean {
  return process.env.TELEGRAM_AUTH_ENABLED?.trim().toLowerCase() === "true";
}

export function getTelegramBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token || null;
}

/** Имя бота для виджета (без @). NEXT_PUBLIC_* доступен на клиенте после сборки. */
export function getTelegramBotUsernameForWidget(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() ||
    process.env.TELEGRAM_BOT_USERNAME?.trim();
  if (!raw) return null;
  return raw.replace(/^@/, "");
}

export function isTelegramWidgetConfigured(): boolean {
  return Boolean(getTelegramBotToken() && getTelegramBotUsernameForWidget());
}

/** Показывать кнопку Telegram Login Widget на login/register. */
export function telegramAuthEnabledForUi(): boolean {
  return isTelegramAuthEnabledFlag() && isTelegramWidgetConfigured();
}

/** Публичный callback URL для data-auth-url виджета (server-side). */
export function getTelegramWidgetAuthCallbackUrl(callbackPath = "/dashboard"): string {
  const base = getPublicAppUrl();
  const safeCallback =
    callbackPath.startsWith("/") && !callbackPath.startsWith("//")
      ? callbackPath
      : "/dashboard";
  return `${base}/api/auth/telegram/callback?callbackUrl=${encodeURIComponent(safeCallback)}`;
}
