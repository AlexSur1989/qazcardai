
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
 * Сообщение для БД/истории/UI: безопасное пояснение по типичным ответам Kie.
 */
export function explainKieErrorForUser(
  providerMessage: string | null | undefined,
  fallback: string,
): string {
  const raw = (providerMessage ?? "").trim() || fallback;
  if (isLikelyKieAccountInsufficientMessage(raw)) {
    return [
      "Недостаточно credits на стороне Kie.ai (это не баланс токенов в приложении).",
      "Пополните баланс Kie или проверьте API-ключ.",
      `Детали: ${raw}`,
    ]
      .join(" ")
      .slice(0, 8000);
  }
  if (isLikelyKieImageUrlError(raw)) {
    return [
      "Kie не может открыть или скачать исходное изображение по переданному URL.",
      "Нужен публичный https-адрес (S3/R2/CDN). Локальный сервер Kie из интернета не достанет.",
      `Детали: ${raw}`,
    ]
      .join(" ")
      .slice(0, 8000);
  }
  if (isLikelyKieAuthError(raw)) {
    return `Kie API key invalid или запрос не авторизован. Проверьте KIE_API_KEY. Детали: ${raw}`.slice(
      0,
      8000,
    );
  }
  if (isLikelyKieModelError(raw)) {
    return `Неверный apiModelId или модель недоступна у Kie. Проверьте карточку модели в админке. Детали: ${raw}`.slice(
      0,
      8000,
    );
  }
  if (isLikelyKiePayloadError(raw) && !isLikelyKieImageUrlError(raw)) {
    return `Некорректный payload для модели Kie. Проверьте payloadMapping и поля input в админке. Детали: ${raw}`.slice(
      0,
      8000,
    );
  }
  if (isLikelyKieOverloadMessage(raw)) {
    return [
      "Провайдер Kie.ai или сеть до него временно перегружены (сервис может отвечать 502/503).",
      "Подождите несколько минут и запустите генерацию снова.",
      `Текст ответа: ${raw}`,
    ]
      .join(" ")
      .slice(0, 8000);
  }
  return raw.slice(0, 8000);
}
