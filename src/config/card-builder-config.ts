/**
 * Единый источник правды для мастера «Создать карточку» (UI + API Zod).
 * Идентификаторы целей должны совпадать с ветвлением в productCardBuilderPlan.
 */

export const CARD_BUILDER_MARKETPLACES = [
  { id: "kaspi", label: "Kaspi" },
  { id: "halyk_market", label: "Halyk Market" },
  { id: "olx", label: "OLX" },
  { id: "lamoda", label: "Lamoda" },
  { id: "wildberries", label: "Wildberries" },
  { id: "ozon", label: "Ozon" },
  { id: "yandex_market", label: "Яндекс Маркет" },
  { id: "avito", label: "Avito" },
  { id: "amazon", label: "Amazon" },
  { id: "shopify", label: "Shopify" },
  { id: "instagram_vk", label: "Instagram / VK" },
  { id: "own_site", label: "Свой сайт" },
  { id: "other", label: "Другое" },
] as const;

export type CardBuilderMarketplaceId = (typeof CARD_BUILDER_MARKETPLACES)[number]["id"];

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

export const CARD_BUILDER_BENEFIT_TAGS = [
  { id: "design", label: "Дизайн" },
  { id: "material", label: "Материал" },
  { id: "size", label: "Размер" },
  { id: "comfort", label: "Комфорт" },
  { id: "reliability", label: "Надёжность" },
  { id: "premium_feel", label: "Премиальность" },
  { id: "gift", label: "Для подарка" },
  { id: "home", label: "Для дома" },
  { id: "office", label: "Для офиса" },
  { id: "sport", label: "Для спорта" },
  { id: "kitchen", label: "Для кухни" },
] as const;

export const CARD_BUILDER_MUST_SHOW = [
  { id: "texture", label: "фактуру" },
  { id: "scale", label: "масштаб" },
  { id: "usage", label: "использование" },
  { id: "packaging", label: "упаковку" },
  { id: "details", label: "детали" },
  { id: "color", label: "цвет" },
  { id: "brand_style", label: "брендовый стиль" },
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

/** Порядок слайдов для полной галереи из 6 (роли изображений Kie-плана) */
export const CARD_BUILDER_GALLERY_6_ROLES: readonly CardBuilderImageRole[] = [
  "main_photo",
  "benefits_infographic",
  "materials",
  "dimensions",
  "lifestyle",
  "premium_poster",
];

/** Порядок слайдов для полной галереи из 8 */
export const CARD_BUILDER_GALLERY_8_ROLES: readonly CardBuilderImageRole[] = [
  "main_photo",
  "benefits_infographic",
  "materials",
  "dimensions",
  "detail_closeup",
  "lifestyle",
  "packaging",
  "premium_poster",
];
