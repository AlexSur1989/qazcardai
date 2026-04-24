"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ImageIcon, LayoutDashboard, Settings, Sparkles, Video, Wallet } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
    { href: "/dashboard/create/image", label: "Создать фото", icon: ImageIcon },
    { href: "/dashboard/create/video", label: "Создать видео", icon: Video },
    { href: "/dashboard/history", label: "История", icon: Sparkles },
    { href: "/dashboard/billing", label: "Биллинг", icon: Wallet },
    { href: "/dashboard/settings", label: "Настройки", icon: Settings },
  ];

type DashboardSidebarProps = {
  userEmail: string;
};

export function DashboardSidebar({ userEmail }: DashboardSidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="border-border bg-sidebar text-sidebar-foreground flex w-full shrink-0 flex-col border-b md:w-56 md:shrink-0 md:border-r md:border-b-0 md:pt-0">
      <p className="text-sidebar-foreground/80 hidden pt-0.5 pr-2 pb-1 pl-4 text-xs break-all md:block">
        {userEmail}
      </p>
      <nav
        className="flex flex-row gap-0.5 overflow-x-auto p-2 md:flex-col md:gap-0.5 md:overflow-visible md:p-2 md:pt-0"
        aria-label="Разделы личного кабинета"
      >
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
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
