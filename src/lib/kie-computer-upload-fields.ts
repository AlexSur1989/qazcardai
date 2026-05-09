/**
 * Имена полей settingsSchema: списки URL, которые во фронте всегда
 * задаются загрузкой файлов с компьютера (/api/uploads), не вводом raw URL в textarea.
 * Список поддерживают ассистенты и сид-скрипты (prefer type `image-upload-list` в новых моделях).
 */
export const KIE_SETTINGS_URL_LIST_FROM_COMPUTER = new Set([
  "imageUrls",
  "inputUrls",
  "referenceImageUrls",
]);
