/** Публичное имя продукта (сервер и клиент). Переопределение: `APP_NAME` или `NEXT_PUBLIC_APP_NAME`. */
export const DEFAULT_APP_NAME = "QazCard AI";

export const APP_DESCRIPTION =
  "AI-сервис для создания карточек товаров, фото и видео для маркетплейсов и соцсетей.";

export function getAppName(): string {
  const a =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_NAME?.trim()) ||
    (typeof process !== "undefined" && process.env.APP_NAME?.trim());
  return a || DEFAULT_APP_NAME;
}
