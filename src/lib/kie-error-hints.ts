
/**
 * Текст про «Credits insufficient…» в ответе Kie — это баланс на стороне Kie.ai,
 * не внутриигровые токены приложения.
 */
export function isLikelyKieAccountInsufficientMessage(msg: string | null | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("credits insufficient") ||
    m.includes("isn't enough to run this request") ||
    m.includes("is not enough to run") ||
    m.includes("top up to continue") ||
    m.includes("please top up") ||
    m.includes("insufficient balance")
  );
}

export function isLikelyKieOverloadMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("нагрузк") ||
    m.includes("overload") ||
    m.includes("попробуйте позже") ||
    m.includes("try again later") ||
    m.includes("temporarily unavailable") ||
    m.includes("service unavailable") ||
    m.includes("too many requests") ||
    m.includes("rate limit") ||
    /\b502\b/.test(m) ||
    /\b503\b/.test(m) ||
    /\b429\b/.test(m)
  );
}

function isLikelyKieImageUrlError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("image download failed") ||
    m.includes("image url") ||
    m.includes("failed to download") ||
    m.includes("cannot download") ||
    (m.includes("http 403") && (m.includes("forbidden") || m.includes("image"))) ||
    m.includes("403: forbidden") ||
    m.includes("url not accessible") ||
    m.includes("invalid image url")
  );
}

function isLikelyKieAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    /\b401\b/.test(m) ||
    m.includes("unauthorized") ||
    m.includes("invalid api key") ||
    m.includes("invalid apikey") ||
    m.includes("authentication failed") ||
    m.includes("access denied")
  );
}

function isLikelyKieModelError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("model not found") ||
    m.includes("model not supported") ||
    m.includes("unsupported model") ||
    m.includes("invalid model") ||
    m.includes("unknown model")
  );
}

function isLikelyKiePayloadError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("invalid payload") ||
    m.includes("validation failed") ||
    m.includes("invalid parameter") ||
    m.includes("malformed json") ||
    m.includes("invalid field")
  );
}

/**
 * Сообщение для БД/истории/UI: без упоминания Kie, API-ключей и внутренних полей.
 */
export function explainKieErrorForUser(
  providerMessage: string | null | undefined,
  fallback: string,
): string {
  const raw = (providerMessage ?? "").trim() || fallback;
  if (isLikelyKieAccountInsufficientMessage(raw)) {
    return "Сервис генерации временно недоступен. Попробуйте позже или обратитесь в поддержку.";
  }
  if (isLikelyKieImageUrlError(raw)) {
    return "Не удалось использовать загруженное изображение. Загрузите файл ещё раз или выберите другой.";
  }
  if (isLikelyKieAuthError(raw)) {
    return "Генерация временно недоступна. Попробуйте позже.";
  }
  if (isLikelyKieModelError(raw)) {
    return "Выбранный режим генерации сейчас недоступен. Попробуйте другой режим или позже.";
  }
  if (isLikelyKiePayloadError(raw) && !isLikelyKieImageUrlError(raw)) {
    return "Проверьте параметры запроса и попробуйте снова.";
  }
  if (isLikelyKieOverloadMessage(raw)) {
    return "Сервис перегружен. Подождите несколько минут и запустите генерацию снова.";
  }
  if (/kie\.ai|\bkie\b|apiModelId|payloadMapping|KIE_API|providerTaskId/i.test(raw)) {
    return "Не удалось завершить генерацию. Попробуйте ещё раз или измените параметры.";
  }
  return raw.length > 400
    ? `${raw.slice(0, 400)}…`
    : raw.slice(0, 8000);
}
