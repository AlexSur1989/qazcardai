"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Ban,
  FileText,
  ImageIcon,
  LayoutDashboard,
  LineChart,
  Radio,
  ScrollText,
  Settings,
  Shield,
  Tag,
  Users,
  Video,
  Wallet,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/enums";

const nav: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/models", label: "Модели", icon: ImageIcon },
  { href: "/admin/generations", label: "Генерации", icon: Video },
  {
    href: "/admin/generations?status=BLOCKED",
    label: "Модерация",
    icon: Ban,
  },
  { href: "/admin/payments", label: "Платежи", icon: Wallet },
  { href: "/admin/promo-codes", label: "Промокоды", icon: Tag },
  { href: "/admin/settings", label: "Настройки", icon: Settings },
  { href: "/admin/logs", label: "API логи", icon: LineChart },
  { href: "/admin/webhooks", label: "Webhooks", icon: Radio },
  { href: "/admin/audit-logs", label: "Аудит", icon: ScrollText },
];

type AdminSidebarProps = {
  userEmail: string;
  role: UserRole;
};

export function AdminSidebar({ userEmail, role }: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <aside className="border-border bg-sidebar text-sidebar-foreground flex w-full shrink-0 flex-col border-b md:w-60 md:shrink-0 md:border-r md:border-b-0">
      <div className="border-border hidden items-center gap-2 border-b px-4 py-3 md:flex">
        <Shield className="text-sidebar-primary size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-foreground text-sm font-medium">Админ</p>
          <p className="text-muted-foreground truncate text-xs" title={userEmail}>
            {userEmail}
          </p>
        </div>
      </div>
      <p className="text-sidebar-foreground/80 px-4 pt-2 pb-0 text-xs md:hidden">
        {userEmail} · {role}
      </p>
      <nav
        className="flex flex-row gap-0.5 overflow-x-auto p-2 md:flex-col md:gap-0.5 md:overflow-visible"
        aria-label="Админ-разделы"
      >
        {nav.map(({ href, label, icon: Icon }) => {
          const isGenerations = label === "Генерации";
          const isModeration = label === "Модерация";
          const blockedView =
            pathname === "/admin/generations" &&
            searchParams.get("status") === "BLOCKED";
          const active =
            href === "/admin"
              ? pathname === "/admin"
              : isGenerations
                ? (pathname === "/admin/generations" && !blockedView) ||
                  (pathname.startsWith("/admin/generations/") &&
                    pathname !== "/admin/generations")
                : isModeration
                  ? blockedView
                  : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href + label}
              href={href}
              className={cn(
                buttonVariants({
                  variant: active ? "secondary" : "ghost",
                  size: "sm",
                }),
                "flex shrink-0 items-center justify-start gap-2",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
