import type { Permission } from "@/lib/permissions";

/** Ключи, редактируемые в basic mode (безопасные бизнес-настройки). */
export const BASIC_EDITABLE_SETTING_KEYS = new Set([
  "APP_NAME",
  "SUPPORT_EMAIL",
  "DEFAULT_CURRENCY",
]);

export type SettingsBasicLinkCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  permission?: Permission;
};

export const SETTINGS_BASIC_LINK_CARDS: SettingsBasicLinkCard[] = [
  {
    id: "pricing",
    title: "Цены и тарифы",
    description:
      "Цены генераций, пакеты токенов, тарифы AI-карточек и matrix pricing редактируются в разделе «Цены и тарифы».",
    href: "/admin/pricing",
    permission: "models.pricing.manage",
  },
  {
    id: "topup",
    title: "Пополнение Kaspi / WhatsApp",
    description:
      "Номера Kaspi, инструкции и WhatsApp для ручного пополнения — в разделе «Цены и тарифы → Пополнение».",
    href: "/admin/pricing?tab=topup",
    permission: "models.pricing.manage",
  },
  {
    id: "product-card",
    title: "AI-карточки товара",
    description: "Сценарии, видимость вкладок и настройки карточки товара для клиентов.",
    href: "/admin/product-card",
    permission: "models.product_card.manage",
  },
  {
    id: "seo",
    title: "SEO",
    description: "Title, description, Open Graph и индексация лендинга.",
    href: "/admin/seo",
    permission: "seo.manage",
  },
  {
    id: "notifications",
    title: "Уведомления",
    description: "Email-шаблоны и настройки уведомлений пользователям и админам.",
    href: "/admin/notifications",
    permission: "notifications.manage",
  },
  {
    id: "legal",
    title: "Юридические страницы",
    description: "Публичные документы: оферта, privacy, refund policy.",
    href: "/admin/legal",
    permission: "legal.manage",
  },
  {
    id: "moderation",
    title: "Модерация",
    description: "Правила модерации промптов и запрещённые слова.",
    href: "/admin/moderation",
    permission: "moderation.access",
  },
];
