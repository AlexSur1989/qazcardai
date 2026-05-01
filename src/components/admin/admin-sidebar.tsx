"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Ban,
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
  BarChart3,
  Bell,
  Coins,
  Globe2,
  ClipboardList,
} from "lucide-react";

import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { buttonVariants } from "@/components/ui/button";
import { getAppName } from "@/lib/app-name";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/enums";

const nav: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
  {
    href: "/admin/launch-checklist",
    label: "Чек-лист запуска / Launch Checklist",
    icon: ClipboardList,
  },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/models", label: "Модели", icon: ImageIcon },
  { href: "/admin/product-card", label: "Карточка товара / Product Card", icon: ImageIcon },
  { href: "/admin/providers", label: "Провайдеры", icon: PlugZap },
  { href: "/admin/storage", label: "Хранилище", icon: HardDrive },
  { href: "/admin/generations", label: "Генерации", icon: Video },
  {
    href: "/admin/moderation",
    label: "Модерация / Moderation",
    icon: Ban,
  },
  { href: "/admin/legal", label: "Юридические страницы / Legal Pages", icon: Scale },
  { href: "/admin/payments", label: "Платежи", icon: Wallet },
  { href: "/admin/finance", label: "Финансы / Finance", icon: BarChart3 },
  {
    href: "/admin/credit-transactions",
    label: "Транзакции токенов / Credit Transactions",
    icon: Banknote,
  },
  { href: "/admin/token-packages", label: "Пакеты токенов", icon: Coins },
  { href: "/admin/promo-codes", label: "Промокоды", icon: Tag },
  { href: "/admin/seo", label: "SEO / Лендинг и SEO", icon: Globe2 },
  {
    href: "/admin/notifications",
    label: "Уведомления / Notifications",
    icon: Bell,
  },
  { href: "/admin/settings", label: "Настройки / Settings", icon: Settings },
  { href: "/admin/logs", label: "API логи", icon: LineChart },
  { href: "/admin/webhooks", label: "Webhooks", icon: Radio },
  { href: "/admin/audit-logs", label: "Аудит", icon: ScrollText },
];

type AdminSidebarProps = {
  userEmail: string;
  role: UserRole;
};

function navItemActive(
  pathname: string,
  _searchParams: URLSearchParams,
  href: string,
  label: string,
): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  const isGenerations = label === "Генерации";
  const isModCenter = label === "Модерация / Moderation";
  if (isGenerations) {
    return (
      pathname === "/admin/generations" ||
      (pathname.startsWith("/admin/generations/") && pathname !== "/admin/generations")
    );
  }
  if (isModCenter) {
    return pathname === "/admin/moderation" || pathname.startsWith("/admin/moderation/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ userEmail, role }: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const items = nav.map((n) => ({
    ...n,
    isActive: navItemActive(pathname, searchParams, n.href, n.label),
  }));
  const appName = getAppName();

  return (
    <aside className="border-border bg-sidebar text-sidebar-foreground flex w-full shrink-0 flex-col border-b md:w-60 md:shrink-0 md:border-r md:border-b-0">
      <MobileNavDrawer
        title={appName}
        items={items}
        activeKey={`${pathname}?${searchParams.toString()}`}
      />

      <div className="border-border hidden items-center gap-2 border-b px-4 py-3 md:flex">
        <Shield className="text-sidebar-primary size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-foreground text-sm font-medium">{appName}</p>
          <p className="text-muted-foreground text-xs">Админ</p>
          <p className="text-muted-foreground truncate text-xs" title={userEmail}>
            {userEmail}
          </p>
        </div>
      </div>
      <p className="text-sidebar-foreground/80 hidden px-4 pt-2 pb-0 text-xs md:block">
        {userEmail} · {role}
      </p>
      <nav
        className="hidden flex-col gap-0.5 p-2 md:flex"
        aria-label="Админ-разделы"
      >
        {items.map(({ href, label, icon: Icon, isActive }) => (
          <Link
            key={href + label}
            href={href}
            className={cn(
              buttonVariants({
                variant: isActive ? "secondary" : "ghost",
                size: "sm",
              }),
              "flex items-center justify-start gap-2",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
