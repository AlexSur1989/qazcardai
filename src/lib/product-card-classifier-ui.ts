const USER_CLASSIFIER_FAILED_MESSAGE =
  "Не удалось автоматически определить категорию. Выберите подходящий вариант в списке ниже.";

/** Технические причины с бэкенда — не показываем пользователю. */
const INTERNAL_CLASSIFIER_REASON =
  /kie\.?ai|classifier|OPENAI_API_KEY|GEMINI_API_KEY|MOCK_KIE|Could not|Empty image|Unknown classifier|Classifier request|Сетевая ошибка при обращении|Пустой ответ/i;

/** Текст для UI: без упоминания Kie.ai и внутренних ошибок. */
export function formatProductCategoryClassifierReason(
  reason: string | undefined | null,
  classifierFailed?: boolean,
): string {
  if (classifierFailed) {
    return USER_CLASSIFIER_FAILED_MESSAGE;
  }
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (!trimmed) return "";
  if (INTERNAL_CLASSIFIER_REASON.test(trimmed)) {
    return USER_CLASSIFIER_FAILED_MESSAGE;
  }
  return trimmed;
}
