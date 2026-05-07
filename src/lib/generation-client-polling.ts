/**
 * Интервал и число попыток опроса `/api/generations/:id` в UI после постановки задачи в очередь.
 * Серверная сторона: `GENERATION_POLL_MAX_ATTEMPTS` и `GENERATION_POLL_INTERVAL_MS` (.env).
 * Для картинок: итераций должно быть заметно больше, чем (попытки × интервал) на воркере, иначе UI отстанет после серверного таймаута.
 */
export const IMAGE_GENERATION_POLL_MAX_ITERATIONS = 260;
export const IMAGE_GENERATION_POLL_INTERVAL_MS = 2000;

/** Видео у провайдера может занимать заметно дольше минуты-двух. */
export const VIDEO_GENERATION_POLL_MAX_ITERATIONS = 150;
export const VIDEO_GENERATION_POLL_INTERVAL_MS = 4000;
