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
  BadgePercent,
} from "lucide-react";

import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { buttonVariants } from "@/components/ui/button";
import { getAppName } from "@/lib/app-name";
import type { Permission } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/enums";

const nav: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  permission: Permission;
}[] = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard, permission: "overview.view" },
  {
    href: "/admin/launch-checklist",
    label: "Чек-лист запуска / Launch Checklist",
    icon: ClipboardList,
    permission: "launch_checklist.view",
  },
  { href: "/admin/users", label: "Пользователи", icon: Users, permission: "users.view" },
  { href: "/admin/models", label: "Модели", icon: ImageIcon, permission: "models.view" },
  {
    href: "/admin/pricing",
    label: "Цены / Pricing",
    icon: BadgePercent,
    permission: "models.pricing.manage",
  },
  {
    href: "/admin/product-card",
    label: "Карточка товара / Product Card",
    icon: ImageIcon,
    permission: "models.product_card.manage",
  },
  { href: "/admin/providers", label: "Провайдеры", icon: PlugZap, permission: "providers.view" },
  { href: "/admin/storage", label: "Хранилище", icon: HardDrive, permission: "storage.manage" },
  { href: "/admin/generations", label: "Генерации", icon: Video, permission: "generations.view_all" },
  {
    href: "/admin/moderation",
    label: "Модерация / Moderation",
    icon: Ban,
    permission: "moderation.access",
  },
  {
    href: "/admin/moderation/logs",
    label: "Логи модерации / Moderation logs",
    icon: ScrollText,
    permission: "moderation.logs_view",
  },
  { href: "/admin/legal", label: "Юридические страницы / Legal Pages", icon: Scale, permission: "legal.manage" },
  { href: "/admin/payments", label: "Платежи", icon: Wallet, permission: "payments.view" },
  { href: "/admin/finance", label: "Финансы / Finance", icon: BarChart3, permission: "finance.view" },
  {
    href: "/admin/credit-transactions",
    label: "Транзакции токенов / Credit Transactions",
    icon: Banknote,
    permission: "credit_transactions.view",
  },
  { href: "/admin/token-packages", label: "Пакеты токенов", icon: Coins, permission: "token_packages.view" },
  { href: "/admin/promo-codes", label: "Промокоды", icon: Tag, permission: "promocodes.manage" },
  { href: "/admin/seo", label: "SEO / Лендинг и SEO", icon: Globe2, permission: "seo.manage" },
  {
    href: "/admin/notifications",
    label: "Уведомления / Notifications",
    icon: Bell,
    permission: "notifications.manage",
  },
  { href: "/admin/settings", label: "Настройки / Settings", icon: Settings, permission: "settings.view" },
  { href: "/admin/logs", label: "API логи", icon: LineChart, permission: "api_logs.view" },
  { href: "/admin/webhooks", label: "Webhooks", icon: Radio, permission: "webhooks.view" },
  { href: "/admin/audit-logs", label: "Аудит", icon: ScrollText, permission: "audit.view" },
];

type AdminSidebarProps = {
  userEmail: string;
  role: UserRole;
};

function navItemActive(
  pathname: string,
  href: string,
  label: string,
): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  const isGenerations = label === "Генерации";
  if (href === "/admin/moderation/logs") {
    return pathname === "/admin/moderation/logs";
  }
  const isModCenter = label.includes("Модерация") && label.includes("Moderation");
  if (isGenerations) {
    return (
      pathname === "/admin/generations" ||
      (pathname.startsWith("/admin/generations/") && pathname !== "/admin/generations")
    );
  }
  if (isModCenter) {
    return (
      pathname === "/admin/moderation" ||
      (pathname.startsWith("/admin/moderation/") &&
        !pathname.startsWith("/admin/moderation/logs"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ userEmail, role }: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const visible = nav.filter((n) => hasPermission(role, n.permission));
  const items = visible.map((n) => ({
    ...n,
    isActive: navItemActive(pathname, n.href, n.label),
  }));
  const appName = getAppName();

  return (
    <aside className="border-border bg-sidebar text-sidebar-foreground flex w-full shrink-0 flex-col overflow-x-hidden border-b md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:max-h-[calc(100dvh-3.5rem)] md:w-64 md:min-w-64 md:max-w-64 md:flex-col md:border-r md:border-b-0">
      <MobileNavDrawer
        title={appName}
        items={items}
        activeKey={`${pathname}?${searchParams.toString()}`}
      />

      <div className="border-border hidden items-center gap-2 border-b px-3 py-3 md:flex">
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
        className="hidden min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2 md:flex"
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
              "!h-auto min-h-9 w-full min-w-0 items-start justify-start gap-2 px-2 py-2 text-left text-[0.8rem] leading-snug whitespace-normal break-words [overflow-wrap:anywhere]",
            )}
          >
            <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
