/** Пользовательские тексты, когда AI-модель сценария ещё не подключена. */

export const PRODUCT_CARD_SCENARIO_SETUP_TITLE =
  "Этот сценарий ещё настраивается";

export const PRODUCT_CARD_SCENARIO_SETUP_BODY =
  "Мы подключаем AI-модель для этого типа карточек. Попробуйте позже или обратитесь в поддержку.";

export const PRODUCT_CARD_CLASSIFIER_MANUAL_HINT =
  "Автоматическое определение товара ещё настраивается. Пока выберите категорию самостоятельно — это поможет ИИ лучше оформить карточку.";

export const PRODUCT_CARD_CLASSIFIER_MANUAL_TITLE = "Выберите категорию вручную";

export const PRODUCT_CARD_VIDEO_COMING_SOON =
  "Видео для товаров скоро будет доступно — модель ещё подключается.";

/** Сообщение API/сервера → дружелюбный текст для USER. */
export function mapProductCardModelErrorForUser(
  message: string | null | undefined,
): string | null {
  if (!message?.trim()) return null;
  const raw = message.trim();
  if (
    raw.includes("не настроена") ||
    raw.includes("не настроен") ||
    raw.includes("not configured") ||
    raw.includes("PRODUCT_CARD")
  ) {
    return PRODUCT_CARD_SCENARIO_SETUP_BODY;
  }
  return null;
}
