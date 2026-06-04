/**
 * Клиентский кабинет: нейтральные подписи без Kie/API/воркер/очереди.
 * Админка и сиды могут оставаться техническими.
 */

const TECH_SUBSTRINGS =
  /kie\.ai|kie_ai|kieaudio|kie\.?ai|\bkie\b|apiModelId|providerTaskId|payloadMapping|modelSlug|endpoint|queue job|воркер|worker|payload|KIE_API|MOCK_KIE|REDIS_URL|KIE_BASE_URL|docs\.kie|playground|gemini-omni-audio/i;

/** Подпись «провайдера» в каталоге моделей для пользователя. */
export function userFacingProviderLabel(
  provider: string | null | undefined,
  catalogProviderLabel?: string | null,
): string {
  const catalog = catalogProviderLabel?.trim();
  if (catalog && !isTechnicalProviderLabel(catalog)) {
    return catalog;
  }
  if (provider === "KIE_AI" || provider === "OTHER") {
    return "QazCard AI";
  }
  return "QazCard AI";
}

function isTechnicalProviderLabel(label: string): boolean {
  return TECH_SUBSTRINGS.test(label) || /^Kie\.ai$/i.test(label.trim());
}

function neutralizeTechnicalCopy(text: string): string {
  let s = text;
  s = s.replace(/Kie\.ai/gi, "сервис генерации");
  s = s.replace(/\bKie\b/gi, "сервис");
  s = s.replace(/\bkieAudioId\b/gi, "идентификатор голоса");
  s = s.replace(/gemini-omni-audio/gi, "синтез голоса");
  s = s.replace(/Run with API/gi, "");
  s = s.replace(/Playground[^\s,.]*/gi, "");
  s = s.replace(/docs\.kie\.ai[^\s),]*/gi, "");
  s = s.replace(/\(docs\.kie\.ai[^)]*\)/gi, "");
  s = s.replace(/apiModelId/gi, "");
  s = s.replace(/input\.\w+/g, "");
  s = s.replace(/payloadMapping/gi, "");
  s = s.replace(/MOCK_KIE[^\s.]*/gi, "");
  s = s.replace(/KIE_API_KEY[^\s.]*/gi, "");
  s = s.replace(/REDIS_URL[^\s.]*/gi, "");
  s = s.replace(/KIE_BASE_URL[^\s.]*/gi, "");
  s = s.replace(/\bAPI\b/g, "запрос");
  s = s.replace(/\(\s*\)/g, "");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

/** Санитизация helpText / описаний полей модели в форме. */
export function sanitizeUserFacingHelpText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const s = neutralizeTechnicalCopy(text.trim());
  return s.length ? s : null;
}

const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  audioIds: "Голос персонажа (опционально)",
  kieAudioId: "Идентификатор голоса",
};

/** Подпись поля настроек модели без технических имён провайдера. */
export function sanitizeUserFacingFieldLabel(
  label: string | null | undefined,
  fieldName?: string,
): string {
  const name = fieldName?.trim();
  if (name && FIELD_LABEL_OVERRIDES[name]) {
    return FIELD_LABEL_OVERRIDES[name];
  }
  const raw = (label ?? name ?? "Параметр").trim();
  if (TECH_SUBSTRINGS.test(raw)) {
    return sanitizeUserFacingHelpText(raw) ?? "Параметр";
  }
  return raw;
}

/** Сообщение об ошибке для API и UI кабинета. */
export function publicUserErrorMessage(
  message: string | null | undefined,
  fallback = "Не удалось выполнить запрос. Попробуйте позже.",
): string {
  if (!message?.trim()) return fallback;
  return sanitizeUserFacingErrorMessage(message) ?? fallback;
}

/** Ошибка/подсказка для UI: без внутренних терминов. */
export function sanitizeUserFacingErrorMessage(
  message: string | null | undefined,
): string | null {
  if (!message?.trim()) return null;
  const raw = message.trim();
  if (TECH_SUBSTRINGS.test(raw)) {
    return "Не удалось завершить генерацию. Попробуйте ещё раз или измените параметры.";
  }
  if (/KIE_API|apiModelId|payloadMapping|providerTaskId/i.test(raw)) {
    return "Не удалось завершить генерацию. Попробуйте позже.";
  }
  if (raw.length > 320) {
    return `${raw.slice(0, 320)}…`;
  }
  return raw;
}

export const USER_LABELS = {
  prompt: "Описание",
  promptOptional: "Описание (необязательно)",
  negativePrompt: "Что не показывать",
  negativePromptOptional: "Что не показывать (необязательно)",
  model: "Режим генерации",
  generationStarted: "Генерация запущена",
  generationQueued: "Генерация запущена",
  waiting: "Ожидает",
  generating: "Генерируется",
  searchByRequestText: "Поиск по тексту запроса",
  providerErrorFallback: "При сбое генерации токены обычно возвращаются на баланс.",
  uploadHintImage: "JPEG, PNG или WebP до 10 МБ",
  uploadHintFilesForGeneration:
    "Файлы загружаются на сервер — для генерации используются подготовленные ссылки.",
  motionUploadHint:
    "Загрузите фото персонажа и видео с движением. Мы используем только ваши загруженные файлы.",
  conceptPhotoHint:
    "Выберите концепцию и при необходимости опишите пожелания. Текст для генерации собирается на сервере автоматически.",
  videoMotionHint:
    "Без пресета камеры: в описание попадут только ваши пожелания и базовые правила качества.",
  notStartedYet: "Ещё не запущено",
  costDependsOnSettings: "Стоимость зависит от выбранных настроек.",
} as const;
