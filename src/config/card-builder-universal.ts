/**
 * Универсальный сценарий «Создать карточку» без привязки к маркетплейсам.
 * UI + Zod + planner + prompt builder.
 */

export const CARD_BUILDER_TARGET_PLATFORMS = [
  { id: "universal", label: "Универсальная карточка" },
  { id: "social", label: "Соцсети" },
  { id: "own_site", label: "Сайт" },
  { id: "marketplace", label: "Маркетплейс" },
] as const;

export type CardBuilderTargetPlatformId =
  (typeof CARD_BUILDER_TARGET_PLATFORMS)[number]["id"];

export const CARD_BUILDER_DEFAULT_TARGET_PLATFORM: CardBuilderTargetPlatformId = "universal";

/** Категории card_builder (не путать с PRODUCT_CATEGORY_IDS для concept/marketplace). */
export const CARD_BUILDER_UNIVERSAL_CATEGORY_IDS = [
  "auto",
  "clothing_shoes",
  "beauty_care",
  "home_interior",
  "kids_products",
  "sport_fitness",
  "auto_products",
  "jewelry_accessories",
  "food_drinks",
  "gadgets_tech",
  "other",
] as const;

export type CardBuilderUniversalCategoryId =
  (typeof CARD_BUILDER_UNIVERSAL_CATEGORY_IDS)[number];

export const CARD_BUILDER_UNIVERSAL_CATEGORIES: ReadonlyArray<{
  id: CardBuilderUniversalCategoryId;
  label: string;
}> = [
  { id: "auto", label: "Автоопределение" },
  { id: "clothing_shoes", label: "Одежда и обувь" },
  { id: "beauty_care", label: "Косметика и уход" },
  { id: "home_interior", label: "Дом и интерьер" },
  { id: "kids_products", label: "Детские товары" },
  { id: "sport_fitness", label: "Спорт и фитнес" },
  { id: "auto_products", label: "Автотовары" },
  { id: "jewelry_accessories", label: "Украшения и аксессуары" },
  { id: "food_drinks", label: "Еда и напитки" },
  { id: "gadgets_tech", label: "Гаджеты и техника" },
  { id: "other", label: "Прочее" },
];

export const CARD_BUILDER_CREATION_MODES = [
  { id: "single", label: "Одна карточка" },
  { id: "full_gallery", label: "Полная галерея" },
] as const;

export type CardBuilderCreationModeId = (typeof CARD_BUILDER_CREATION_MODES)[number]["id"];

export const CARD_BUILDER_SINGLE_CARD_TYPES = [
  { id: "auto", label: "Автоматически" },
  { id: "main_photo", label: "Главная карточка" },
  { id: "benefits_infographic", label: "Инфографика" },
  { id: "benefits_card", label: "Карточка преимуществ" },
  { id: "comparison", label: "Сравнение" },
  { id: "dimensions", label: "Размеры / характеристики" },
  { id: "packaging", label: "Комплектация" },
  { id: "instruction", label: "Инструкция" },
  { id: "specs_card", label: "Характеристики (таблица)" },
  { id: "social_proof", label: "Отзывы / доверие" },
  { id: "offer_card", label: "Акция / предложение" },
  { id: "before_after", label: "До / после" },
  { id: "premium_poster", label: "Premium-баннер" },
  { id: "lifestyle", label: "Lifestyle-карточка" },
  { id: "detail_closeup", label: "Детали товара" },
  { id: "materials", label: "Материал / фактура" },
] as const;

export type CardBuilderSingleCardTypeId =
  (typeof CARD_BUILDER_SINGLE_CARD_TYPES)[number]["id"];

export const CARD_BUILDER_VISUAL_STYLES = [
  { id: "auto", label: "Автоматически по товару" },
  { id: "minimalism", label: "Минимализм" },
  { id: "premium", label: "Premium" },
  { id: "bold_ad", label: "Яркая реклама" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "infographic", label: "Инфографика" },
] as const;

export type CardBuilderVisualStyleId = (typeof CARD_BUILDER_VISUAL_STYLES)[number]["id"];

export const CARD_BUILDER_PACKAGING_TYPES = [
  "none",
  "bottle",
  "box",
  "bag",
  "tube",
  "jar",
  "other",
] as const;

export type CardBuilderPackagingType = (typeof CARD_BUILDER_PACKAGING_TYPES)[number];

/** Стили категорий для universal prompt (секция STYLE). */
export const CARD_BUILDER_CATEGORY_VISUAL_STYLE_HINTS: Record<
  Exclude<CardBuilderUniversalCategoryId, "auto">,
  string
> = {
  beauty_care:
    "Чистый premium-дизайн; светлые фоны; стекло, вода, glow; мягкий свет; без медицинских обещаний.",
  home_interior:
    "Уют, интерьерные сцены, минимализм, натуральные материалы; без лишних предметов в комплекте.",
  kids_products:
    "Яркие дружелюбные цвета; безопасная визуальная подача; без агрессивной рекламы.",
  sport_fitness: "Энергия, контраст, динамика, движение; читаемый товар в кадре.",
  auto_products: "Тёмные цвета, металл, техно-дизайн, контраст; без выдуманных характеристик.",
  jewelry_accessories:
    "Luxury-подача, мягкие отражения, премиальный свет; аккуратная типографика.",
  food_drinks:
    "Аппетитная съёмка, тёплые цвета, крупные планы; без health claims без текста пользователя.",
  clothing_shoes:
    "Fashion/catalog, чистый фон, ткань, посадка, детали; без выдуманного состава.",
  gadgets_tech:
    "Техно-эстетика, чистый контраст, интерфейс и функции только из фактов пользователя.",
  other: "Универсальный e-commerce, чистый фон, безопасная структура без выдуманных данных.",
};

export function labelForUniversalCategory(id: string): string {
  return (
    CARD_BUILDER_UNIVERSAL_CATEGORIES.find((c) => c.id === id)?.label ??
    CARD_BUILDER_UNIVERSAL_CATEGORIES.find((c) => c.id === "other")!.label
  );
}

export function parseUniversalCategoryId(raw: unknown): CardBuilderUniversalCategoryId {
  if (typeof raw !== "string") return "other";
  const t = raw.trim();
  if ((CARD_BUILDER_UNIVERSAL_CATEGORY_IDS as readonly string[]).includes(t)) {
    return t as CardBuilderUniversalCategoryId;
  }
  return "other";
}
