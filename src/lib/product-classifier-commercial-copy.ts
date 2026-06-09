export const PRODUCT_CLASSIFIER_INSUFFICIENT_CREDITS_ERROR =
  "Недостаточно токенов для распознавания товара.";

export const PRODUCT_CLASSIFIER_DAILY_LIMIT_ERROR =
  "Лимит распознаваний на сегодня исчерпан. Выберите категорию вручную.";

export const PRODUCT_CLASSIFIER_COOLDOWN_ERROR =
  "Подождите несколько секунд перед повторным распознаванием.";

export type ProductClassifierCommercialErrorCode =
  | "setup"
  | "insufficient_credits"
  | "daily_limit"
  | "cooldown";
