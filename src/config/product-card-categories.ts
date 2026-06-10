/**
 * Категории, подкатегории и концепции (публичные UI-данные).
 * Скрытые system prompts — только в `product-card-prompts.ts` (server-only).
 */
import {
  getManualConceptCategory,
  getManualConceptsForCategory,
  MANUAL_CONCEPT_CATEGORIES,
} from "@/config/product-card-concept-catalog";
export const PRODUCT_CATEGORY_IDS = [
  "apparel",
  "accessories",
  "food_and_drinks",
  "beauty_and_care",
  "gadgets_and_tech",
  "home_and_furniture",
  "other",
  /** Ручной выбор (marketplace flow, classifier missing) */
  "electronics",
  "home_appliances",
  "footwear",
  "home_goods",
  "kids",
  "furniture",
  "auto",
  "universal",
] as const;

export type ProductCategoryId = (typeof PRODUCT_CATEGORY_IDS)[number];

export type ProductConcept = {
  id: string;
  label: string;
  description: string;
  /**
   * Публичный URL без префикса `/public`: `/product-card/concepts/{категория}/{файл}`.
   * В имени файла допустимо любое расширение (или без него) — UI перебирает
   * webp/jpg/jpeg/png/svg/gif и варианты kebab/snake + id концепции.
   * Рекомендуемый размер: **300×300 px**, ~30–80 KB. Только UI; не уходит в API и промпты.
   */
  previewImage: string;
};

/** Fallback в UI, если файл отсутствует или не загрузился */
export const PRODUCT_CONCEPT_PREVIEW_PLACEHOLDER =
  "/product-card/concepts/placeholder.svg";

/** Папка в `public/product-card/concepts/` (kebab-case) */
export function productCategoryPreviewFolder(
  categoryId: ProductCategoryId,
): string {
  return categoryId.replace(/_/g, "-");
}

/**
 * @param previewFile имя файла в папке категории (любое расширение или без него), например `catalog.jpg` или `in_use`
 */
function conceptWithPreview(
  folder: string,
  id: string,
  label: string,
  description: string,
  previewFile: string,
): ProductConcept {
  return {
    id,
    label,
    description,
    previewImage: `/product-card/concepts/${folder}/${previewFile}`,
  };
}

export type ProductCategory = {
  id: ProductCategoryId;
  label: string;
  /** Краткое описание для карточки выбора категории (без промптов) */
  description: string;
  /** Подсказки по типам товара (для UI / классификатора) */
  subcategories: string[];
  concepts: ProductConcept[];
};

/** Публичный фрагмент: без systemPrompt (его нет в модели) */
export type PublicProductCategory = ProductCategory;

/** @deprecated Используйте ProductCategory */
export type ProductCategoryGroup = ProductCategory;

export const MARKETPLACE_CARD_STYLES = [
  { id: "clean_marketplace", label: "Чистый маркетплейс" },
  { id: "premium", label: "Премиум" },
  { id: "bright_advertising", label: "Яркий рекламный" },
  { id: "minimalist", label: "Минималистичный" },
  { id: "infographic", label: "Инфографика" },
] as const;

export const PRODUCT_VIDEO_MOTION_STYLES = [
  { id: "none", label: "Не выбирать" },
  { id: "smooth_zoom", label: "Плавное приближение" },
  { id: "orbit", label: "Плавное вращение" },
  { id: "cinematic_movement", label: "Cinematic movement" },
  { id: "subtle_animation", label: "Лёгкая анимация" },
  { id: "wow_effect", label: "Рекламный wow-effect" },
  { id: "premium_promo", label: "Premium promo" },
] as const;

export type MarketplaceCardStyle = (typeof MARKETPLACE_CARD_STYLES)[number]["id"];
export type ProductVideoMotionStyle = (typeof PRODUCT_VIDEO_MOTION_STYLES)[number]["id"];

const CATEGORIES: readonly ProductCategory[] = [
  {
    id: "apparel",
    label: "Одежда",
    description: "Верхняя одежда, обувь, головные уборы — для fashion- и каталожных сцен.",
    subcategories: ["одежда", "обувь", "головные уборы"],
    concepts: [
      conceptWithPreview(
        "apparel",
        "on_model",
        "На модели",
        "Модель в современной fashion-подаче",
        "on-model.jpg",
      ),
      conceptWithPreview(
        "apparel",
        "studio_catalog",
        "Каталог студийно",
        "Нейтральный фон, ровный свет, e-commerce",
        "catalog-studio.jpg",
      ),
      conceptWithPreview(
        "apparel",
        "flat_lay",
        "Раскладка сверху",
        "Flat lay, съёмка сверху",
        "flat-lay.jpg",
      ),
      conceptWithPreview(
        "apparel",
        "lifestyle_hands",
        "В руках / lifestyle",
        "Повседневный живой сценарий",
        "lifestyle.jpg",
      ),
      conceptWithPreview(
        "apparel",
        "fabric_closeup",
        "Крупный план ткани",
        "Фактура, швы, материал",
        "fabric-close-up.jpg",
      ),
      conceptWithPreview(
        "apparel",
        "full_look",
        "Образ целиком",
        "Полный look, комплект",
        "full-outfit.jpg",
      ),
    ],
  },
  {
    id: "accessories",
    label: "Аксессуары",
    description: "Сумки, украшения, очки, часы — акцент на деталях и премиум-подаче.",
    subcategories: ["сумки", "очки", "часы", "украшения"],
    concepts: [
      conceptWithPreview(
        "accessories",
        "studio_catalog",
        "Каталог студийно",
        "Чистая студийная подача",
        "catalog.jpg",
      ),
      conceptWithPreview(
        "accessories",
        "on_model",
        "На модели",
        "В образе, презентация в использовании",
        "on-model.jpg",
      ),
      conceptWithPreview(
        "accessories",
        "premium_lifestyle",
        "Премиум lifestyle",
        "Премиальная атмосфера",
        "lifestyle.jpg",
      ),
      conceptWithPreview(
        "accessories",
        "detail_closeup",
        "Крупный план деталей",
        "Фурнитура, материал, крой",
        "details.jpg",
      ),
      conceptWithPreview(
        "accessories",
        "in_composition",
        "В композиции",
        "Still life вокруг товара",
        "composition.jpg",
      ),
      conceptWithPreview(
        "accessories",
        "ad_poster",
        "Рекламный постер",
        "Витринный рекламный кадр",
        "promo.jpg",
      ),
    ],
  },
  {
    id: "food_and_drinks",
    label: "Еда и напитки",
    description: "Продукты, блюда, напитки и упаковка — аппетитная food-визуализация.",
    subcategories: ["продукты", "блюда", "напитки", "упаковка"],
    concepts: [
      conceptWithPreview(
        "food-and-drinks",
        "studio_catalog",
        "Каталог студийно",
        "Товар/упаковка, чистый фон",
        "catalog.jpg",
      ),
      conceptWithPreview(
        "food-and-drinks",
        "serving",
        "Сервировка",
        "Подача, сервировка",
        "serving.jpg",
      ),
      conceptWithPreview(
        "food-and-drinks",
        "ingredients",
        "С ингредиентами",
        "Состав, свежие акценты",
        "ingredients.jpg",
      ),
      conceptWithPreview(
        "food-and-drinks",
        "closeup_texture",
        "Крупный план",
        "Текстура, деталь, \"аппетитный\" макро",
        "close-up.jpg",
      ),
      conceptWithPreview(
        "food-and-drinks",
        "lifestyle_hands",
        "Lifestyle / в руках",
        "Реальное использование",
        "lifestyle.jpg",
      ),
      conceptWithPreview(
        "food-and-drinks",
        "ad_banner",
        "Рекламный баннер",
        "Баннерный, контрастный кадр",
        "promo.jpg",
      ),
    ],
  },
  {
    id: "beauty_and_care",
    label: "Косметика и уход",
    description: "Косметика, уход, флаконы и тюбики — чистая beauty-эстетика.",
    subcategories: ["банки", "флаконы", "тюбики"],
    concepts: [
      conceptWithPreview(
        "beauty-and-care",
        "studio_catalog",
        "Каталог студийно",
        "Чистая beauty-предметка",
        "catalog.jpg",
      ),
      conceptWithPreview(
        "beauty-and-care",
        "beauty_premium",
        "Премиум beauty shot",
        "Глянец, премиальный свет",
        "premium.jpg",
      ),
      conceptWithPreview(
        "beauty-and-care",
        "ingredients",
        "С ингредиентами",
        "Натуральные акценты, честная подача",
        "ingredients.jpg",
      ),
      conceptWithPreview(
        "beauty-and-care",
        "shelf_bathroom",
        "На полке / в ванной",
        "Бытовой интерьер",
        "bathroom.jpg",
      ),
      conceptWithPreview(
        "beauty-and-care",
        "texture",
        "Текстура продукта",
        "Крем, текстура, нанесение",
        "texture.jpg",
      ),
      conceptWithPreview(
        "beauty-and-care",
        "hands_model",
        "В руках / с моделью",
        "Рука или модель, нанесение",
        "hands.jpg",
      ),
    ],
  },
  {
    id: "gadgets_and_tech",
    label: "Гаджеты и техника",
    description: "Электроника, устройства, инструменты — чёткие детали и tech-визуал.",
    subcategories: ["электроника", "устройства", "инструменты"],
    concepts: [
      conceptWithPreview(
        "gadgets-and-tech",
        "studio_catalog",
        "Каталог студийно",
        "Нейтральный фон, чёткие грани",
        "catalog.jpg",
      ),
      conceptWithPreview(
        "gadgets-and-tech",
        "tech_ads",
        "Технологичный рекламный стиль",
        "Hi-tech, холодный/контрастный свет",
        "tech-ads.jpg",
      ),
      conceptWithPreview(
        "gadgets-and-tech",
        "in_use",
        "В использовании",
        "Сценарий применения",
        "in-use.jpg",
      ),
      conceptWithPreview(
        "gadgets-and-tech",
        "detail_closeup",
        "Крупный план деталей",
        "Порты, кнопки, экран",
        "details.jpg",
      ),
      conceptWithPreview(
        "gadgets-and-tech",
        "desk_setup",
        "На столе / desk setup",
        "Рабочий стол, периферия",
        "desk.jpg",
      ),
      conceptWithPreview(
        "gadgets-and-tech",
        "hero_poster",
        "Hero poster",
        "Один сильный герой-кадр",
        "hero.jpg",
      ),
    ],
  },
  {
    id: "home_and_furniture",
    label: "Дом и мебель",
    description: "Мебель, декор, свет — интерьерные сцены и предметка.",
    subcategories: ["мебель", "декор", "свет", "интерьерные предметы"],
    concepts: [
      conceptWithPreview(
        "home-and-furniture",
        "studio_catalog",
        "Каталог студийно",
        "Предметка на нейтрале",
        "catalog.jpg",
      ),
      conceptWithPreview(
        "home-and-furniture",
        "in_interior",
        "В интерьере",
        "Правильный масштаб, контекст",
        "interior.jpg",
      ),
      conceptWithPreview(
        "home-and-furniture",
        "minimal",
        "Минималистичный стиль",
        "Воздух, мало предметов",
        "minimal.jpg",
      ),
      conceptWithPreview(
        "home-and-furniture",
        "cozy",
        "Cozy lifestyle",
        "Тёплый домашний light",
        "cozy.jpg",
      ),
      conceptWithPreview(
        "home-and-furniture",
        "material_closeup",
        "Крупный план материала",
        "Дерево, ткань, фактура",
        "details.jpg",
      ),
      conceptWithPreview(
        "home-and-furniture",
        "premium_poster",
        "Премиум интерьерный постер",
        "Editorial, премиальная витрина",
        "promo.jpg",
      ),
    ],
  },
  {
    id: "other",
    label: "Прочее",
    description: "Категория по умолчанию, если товар не подошёл к списку.",
    subcategories: ["другое"],
    concepts: [
      conceptWithPreview(
        "other",
        "studio_catalog",
        "Каталог студийно",
        "Универсальная студийная предметка",
        "catalog.jpg",
      ),
      conceptWithPreview(
        "other",
        "lifestyle",
        "Lifestyle",
        "Живой сценарий",
        "lifestyle.jpg",
      ),
      conceptWithPreview(
        "other",
        "in_use",
        "В использовании",
        "Товар в реалистичном сценарии применения",
        "in-use.jpg",
      ),
    ],
  },
] as const;

export const PRODUCT_CATEGORY_GROUPS: ProductCategory[] = CATEGORIES as unknown as ProductCategory[];

export function getProductCategoryById(
  id: string | null | undefined,
): ProductCategory | undefined {
  if (!id) return undefined;
  const direct = MANUAL_CONCEPT_CATEGORIES.find((c) => c.id === id);
  if (direct) return direct;
  const legacy = CATEGORIES.find((c) => c.id === id);
  if (legacy) return legacy;
  const resolved = getManualConceptCategory(id);
  return MANUAL_CONCEPT_CATEGORIES.find((c) => c.id === resolved.id) ?? legacy;
}

/** @deprecated Используйте getProductCategoryById */
export const getCategoryGroup = getProductCategoryById;

export function getConceptsForCategory(
  categoryId: string | null | undefined,
): ProductConcept[] {
  return getManualConceptsForCategory(categoryId);
}

/**
 * Категории с концепциями для UI «Фото с conцепциями» (11 manual categories).
 */
export function getPublicProductCategories(): readonly PublicProductCategory[] {
  return MANUAL_CONCEPT_CATEGORIES;
}

export function getPublicMarketplaceCardStyles() {
  return MARKETPLACE_CARD_STYLES;
}

export function getPublicProductVideoMotionStyles() {
  return PRODUCT_VIDEO_MOTION_STYLES;
}
