/** Пользовательские варианты сценария «Создать карточку» (id → подпись). */

export const CARD_BUILDER_MARKETPLACES: { id: string; label: string }[] = [
  { id: "wildberries", label: "Wildberries" },
  { id: "ozon", label: "Ozon" },
  { id: "yandex_market", label: "Яндекс Маркет" },
  { id: "avito", label: "Avito" },
  { id: "amazon", label: "Amazon" },
  { id: "shopify", label: "Shopify" },
  { id: "instagram_vk", label: "Instagram / VK" },
  { id: "own_site", label: "Свой сайт" },
  { id: "other", label: "Другое" },
];

export const CARD_BUILDER_GOALS: { id: string; label: string }[] = [
  { id: "main_photo", label: "Главное фото товара" },
  { id: "benefits_info", label: "Инфографика с преимуществами" },
  { id: "dimensions_slide", label: "Слайд с размерами" },
  { id: "materials_slide", label: "Слайд с материалами" },
  { id: "lifestyle", label: "Lifestyle / товар в использовании" },
  { id: "detail_closeup", label: "Крупный план деталей" },
  { id: "packaging_kit", label: "Комплект / упаковка" },
  { id: "premium_poster", label: "Премиальный рекламный постер" },
  { id: "full_gallery_6", label: "Полная галерея 6 слайдов" },
  { id: "full_gallery_8", label: "Полная галерея 8 слайдов" },
];

export const CARD_BUILDER_BENEFIT_TAGS: { id: string; label: string }[] = [
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
];

export const CARD_BUILDER_MUST_SHOW: { id: string; label: string }[] = [
  { id: "texture", label: "фактуру" },
  { id: "scale", label: "масштаб" },
  { id: "usage", label: "использование" },
  { id: "packaging", label: "упаковку" },
  { id: "details", label: "детали" },
  { id: "color", label: "цвет" },
  { id: "brand_style", label: "брендовый стиль" },
];

export const CARD_BUILDER_AUDIENCES: { id: string; label: string }[] = [
  { id: "women", label: "женщины" },
  { id: "men", label: "мужчины" },
  { id: "kids", label: "дети" },
  { id: "family", label: "семья" },
  { id: "office", label: "офис" },
  { id: "premium_audience", label: "премиум-аудитория" },
  { id: "mass_market", label: "массовый сегмент" },
  { id: "gift_segment", label: "подарок" },
];

export const CARD_BUILDER_PRICE_SEGMENTS: { id: string; label: string }[] = [
  { id: "economy", label: "эконом" },
  { id: "middle", label: "средний" },
  { id: "premium", label: "премиум" },
  { id: "luxury", label: "люкс" },
];

export const CARD_BUILDER_SALES_STYLES: { id: string; label: string }[] = [
  { id: "clean_catalog", label: "Чистый каталог" },
  { id: "light_marketplace", label: "Светлый маркетплейс" },
  { id: "premium", label: "Премиум" },
  { id: "cozy_lifestyle", label: "Уютный lifestyle" },
  { id: "minimalism", label: "Минимализм" },
  { id: "bold_ad", label: "Яркая реклама" },
  { id: "infographic", label: "Инфографика" },
  { id: "editorial", label: "Editorial" },
];

export const CARD_BUILDER_TEXT_DENSITY: { id: string; label: string }[] = [
  { id: "none", label: "Без текста" },
  { id: "minimal", label: "Минимум: только заголовок" },
  { id: "medium", label: "Средне: заголовок + 3 преимущества" },
  { id: "heavy", label: "Много: преимущества + характеристики" },
  { id: "infographic", label: "Инфографика: выноски, иконки, цифры" },
];

export const CARD_BUILDER_PRESERVE_ASPECTS: { id: string; label: string }[] = [
  { id: "shape", label: "форма" },
  { id: "color", label: "цвет" },
  { id: "logo", label: "логотип" },
  { id: "proportions", label: "пропорции" },
  { id: "material", label: "материал" },
  { id: "packaging", label: "упаковка" },
  { id: "details", label: "детали" },
];
