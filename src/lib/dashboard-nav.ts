import type { LucideIcon } from "lucide-react";
import {
  History,
  LayoutDashboard,
  Package,
  Settings,
  Sparkles,
  Wallet,
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Единый список пунктов кабинета (layout + при необходимости другие компоненты). */
export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
  { href: "/dashboard/models", label: "AI-модели", icon: Sparkles },
  {
    href: "/dashboard/create/product-card",
    label: "Создать карточку товара",
    icon: Package,
  },
  { href: "/dashboard/history", label: "История", icon: History },
  { href: "/dashboard/billing", label: "Биллинг", icon: Wallet },
  { href: "/dashboard/settings", label: "Настройки", icon: Settings },
];
