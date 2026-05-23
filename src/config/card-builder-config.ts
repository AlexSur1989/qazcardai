/**
 * Единый источник правды для мастера «Создать карточку» (UI + API Zod).
 * Идентификаторы целей должны совпадать с ветвлением в productCardBuilderPlan.
 */

/** Legacy id в сохранённых планах; UI card_builder больше не выбирает площадку. */
export const CARD_BUILDER_DEFAULT_MARKETPLACE_ID = "other" as const;

export type CardBuilderMarketplaceId = typeof CARD_BUILDER_DEFAULT_MARKETPLACE_ID;

/** Цели мастера (id → подпись в UI); совпадают с switch в buildCardBuilderGalleryPlan */
export const CARD_BUILDER_GOALS = [
  { id: "main_photo", label: "Главное фото" },
  { id: "benefits_info", label: "Преимущества" },
  { id: "dimensions_slide", label: "Размеры" },
  { id: "materials_slide", label: "Материалы" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "detail_closeup", label: "Крупный план деталей" },
  { id: "packaging_kit", label: "Комплект / упаковка" },
  { id: "premium_poster", label: "Постер" },
  { id: "full_gallery_6", label: "Полная галерея 6 слайдов" },
  { id: "full_gallery_8", label: "Полная галерея 8 слайдов" },
] as const;

export type CardBuilderGoalId = (typeof CARD_BUILDER_GOALS)[number]["id"];

/** Роли изображений в плане (совпадают с CardBuilderSlideRole в сервисе плана) */
export type CardBuilderImageRole =
  | "main_photo"
  | "benefits_infographic"
  | "dimensions"
  | "materials"
  | "lifestyle"
  | "detail_closeup"
  | "packaging"
  | "premium_poster"
  | "ad_banner";

export const CARD_BUILDER_PRESERVE_ASPECTS = [
  { id: "shape", label: "форма" },
  { id: "color", label: "цвет" },
  { id: "logo", label: "логотип" },
  { id: "proportions", label: "пропорции" },
  { id: "material", label: "материал" },
  { id: "packaging", label: "упаковка" },
  { id: "details", label: "детали" },
] as const;

export const CARD_BUILDER_AUDIENCES = [
  { id: "women", label: "женщины" },
  { id: "men", label: "мужчины" },
  { id: "kids", label: "дети" },
  { id: "family", label: "семья" },
  { id: "office", label: "офис" },
  { id: "premium_audience", label: "премиум-аудитория" },
  { id: "mass_market", label: "массовый сегмент" },
  { id: "gift_segment", label: "подарок" },
] as const;

export type CardBuilderAudienceId = (typeof CARD_BUILDER_AUDIENCES)[number]["id"];

export const CARD_BUILDER_PRICE_SEGMENTS = [
  { id: "economy", label: "эконом" },
  { id: "middle", label: "средний" },
  { id: "premium", label: "премиум" },
  { id: "luxury", label: "люкс" },
] as const;

export const CARD_BUILDER_SALES_STYLES = [
  { id: "clean_catalog", label: "Чистый каталог" },
  { id: "light_marketplace", label: "Светлый маркетплейс" },
  { id: "premium", label: "Премиум" },
  { id: "cozy_lifestyle", label: "Уютный lifestyle" },
  { id: "minimalism", label: "Минимализм" },
  { id: "bold_ad", label: "Яркая реклама" },
  { id: "infographic", label: "Инфографика" },
  { id: "editorial", label: "Editorial" },
] as const;

export const CARD_BUILDER_TEXT_DENSITY = [
  { id: "none", label: "Без текста" },
  { id: "minimal", label: "Минимум: только заголовок" },
  { id: "medium", label: "Средне: заголовок + 3 преимущества" },
  { id: "heavy", label: "Много: преимущества + характеристики" },
  { id: "infographic", label: "Инфографика: выноски, иконки, цифры" },
] as const;

export const CARD_BUILDER_LANGUAGE_MODES = [
  { id: "auto", label: "Авто (по тексту)" },
  { id: "ru", label: "Русский" },
  { id: "kk", label: "Қазақша" },
  { id: "mixed", label: "Смешанный" },
] as const;

