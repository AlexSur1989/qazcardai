import type { ComponentType } from "react";
import {
  Ban,
  BarChart3,
  Bell,
  ClipboardList,
  Globe2,
  HardDrive,
  ImageIcon,
  LayoutDashboard,
  LineChart,
  PlugZap,
  Radio,
  Scale,
  ScrollText,
  Settings,
  Shield,
  Tag,
  Users,
  Video,
  Wallet,
  Banknote,
  BadgePercent,
  Inbox,
} from "lucide-react";

import type { Permission } from "@/lib/permissions";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  permission: Permission;
};

export type AdminNavGroup = {
  id: string;
  title: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "main",
    title: "Главное",
    items: [
      { href: "/admin", label: "Обзор", icon: LayoutDashboard, permission: "overview.view" },
      { href: "/admin/users", label: "Пользователи", icon: Users, permission: "users.view" },
      {
        href: "/admin/generations",
        label: "Генерации",
        icon: Video,
        permission: "generations.view_all",
      },
    ],
  },
  {
    id: "money",
    title: "Деньги",
    items: [
      {
        href: "/admin/payments/manual",
        label: "Заявки на пополнение",
        icon: Inbox,
        permission: "payments.view",
      },
      { href: "/admin/payments", label: "Платежи", icon: Wallet, permission: "payments.view" },
      { href: "/admin/finance", label: "Финансы", icon: BarChart3, permission: "finance.view" },
      {
        href: "/admin/credit-transactions",
        label: "Транзакции токенов",
        icon: Banknote,
        permission: "credit_transactions.view",
      },
      {
        href: "/admin/pricing",
        label: "Цены и тарифы",
        icon: BadgePercent,
        permission: "models.pricing.manage",
      },
      { href: "/admin/promo-codes", label: "Промокоды", icon: Tag, permission: "promocodes.manage" },
    ],
  },
  {
    id: "product",
    title: "Продукт",
    items: [
      {
        href: "/admin/product-card",
        label: "AI-карточки товара",
        icon: ImageIcon,
        permission: "models.product_card.manage",
      },
      { href: "/admin/models", label: "AI-модели", icon: Shield, permission: "models.view" },
    ],
  },
  {
    id: "content",
    title: "Контент и поддержка",
    items: [
      { href: "/admin/legal", label: "Юридические страницы", icon: Scale, permission: "legal.manage" },
      { href: "/admin/seo", label: "SEO", icon: Globe2, permission: "seo.manage" },
      { href: "/admin/moderation", label: "Модерация", icon: Ban, permission: "moderation.access" },
      {
        href: "/admin/notifications",
        label: "Уведомления",
        icon: Bell,
        permission: "notifications.manage",
      },
      { href: "/admin/audit-logs", label: "Аудит действий", icon: ScrollText, permission: "audit.view" },
    ],
  },
  {
    id: "developer",
    title: "Разработчику",
    items: [
      {
        href: "/admin/settings",
        label: "Настройки проекта",
        icon: Settings,
        permission: "settings.view",
      },
      { href: "/admin/providers", label: "Провайдеры / Kie", icon: PlugZap, permission: "providers.view" },
      { href: "/admin/storage", label: "Хранилище", icon: HardDrive, permission: "storage.manage" },
      { href: "/admin/webhooks", label: "Webhooks", icon: Radio, permission: "webhooks.view" },
      { href: "/admin/logs", label: "API логи", icon: LineChart, permission: "api_logs.view" },
      {
        href: "/admin/launch-checklist",
        label: "Чек-лист запуска",
        icon: ClipboardList,
        permission: "launch_checklist.view",
      },
    ],
  },
];

export function adminNavItemActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  if (href === "/admin/payments") {
    if (pathname === "/admin/payments") return true;
    if (pathname.startsWith("/admin/payments/") && !pathname.startsWith("/admin/payments/manual")) {
      return true;
    }
    return false;
  }
  if (href === "/admin/payments/manual") {
    return pathname === "/admin/payments/manual" || pathname.startsWith("/admin/payments/manual/");
  }
  if (href === "/admin/moderation") {
    return (
      pathname === "/admin/moderation" ||
      (pathname.startsWith("/admin/moderation/") && !pathname.startsWith("/admin/moderation/logs"))
    );
  }
  if (href === "/admin/generations") {
    return pathname === "/admin/generations" || pathname.startsWith("/admin/generations/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
