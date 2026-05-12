/**
 * Префиксы сценария «Создать карточку» (UI + валидация).
 * Серверным ключам сценария соответствует `card_builder` (не смешивать с marketplace_card).
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
  { id: "instagram_vk", label: "Instagram / VK" },
  { id: "own_site", label: "Свой сайт" },
  { id: "other", label: "Другое" },
] as const;

export type CardBuilderMarketplaceId = (typeof CARD_BUILDER_MARKETPLACES)[number]["id"];

export const CARD_BUILDER_GOALS = [
  { id: "main_photo", label: "Главное фото товара", imageRole: "main_photo" },
  {
    id: "benefits_infographic",
    label: "Инфографика с преимуществами",
    imageRole: "benefits_infographic",
  },
  { id: "dimensions", label: "Слайд с размерами", imageRole: "dimensions" },
  { id: "materials", label: "Слайд с материалами", imageRole: "materials" },
  { id: "lifestyle", label: "Lifestyle / товар в использовании", imageRole: "lifestyle" },
  { id: "detail_closeup", label: "Крупный план деталей", imageRole: "detail_closeup" },
  { id: "packaging", label: "Комплект / упаковка", imageRole: "packaging" },
  { id: "premium_poster", label: "Премиальный рекламный постер", imageRole: "premium_poster" },
  { id: "full_gallery_6", label: "Полная галерея 6 слайдов", imageRole: "gallery_6" },
  { id: "full_gallery_8", label: "Полная галерея 8 слайдов", imageRole: "gallery_8" },
] as const;

export type CardBuilderGoalId = (typeof CARD_BUILDER_GOALS)[number]["id"];

export type CardBuilderImageRole =
  | "main_photo"
  | "benefits_infographic"
  | "dimensions"
  | "materials"
  | "lifestyle"
  | "detail_closeup"
  | "packaging"
  | "premium_poster"
  | "ad_banner"
  | "gallery_6"
  | "gallery_8";

export const CARD_BUILDER_PRESERVE_ASPECTS = [
  "shape",
  "color",
  "logo",
  "proportions",
  "material",
  "packaging",
  "details",
] as const;

export type CardBuilderPreserveAspectId = (typeof CARD_BUILDER_PRESERVE_ASPECTS)[number];

export const CARD_BUILDER_BENEFIT_TAGS = [
  { id: "design", label: "Дизайн" },
  { id: "material", label: "Материал" },
  { id: "size", label: "Размер" },
  { id: "comfort", label: "Комфорт" },
  { id: "reliability", label: "Надёжность" },
  { id: "premium", label: "Премиальность" },
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
  { id: "women", label: "Женщины" },
  { id: "men", label: "Мужчины" },
  { id: "kids", label: "Дети" },
  { id: "family", label: "Семья" },
  { id: "office", label: "Офис" },
  { id: "premium", label: "Премиум-аудитория" },
  { id: "mass", label: "Массовый сегмент" },
  { id: "gift", label: "Подарок" },
] as const;

export type CardBuilderAudienceId = (typeof CARD_BUILDER_AUDIENCES)[number]["id"];

export const CARD_BUILDER_PRICE_SEGMENTS = [
  { id: "economy", label: "Эконом" },
  { id: "middle", label: "Средний" },
  { id: "premium_seg", label: "Премиум" },
  { id: "luxury", label: "Люкс" },
] as const;

export const CARD_BUILDER_SALES_STYLES = [
  { id: "clean_catalog", label: "Чистый каталог" },
  { id: "light_marketplace", label: "Светлый маркетплейс" },
  { id: "premium_sales", label: "Премиум" },
  { id: "cozy_lifestyle", label: "Уютный lifestyle" },
  { id: "minimalism", label: "Минимализм" },
  { id: "bright_ad", label: "Яркая реклама" },
  { id: "infographic", label: "Инфографика" },
  { id: "editorial", label: "Editorial" },
] as const;

export const CARD_BUILDER_TEXT_DENSITY = [
  { id: "none", label: "Без текста" },
  { id: "title_only", label: "Минимум: только заголовок" },
  { id: "medium", label: "Средне: заголовок + 3 преимущества" },
  { id: "heavy", label: "Много: преимущества + характеристики" },
  { id: "infographic", label: "Инфографика: выноски, иконки, цифры" },
] as const;

/** Порядок слайдов по умолчанию для галерей */
export const CARD_BUILDER_GALLERY_6_ROLES: CardBuilderImageRole[] = [
  "main_photo",
  "benefits_infographic",
  "materials",
  "dimensions",
  "lifestyle",
  "premium_poster",
];

export const CARD_BUILDER_GALLERY_8_ROLES: CardBuilderImageRole[] = [
  "main_photo",
  "benefits_infographic",
  "materials",
  "dimensions",
  "detail_closeup",
  "lifestyle",
  "packaging",
  "premium_poster",
];
