import type { ProductCardScenarioKey } from "@/server/services/productCardSettings";

export type ProductCardScenarioMeta = {
  id: ProductCardScenarioKey;
  title: string;
  description: string;
  clientHint: string;
  pricingHref: string;
  pricingLabel: string;
  generationsHref: string;
  scenariosHref: string;
  /** Порядок на вкладке «Обзор». */
  overviewOrder: number;
};

export const PRODUCT_CARD_SCENARIO_CATALOG: ProductCardScenarioMeta[] = [
  {
    id: "marketplaceCard",
    title: "Карточка для маркетплейса",
    description:
      "Одна витринная карточка для Kaspi, Wildberries и других маркетплейсов по фото товара.",
    clientHint: "Вкладка «Карточка для маркетплейса» в кабинете.",
    pricingHref: "/admin/pricing?tab=marketplace",
    pricingLabel: "Цены и тарифы → Карточка для маркетплейса",
    generationsHref: "/admin/generations",
    scenariosHref: "/admin/product-card?tab=scenarios",
    overviewOrder: 1,
  },
  {
    id: "conceptPhoto",
    title: "Фото с концепциями",
    description:
      "Несколько вариантов фото товара в разных визуальных концепциях для выбора лучшего.",
    clientHint: "Вкладка «Фото с концепциями» в кабинете.",
    pricingHref: "/admin/pricing?tab=concepts",
    pricingLabel: "Цены и тарифы → Фото с концепциями",
    generationsHref: "/admin/generations",
    scenariosHref: "/admin/product-card?tab=scenarios",
    overviewOrder: 2,
  },
  {
    id: "productVideo",
    title: "Видео товара",
    description: "Короткое видео товара по исходному фото — для карточки и рекламы.",
    clientHint: "Вкладка «Видео товара» в кабинете.",
    pricingHref: "/admin/pricing?tab=video",
    pricingLabel: "Цены и тарифы → Видео товара",
    generationsHref: "/admin/generations",
    scenariosHref: "/admin/product-card?tab=scenarios",
    overviewOrder: 3,
  },
];

export const PRODUCT_CARD_MAIN_TABS = [
  { id: "overview", label: "Обзор" },
  { id: "scenarios", label: "Сценарии" },
  { id: "texts", label: "Подсказки и тексты" },
  { id: "links", label: "Быстрые ссылки" },
] as const;

export const PRODUCT_CARD_ADVANCED_TABS = [
  { id: "settings", label: "AppSettings" },
  { id: "models", label: "Модели" },
  { id: "pricing", label: "Калькулятор цен" },
  { id: "categories", label: "Категории" },
  { id: "concepts", label: "Концепции" },
  { id: "prompts", label: "Промпты (legacy)" },
  { id: "simple-card-prompts", label: "Промпты простой карточки" },
  { id: "video", label: "Видео (техн.)" },
  { id: "calculator", label: "Калькулятор" },
] as const;

export type ProductCardMainTabId = (typeof PRODUCT_CARD_MAIN_TABS)[number]["id"];
export type ProductCardAdvancedTabId = (typeof PRODUCT_CARD_ADVANCED_TABS)[number]["id"];
export type ProductCardTabId = ProductCardMainTabId | ProductCardAdvancedTabId;

const ADVANCED_TAB_SET = new Set<string>(PRODUCT_CARD_ADVANCED_TABS.map((t) => t.id));
const MAIN_TAB_SET = new Set<string>(PRODUCT_CARD_MAIN_TABS.map((t) => t.id));
const ALL_TAB_SET = new Set<string>([...ADVANCED_TAB_SET, ...MAIN_TAB_SET]);

export function isProductCardAdvancedTab(tab: string): tab is ProductCardAdvancedTabId {
  return ADVANCED_TAB_SET.has(tab);
}

export function isProductCardTab(tab: string | undefined): tab is ProductCardTabId {
  return Boolean(tab && ALL_TAB_SET.has(tab));
}

export function resolveProductCardTab(input: {
  tab?: string;
  advanced?: string;
}): { tab: ProductCardTabId; showAdvanced: boolean } {
  const tabRaw = input.tab?.trim();
  const tab = isProductCardTab(tabRaw) ? tabRaw : "overview";
  const forceAdvanced = input.advanced === "1" || input.advanced === "true";
  const showAdvanced = forceAdvanced || isProductCardAdvancedTab(tab);
  return { tab, showAdvanced };
}

export const PRODUCT_CARD_QUICK_LINKS = [
  { label: "Цены и тарифы", href: "/admin/pricing" },
  { label: "Matrix видео товара", href: "/admin/pricing?tab=video" },
  { label: "Генерации", href: "/admin/generations" },
  { label: "AI-модели", href: "/admin/models" },
  { label: "Настройки системы (расшир.)", href: "/admin/settings" },
] as const;
