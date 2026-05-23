/** Безопасный debug-log для Telegram Login Widget (без секретов и hash). */
export function logTelegramAuthFailure(reason: string): void {
  console.warn(`[telegram] auth failed reason: ${reason}`);
}

export function detectWrongTelegramOidcPayload(
  params: URLSearchParams,
): boolean {
  return (
    params.has("code") ||
    params.has("state") ||
    params.has("id_token") ||
    params.has("response_type") ||
    params.has("scope")
  );
}
