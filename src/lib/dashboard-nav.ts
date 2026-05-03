import type { LucideIcon } from "lucide-react";
import {
  Image as ImageIcon,
  LayoutDashboard,
  Package,
  PlusCircle,
  Settings,
  Sparkles,
  Video,
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
  { href: "/dashboard/create", label: "Создать", icon: PlusCircle },
  { href: "/dashboard/create/image", label: "Создать фото", icon: ImageIcon },
  { href: "/dashboard/create/video", label: "Создать видео", icon: Video },
  {
    href: "/dashboard/create/product-card",
    label: "Создать карточку товара",
    icon: Package,
  },
  { href: "/dashboard/history", label: "История", icon: Sparkles },
  { href: "/dashboard/billing", label: "Биллинг", icon: Wallet },
  { href: "/dashboard/settings", label: "Настройки", icon: Settings },
];
