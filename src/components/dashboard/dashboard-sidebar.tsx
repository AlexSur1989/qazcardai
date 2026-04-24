"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ImageIcon,
  LayoutDashboard,
  Settings,
  Sparkles,
  Video,
  Wallet,
} from "lucide-react";

import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
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

function linkActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar({ userEmail }: DashboardSidebarProps) {
  const pathname = usePathname();
  const items = nav.map((n) => ({
    ...n,
    isActive: linkActive(pathname, n.href),
  }));

  return (
    <aside className="border-border bg-sidebar text-sidebar-foreground flex w-full shrink-0 flex-col border-b md:w-56 md:shrink-0 md:border-r md:border-b-0">
      <MobileNavDrawer title="Кабинет" items={items} activeKey={pathname} />

      <p className="text-sidebar-foreground/80 hidden py-1 pr-2 pl-4 text-xs break-all md:block">
        {userEmail}
      </p>
      <nav
        className="hidden flex-col gap-0.5 p-2 md:flex"
        aria-label="Разделы личного кабинета"
      >
        {items.map(({ href, label, icon: Icon, isActive }) => (
          <Link
            key={href}
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
