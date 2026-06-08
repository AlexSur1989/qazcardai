import type { LucideIcon } from "lucide-react";
import {
  History,
  LayoutDashboard,
  Package,
  Settings,
  Sparkles,
  Wallet,
} from "lucide-react";

import type { UserRole } from "@/generated/prisma/enums";
import { isAdminRole } from "@/lib/permissions";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const ALL_ITEMS: DashboardNavItem[] = [
  { href: "/dashboard/create/product-card", label: "Создать карточку товара", icon: Package },
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
  { href: "/dashboard/models", label: "AI модели", icon: Sparkles },
  { href: "/dashboard/history", label: "История", icon: History },
  { href: "/dashboard/billing", label: "Биллинг", icon: Wallet },
  { href: "/dashboard/settings", label: "Настройки", icon: Settings },
];

/** @deprecated используйте getDashboardNavItemsForRole */
export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = ALL_ITEMS;

export function getDashboardNavItemsForRole(role: UserRole): DashboardNavItem[] {
  const showModelsCatalog = isAdminRole(role);
  return ALL_ITEMS.filter((item) => {
    if (item.href === "/dashboard/models") return showModelsCatalog;
    return true;
  });
}

export function canAccessDashboardModelsCatalog(role: UserRole): boolean {
  return isAdminRole(role);
}
