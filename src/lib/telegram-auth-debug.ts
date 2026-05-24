/** Безопасный debug-log для Telegram Login Widget (без секретов, hash и PII). */

export type TelegramCallbackFlowType = "legacy_widget" | "oidc" | "unknown";

const OIDC_QUERY_KEYS = ["code", "state", "id_token", "response_type", "scope"] as const;

export function classifyTelegramCallbackFlow(
  params: URLSearchParams,
): TelegramCallbackFlowType {
  if (OIDC_QUERY_KEYS.some((k) => params.has(k))) {
    return "oidc";
  }
  if (params.has("id") && params.has("hash") && params.has("auth_date")) {
    return "legacy_widget";
  }
  return "unknown";
}

/** @deprecated Используйте classifyTelegramCallbackFlow === "oidc" */
export function detectWrongTelegramOidcPayload(params: URLSearchParams): boolean {
  return classifyTelegramCallbackFlow(params) === "oidc";
}

export function safeCallbackQueryKeys(params: URLSearchParams): string[] {
  return [...params.keys()].sort();
}

export function logTelegramCallbackReceived(params: URLSearchParams): void {
  console.warn(
    "[telegram] telegram_callback_received:",
    JSON.stringify({
      flowType: classifyTelegramCallbackFlow(params),
      hasId: params.has("id"),
      hasHash: params.has("hash"),
      hasAuthDate: params.has("auth_date"),
      hasUsername: params.has("username"),
      receivedKeys: safeCallbackQueryKeys(params),
    }),
  );
}

export function logTelegramBotConfigDebug(input: {
  hasBotToken: boolean;
  hasBotUsername: boolean;
}): void {
  console.warn(
    "[telegram] bot_config:",
    JSON.stringify({
      hasBotToken: input.hasBotToken,
      hasBotUsername: input.hasBotUsername,
    }),
  );
}

export function logTelegramHashVerifyFieldKeys(fieldKeys: string[]): void {
  console.warn(
    "[telegram] hash_verify_field_keys:",
    JSON.stringify([...fieldKeys].sort()),
  );
}

export function logTelegramAuthFailure(reason: string): void {
  console.warn(`[telegram] auth failed reason: ${reason}`);
}

export function logTelegramAuthSuccess(targetPath: string): void {
  console.warn(`[telegram] auth success redirect: ${targetPath}`);
}

export type TelegramWidgetSignInFailureReason = "BLOCKED" | "INACTIVE" | "ERROR";

export function mapTelegramSignInFailureToDebugReason(
  code: TelegramWidgetSignInFailureReason,
): string {
  if (code === "BLOCKED" || code === "INACTIVE") return "db_error";
  return "user_create_failed";
}
