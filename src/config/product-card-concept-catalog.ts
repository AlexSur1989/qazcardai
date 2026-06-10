/**
 * Каталог концепций для «Фото с conцепциями» — 11 категорий как в MANUAL_PRODUCT_CATEGORY_OPTIONS.
 * Превью-файлы можно добавить позже в public/product-card/concepts/{folder}/.
 */
import type { ProductCategory, ProductConcept, ProductCategoryId } from "@/config/product-card-categories";
import { MANUAL_PRODUCT_CATEGORY_OPTIONS } from "@/config/product-card-manual-categories";

function concept(
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

const ELECTRONICS: ProductCategory = {
  id: "electronics",
  label: "Электроника",
  description: "Смартфоны, ноутбуки, наушники, камеры — чёткая tech-подача.",
  subcategories: ["смартфоны", "ноутбуки", "наушники", "камеры", "гаджеты"],
  concepts: [
    concept("electronics", "studio_catalog", "Каталог студийно", "Нейтральный фон, чёткие грани", "catalog.jpg"),
    concept("electronics", "tech_ads", "Технологичный рекламный", "Hi-tech свет и контраст", "tech-ads.jpg"),
    concept("electronics", "in_use", "В использовании", "Руки, рабочий сценарий", "in-use.jpg"),
    concept("electronics", "detail_closeup", "Крупный план", "Экран, порты, кнопки", "details.jpg"),
    concept("electronics", "desk_setup", "Desk setup", "Рабочий стол, периферия", "desk.jpg"),
    concept("electronics", "hero_poster", "Hero poster", "Один сильный герой-кадр", "hero.jpg"),
  ],
};

const HOME_APPLIANCES: ProductCategory = {
  id: "home_appliances",
  label: "Бытовая техника",
  description: "Крупная и мелкая техника для дома, фитнес-оборудование.",
  subcategories: ["кухня", "климат", "уборка", "фитнес", "стиральные машины"],
  concepts: [
    concept("home-appliances", "studio_catalog", "Каталог студийно", "Чистый фон, масштаб товара", "catalog.jpg"),
    concept("home-appliances", "in_home", "В домашней обстановке", "Кухня, зал, бытовой контекст", "in-home.jpg"),
    concept("home-appliances", "in_use", "В использовании", "Человек использует технику", "in-use.jpg"),
    concept("home-appliances", "detail_panel", "Панель / детали", "Дисплей, кнопки, управление", "panel.jpg"),
    concept("home-appliances", "lifestyle_room", "Lifestyle в комнате", "Уютный интерьер вокруг техники", "lifestyle.jpg"),
    concept("home-appliances", "hero_poster", "Рекламный постер", "Сильный коммерческий кадр", "hero.jpg"),
  ],
};

const APPAREL: ProductCategory = {
  id: "apparel",
  label: "Одежда",
  description: "Одежда и верх — fashion и e-commerce съёмка.",
  subcategories: ["верх", "низ", "верхняя одежда", "спортивная одежда"],
  concepts: [
    concept("apparel", "on_model", "На модели", "Fashion-подача на модели", "on-model.jpg"),
    concept("apparel", "studio_catalog", "Каталог студийно", "E-commerce на нейтрале", "catalog-studio.jpg"),
    concept("apparel", "flat_lay", "Раскладка сверху", "Flat lay сверху", "flat-lay.jpg"),
    concept("apparel", "lifestyle_hands", "Lifestyle / в руках", "Повседневный сценарий", "lifestyle.jpg"),
    concept("apparel", "fabric_closeup", "Крупный план ткани", "Фактура и швы", "fabric-close-up.jpg"),
    concept("apparel", "full_look", "Образ целиком", "Полный look", "full-outfit.jpg"),
  ],
};

const FOOTWEAR: ProductCategory = {
  id: "footwear",
  label: "Обувь",
  description: "Кроссовки, ботинки, туфли — акцент на форме и материале.",
  subcategories: ["кроссовки", "ботинки", "туфли", "сандалии"],
  concepts: [
    concept("footwear", "on_feet", "На ногах", "Обувь на модели в движении", "on-feet.jpg"),
    concept("footwear", "studio_catalog", "Каталог студийно", "Пара на нейтральном фоне", "catalog.jpg"),
    concept("footwear", "flat_lay", "Раскладка сверху", "Пара сверху, editorial layout", "flat-lay.jpg"),
    concept("footwear", "lifestyle_street", "Street lifestyle", "Городской casual сценарий", "street.jpg"),
    concept("footwear", "material_closeup", "Материал / подошва", "Макро фактуры и подошвы", "details.jpg"),
    concept("footwear", "hero_poster", "Hero poster", "Рекламный hero-кадр", "hero.jpg"),
  ],
};

const BEAUTY: ProductCategory = {
  id: "beauty_and_care",
  label: "Косметика",
  description: "Косметика, уход, флаконы — clean beauty эстетика.",
  subcategories: ["уход", "макияж", "парфюм", "средства для волос"],
  concepts: [
    concept("beauty-and-care", "studio_catalog", "Каталог студийно", "Чистая beauty-предметка", "catalog.jpg"),
    concept("beauty-and-care", "beauty_premium", "Премиум beauty", "Глянец и премиальный свет", "premium.jpg"),
    concept("beauty-and-care", "ingredients", "С ингредиентами", "Ботаника и actives", "ingredients.jpg"),
    concept("beauty-and-care", "shelf_bathroom", "На полке / в ванной", "Бытовой интерьер", "bathroom.jpg"),
    concept("beauty-and-care", "texture", "Текстура продукта", "Крем, текстура, нанесение", "texture.jpg"),
    concept("beauty-and-care", "hands_model", "В руках / с моделью", "Нанесение, рука модели", "hands.jpg"),
  ],
};

const HOME_GOODS: ProductCategory = {
  id: "home_goods",
  label: "Товары для дома",
  description: "Декор, текстиль, посуда, хранение — предметка для дома.",
  subcategories: ["декор", "текстиль", "посуда", "хранение", "освещение"],
  concepts: [
    concept("home-goods", "studio_catalog", "Каталог студийно", "Предметка на нейтрале", "catalog.jpg"),
    concept("home-goods", "styled_shelf", "На полке", "Стильная полка или комод", "shelf.jpg"),
    concept("home-goods", "in_kitchen", "На кухне", "Кухонный контекст", "kitchen.jpg"),
    concept("home-goods", "lifestyle", "Lifestyle дома", "Живой домашний сценарий", "lifestyle.jpg"),
    concept("home-goods", "detail_closeup", "Детали / материал", "Фактура, крупный план", "details.jpg"),
    concept("home-goods", "gift_composition", "Подарочная композиция", "Still life, подарок", "gift.jpg"),
  ],
};

const KIDS: ProductCategory = {
  id: "kids",
  label: "Детские товары",
  description: "Игрушки, детская одежда, товары для детей — мягкая и безопасная подача.",
  subcategories: ["игрушки", "одежда", "коляски", "развивающие товары"],
  concepts: [
    concept("kids", "studio_catalog", "Каталог студийно", "Чистый фон, яркий товар", "catalog.jpg"),
    concept("kids", "playful_scene", "Игровая сцена", "Весёлая детская обстановка", "play.jpg"),
    concept("kids", "in_use_child", "Ребёнок использует", "Безопасный lifestyle с ребёнком", "in-use.jpg"),
    concept("kids", "nursery", "Детская комната", "Nursery интерьер", "nursery.jpg"),
    concept("kids", "detail_safe", "Детали / безопасность", "Крупный план материалов", "details.jpg"),
    concept("kids", "bright_ad", "Яркая реклама", "Контрастный детский постер", "promo.jpg"),
  ],
};

const ACCESSORIES: ProductCategory = {
  id: "accessories",
  label: "Аксессуары",
  description: "Сумки, часы, украшения, очки — premium retail.",
  subcategories: ["сумки", "часы", "украшения", "очки"],
  concepts: [
    concept("accessories", "studio_catalog", "Каталог студийно", "Чистая студийная подача", "catalog.jpg"),
    concept("accessories", "on_model", "На модели", "В образе, в использовании", "on-model.jpg"),
    concept("accessories", "premium_lifestyle", "Премиум lifestyle", "Премиальная атмосфера", "lifestyle.jpg"),
    concept("accessories", "detail_closeup", "Крупный план деталей", "Фурнитура, материал", "details.jpg"),
    concept("accessories", "in_composition", "В композиции", "Still life вокруг товара", "composition.jpg"),
    concept("accessories", "ad_poster", "Рекламный постер", "Витринный кадр", "promo.jpg"),
  ],
};

const FURNITURE: ProductCategory = {
  id: "furniture",
  label: "Мебель",
  description: "Столы, стулья, диваны, шкафы — интерьерные сцены.",
  subcategories: ["столы", "стулья", "диваны", "шкафы", "кровати"],
  concepts: [
    concept("furniture", "studio_catalog", "Каталог студийно", "Предметка на нейтрале", "catalog.jpg"),
    concept("furniture", "in_interior", "В интерьере", "Комната, правильный масштаб", "interior.jpg"),
    concept("furniture", "minimal", "Минимализм", "Мало предметов, воздух", "minimal.jpg"),
    concept("furniture", "cozy", "Cozy lifestyle", "Тёплый домашний свет", "cozy.jpg"),
    concept("furniture", "material_closeup", "Материал", "Дерево, ткань, фактура", "details.jpg"),
    concept("furniture", "premium_poster", "Премиум постер", "Editorial интерьер", "promo.jpg"),
  ],
};

const AUTO: ProductCategory = {
  id: "auto",
  label: "Авто",
  description: "Автоаксессуары, запчасти, товары для машины.",
  subcategories: ["аксессуары", "уход за авто", "интерьер авто", "инструменты"],
  concepts: [
    concept("auto", "studio_catalog", "Каталог студийно", "Чистый фон, tech/automotive clarity", "catalog.jpg"),
    concept("auto", "in_garage", "В гараже", "Гараж или мастерская", "garage.jpg"),
    concept("auto", "in_car", "В салоне авто", "Интерьер автомобиля", "interior.jpg"),
    concept("auto", "detail_closeup", "Крупный план", "Детали, материал, крепление", "details.jpg"),
    concept("auto", "lifestyle_drive", "Lifestyle / дорога", "Контекст использования в пути", "drive.jpg"),
    concept("auto", "hero_poster", "Hero poster", "Сильный automotive кадр", "hero.jpg"),
  ],
};

const UNIVERSAL: ProductCategory = {
  id: "universal",
  label: "Универсальная категория",
  description: "Если товар не попал в другие категории.",
  subcategories: ["разное", "универсальные товары"],
  concepts: [
    concept("universal", "studio_catalog", "Каталог студийно", "Универсальная студийная предметка", "catalog.jpg"),
    concept("universal", "lifestyle", "Lifestyle", "Живой реалистичный сценарий", "lifestyle.jpg"),
    concept("universal", "in_use", "В использовании", "Товар в применении", "in-use.jpg"),
  ],
};

/** Каноничный порядок — как в MANUAL_PRODUCT_CATEGORY_OPTIONS. */
export const MANUAL_CONCEPT_CATEGORIES: readonly ProductCategory[] = [
  ELECTRONICS,
  HOME_APPLIANCES,
  APPAREL,
  FOOTWEAR,
  BEAUTY,
  HOME_GOODS,
  KIDS,
  ACCESSORIES,
  FURNITURE,
  AUTO,
  UNIVERSAL,
] as const;

export const MANUAL_CONCEPT_CATEGORY_IDS = MANUAL_PRODUCT_CATEGORY_OPTIONS.map((o) => o.id);

const MANUAL_BY_ID = new Map<ProductCategoryId, ProductCategory>(
  MANUAL_CONCEPT_CATEGORIES.map((c) => [c.id, c]),
);

/** Legacy id → категория из каталога 11. */
const LEGACY_CONCEPT_CATEGORY_ALIASES: Partial<Record<ProductCategoryId, ProductCategoryId>> = {
  gadgets_and_tech: "electronics",
  home_and_furniture: "furniture",
  food_and_drinks: "universal",
  other: "universal",
};

export function resolveManualConceptCategoryId(
  categoryId: string | null | undefined,
): ProductCategoryId {
  const id = categoryId?.trim();
  if (!id) return "universal";
  if (MANUAL_BY_ID.has(id as ProductCategoryId)) return id as ProductCategoryId;
  const alias = LEGACY_CONCEPT_CATEGORY_ALIASES[id as ProductCategoryId];
  if (alias && MANUAL_BY_ID.has(alias)) return alias;
  return "universal";
}

export function getManualConceptCategory(
  categoryId: string | null | undefined,
): ProductCategory {
  const resolved = resolveManualConceptCategoryId(categoryId);
  return MANUAL_BY_ID.get(resolved) ?? UNIVERSAL;
}

export function getManualConceptsForCategory(
  categoryId: string | null | undefined,
): ProductConcept[] {
  return getManualConceptCategory(categoryId).concepts;
}
