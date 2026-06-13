import type { UserRole } from "@/generated/prisma/enums";
import { isAdminRole } from "@/lib/permissions";

export type DashboardNavIconKey =
  | "package"
  | "layout-dashboard"
  | "sparkles"
  | "history"
  | "wallet"
  | "settings";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: DashboardNavIconKey;
};

const ALL_ITEMS: DashboardNavItem[] = [
  { href: "/dashboard/create/product-card", label: "Создать карточку товара", icon: "package" },
  { href: "/dashboard/products", label: "Мои товары", icon: "package" },
  { href: "/dashboard", label: "Обзор", icon: "layout-dashboard" },
  { href: "/dashboard/models", label: "AI модели", icon: "sparkles" },
  { href: "/dashboard/history", label: "История", icon: "history" },
  { href: "/dashboard/billing", label: "Биллинг", icon: "wallet" },
  { href: "/dashboard/settings", label: "Настройки", icon: "settings" },
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
