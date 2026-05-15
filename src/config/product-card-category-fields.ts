import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
import { PRODUCT_CATEGORY_IDS, type ProductCategoryId } from "@/config/product-card-categories";

export type ProductCardCategoryField = {
  key: string;
  label: string;
  placeholder?: string;
  type: "text" | "textarea" | "select" | "multi_select" | "number";
  optional: boolean;
  /** Если true (по умолчанию) — текст может попасть в locked phrases на нужных слайдах. */
  useAsExactText?: boolean;
  useAsCharacteristic?: boolean;
  useInSlideRoles?: CardBuilderTemplateSlideRole[];
  safetyRule?: string;
};

export type ProductCardCategoryFieldsConfig = {
  /** Совпадает с `ProductCategoryId` приложения (`apparel`, а не legacy «clothing»). */
  categoryKey: ProductCategoryId;
  label: string;
  fields: ProductCardCategoryField[];
};

const R = (
  roles: readonly CardBuilderTemplateSlideRole[],
): CardBuilderTemplateSlideRole[] => [...roles];

function def(
  opts: Omit<ProductCardCategoryField, "type" | "optional"> &
    Partial<Pick<ProductCardCategoryField, "type" | "optional">>,
): ProductCardCategoryField {
  return {
    type: opts.type ?? "text",
    optional: opts.optional !== false,
    useAsExactText: opts.useAsExactText !== false,
    ...opts,
  };
}

export function isProductCategoryId(id: string): id is ProductCategoryId {
  return (PRODUCT_CATEGORY_IDS as readonly string[]).includes(id);
}

/** Поля только для указанной категории карточки (Product Card). */
export function getProductCardCategoryFieldsConfig(
  categoryId: string | null | undefined,
): ProductCardCategoryFieldsConfig | null {
  if (!categoryId || !isProductCategoryId(categoryId)) return null;
  return PRODUCT_CARD_CATEGORY_FIELDS_REGISTRY[categoryId];
}

/** Без префикса safety в UI — см. блок в промпте. */
export const PRODUCT_CARD_CATEGORY_FIELDS_REGISTRY: Record<
  ProductCategoryId,
  ProductCardCategoryFieldsConfig
> = {
  apparel: {
    categoryKey: "apparel",
    label: "Одежда",
    fields: [
      def({
        key: "material",
        label: "Материал / ткань",
        placeholder: "например: хлопок, флис, полиэстер",
        type: "text",
        useAsCharacteristic: true,
        useInSlideRoles: R(["materials", "detail_closeup"]),
      }),
      def({
        key: "sizeRange",
        label: "Размеры / размерная сетка",
        placeholder: "например: S–XL, 42–48",
        useAsCharacteristic: true,
        useInSlideRoles: R(["dimensions"]),
      }),
      def({
        key: "fit",
        label: "Посадка / крой",
        placeholder: "например: свободная посадка, оверсайз, облегающий крой",
        useInSlideRoles: R(["detail_closeup", "lifestyle"]),
      }),
      def({
        key: "season",
        label: "Сезон",
        placeholder: "например: зима, лето, демисезон",
        useInSlideRoles: R(["lifestyle"]),
      }),
      def({
        key: "keyDetails",
        label: "Важные детали",
        placeholder: "например: молния, капюшон, карманы, швы",
        useInSlideRoles: R(["detail_closeup"]),
      }),
      def({
        key: "care",
        label: "Уход",
        placeholder: "например: машинная стирка 30°C",
        useInSlideRoles: R(["materials", "detail_closeup"]),
        optional: true,
      }),
    ],
  },
  accessories: {
    categoryKey: "accessories",
    label: "Аксессуары",
    fields: [
      def({
        key: "material",
        label: "Материал",
        placeholder: "например: кожа, металл, силикон",
        useInSlideRoles: R(["materials", "detail_closeup"]),
      }),
      def({
        key: "color",
        label: "Цвет",
        placeholder: "например: чёрный, синий, серебристый",
        useInSlideRoles: R(["main_photo", "detail_closeup"]),
      }),
      def({
        key: "sizeOrVolume",
        label: "Размер / объём",
        placeholder: "например: 560 мл, 20×10 см",
        useAsCharacteristic: true,
        useInSlideRoles: R(["dimensions"]),
      }),
      def({
        key: "keyDetails",
        label: "Детали",
        placeholder: "например: застёжка, ремешок, крышка, циферблат",
        useInSlideRoles: R(["detail_closeup"]),
      }),
      def({
        key: "packageInfo",
        label: "Комплектация / упаковка",
        placeholder: "например: коробка, чехол, ремешок",
        useInSlideRoles: R(["packaging"]),
      }),
      def({
        key: "useCase",
        label: "Где используется",
        placeholder: "например: спорт, прогулка, офис, подарок",
        useInSlideRoles: R(["lifestyle"]),
      }),
    ],
  },
  food_and_drinks: {
    categoryKey: "food_and_drinks",
    label: "Еда и напитки",
    fields: [
      def({
        key: "flavor",
        label: "Вкус",
        placeholder: "например: клубника, шоколад, классический",
        useInSlideRoles: R(["materials", "benefits_infographic"]),
      }),
      def({
        key: "volumeWeight",
        label: "Объём / вес",
        placeholder: "например: 500 мл, 250 г",
        useAsCharacteristic: true,
        useInSlideRoles: R(["dimensions", "benefits_infographic"]),
      }),
      def({
        key: "ingredients",
        label: "Состав",
        placeholder: "только если известен",
        useInSlideRoles: R(["materials"]),
      }),
      def({
        key: "packageInfo",
        label: "Упаковка / количество",
        placeholder: "например: 12 штук, пакет, банка",
        useInSlideRoles: R(["packaging", "benefits_infographic"]),
      }),
      def({
        key: "storage",
        label: "Условия хранения",
        placeholder: "например: хранить в сухом месте",
        useInSlideRoles: R(["benefits_infographic", "detail_closeup"]),
      }),
    ],
  },
  beauty_and_care: {
    categoryKey: "beauty_and_care",
    label: "Косметика и уход",
    fields: [
      def({
        key: "productType",
        label: "Тип средства",
        placeholder: "например: крем, шампунь, сыворотка",
        useInSlideRoles: R(["benefits_infographic", "detail_closeup"]),
      }),
      def({
        key: "skinHairType",
        label: "Для какого типа кожи/волос",
        placeholder: "например: сухая кожа, жирные волосы",
        useInSlideRoles: R(["materials", "benefits_infographic"]),
      }),
      def({
        key: "volume",
        label: "Объём",
        placeholder: "например: 50 мл, 250 мл",
        useAsCharacteristic: true,
        useInSlideRoles: R(["dimensions", "benefits_infographic"]),
      }),
      def({
        key: "texture",
        label: "Текстура",
        placeholder: "например: кремовая, гелевая, лёгкая",
        useInSlideRoles: R(["detail_closeup", "materials"]),
      }),
      def({
        key: "activeIngredients",
        label: "Активные компоненты",
        placeholder: "только если известны",
        useInSlideRoles: R(["materials"]),
      }),
      def({
        key: "effect",
        label: "Эффект",
        placeholder: "например: увлажнение, мягкость, сияние",
        useInSlideRoles: R(["materials", "benefits_infographic"]),
      }),
      def({
        key: "usage",
        label: "Способ применения",
        placeholder: "например: нанести на чистую кожу",
        useInSlideRoles: R(["benefits_infographic", "lifestyle"]),
      }),
    ],
  },
  gadgets_and_tech: {
    categoryKey: "gadgets_and_tech",
    label: "Гаджеты и техника",
    fields: [
      def({
        key: "model",
        label: "Модель",
        placeholder: "например: RMX-1115",
        useInSlideRoles: R(["main_photo", "benefits_infographic", "detail_closeup"]),
      }),
      def({
        key: "mainFunctions",
        label: "Основные функции",
        placeholder: "например: Bluetooth, шумоподавление, подсветка",
        useInSlideRoles: R(["benefits_infographic", "detail_closeup"]),
      }),
      def({
        key: "specs",
        label: "Характеристики",
        placeholder: "например: 5000 mAh, 128 GB, 1200 W",
        useAsCharacteristic: true,
        useInSlideRoles: R(["benefits_infographic", "detail_closeup", "dimensions"]),
      }),
      def({
        key: "compatibility",
        label: "Совместимость",
        placeholder: "например: iOS, Android, USB-C",
        useInSlideRoles: R(["detail_closeup", "benefits_infographic"]),
      }),
      def({
        key: "size",
        label: "Размеры",
        placeholder: "например: 15×8×2 см",
        useAsCharacteristic: true,
        useInSlideRoles: R(["dimensions"]),
      }),
      def({
        key: "packageInfo",
        label: "Комплектация",
        placeholder: "например: кабель, инструкция, чехол",
        useInSlideRoles: R(["packaging"]),
      }),
    ],
  },
  home_and_furniture: {
    categoryKey: "home_and_furniture",
    label: "Дом и мебель",
    fields: [
      def({
        key: "material",
        label: "Материал",
        placeholder: "например: дерево, металл, ткань",
        useInSlideRoles: R(["materials", "detail_closeup"]),
      }),
      def({
        key: "dimensions",
        label: "Размеры",
        placeholder: "например: 120×60×75 см",
        useAsCharacteristic: true,
        useInSlideRoles: R(["dimensions"]),
      }),
      def({
        key: "room",
        label: "Для какой комнаты",
        placeholder: "например: гостиная, кухня, спальня",
        useInSlideRoles: R(["lifestyle"]),
      }),
      def({
        key: "style",
        label: "Стиль интерьера",
        placeholder: "например: минимализм, лофт, сканди",
        useInSlideRoles: R(["lifestyle"]),
      }),
      def({
        key: "keyDetails",
        label: "Важные детали",
        placeholder: "например: мягкая спинка, деревянные ножки",
        useInSlideRoles: R(["detail_closeup"]),
      }),
      def({
        key: "packageInfo",
        label: "Комплектация",
        placeholder: "например: 2 стула в комплекте",
        useInSlideRoles: R(["packaging", "benefits_infographic"]),
      }),
    ],
  },
  other: {
    categoryKey: "other",
    label: "Прочее",
    fields: [
      def({
        key: "material",
        label: "Материал",
        placeholder: "если важно",
        useInSlideRoles: R(["materials"]),
      }),
      def({
        key: "dimensions",
        label: "Размеры / характеристики",
        placeholder: "только то, что точно известно",
        useInSlideRoles: R(["dimensions", "benefits_infographic"]),
      }),
      def({
        key: "keyDetails",
        label: "Важные детали",
        placeholder: "что обязательно показать",
        useInSlideRoles: R(["detail_closeup"]),
      }),
      def({
        key: "packageInfo",
        label: "Комплектация / упаковка",
        placeholder: "если есть",
        useInSlideRoles: R(["packaging"]),
      }),
      def({
        key: "useCase",
        label: "Где используется",
        placeholder: "например: дома, в офисе, на улице",
        useInSlideRoles: R(["lifestyle"]),
      }),
    ],
  },
};

const CATEGORY_AGGREGATE_SAFETY: Record<ProductCategoryId, readonly string[]> = {
  apparel: [
    "Не выдумывать состав ткани.",
    "Не менять цвет, фасон, логотип и принт без референса.",
    "Если клиент не дал числовые размеры — не добавлять вымышленную размерную сетку.",
  ],
  accessories: [
    "Не выдумывать материал, объём и размеры.",
    "Не добавлять комплектующие и упаковку, которые пользователь не перечислил.",
  ],
  food_and_drinks: [
    "Не выдумывать состав и БЖУ.",
    "Не использовать «органик», «полезный», «без сахара» и подобное без указания клиента.",
    "Не добавлять медицинские и лечебные утверждения.",
  ],
  beauty_and_care: [
    "Не выдумывать состав и клинический эффект.",
    "Не использовать формулировки «дерматологически доказано», лечение и медицину без указания клиента.",
  ],
  gadgets_and_tech: [
    "Не выдумывать мощность, объём памяти, автономность, водозащиту и гарантийные условия.",
    "Не придумывать функции и совместимость, которых нет в тексте пользователя.",
  ],
  home_and_furniture: [
    "Не выдумывать размеры, материал и комплектацию.",
    "Сохранять форму, цвет и материалы товара по референсу.",
    "Не добавлять лишние предметы в комплект без указания клиента.",
  ],
  other: [
    "Нейтральные формулировки без выдуманных характеристик и недоказанных claims.",
  ],
};

export function getCategoryFieldsSafetyBullets(categoryId: string | null | undefined): string[] {
  if (!categoryId || !isProductCategoryId(categoryId)) return [];
  const fieldRules = PRODUCT_CARD_CATEGORY_FIELDS_REGISTRY[categoryId].fields
    .map((f) => f.safetyRule?.trim())
    .filter((x): x is string => Boolean(x));
  const agg = CATEGORY_AGGREGATE_SAFETY[categoryId];
  return [...agg, ...fieldRules];
}
