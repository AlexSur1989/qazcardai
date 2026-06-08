"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import type { DashboardNavItem } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

function navItemActive(pathname: string, itemHref: string): boolean {
  if (
    pathname.startsWith("/dashboard/create/image") ||
    pathname.startsWith("/dashboard/create/video")
  ) {
    return itemHref === "/dashboard/create/product-card";
  }

  if (itemHref === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

type Props = {
  items: DashboardNavItem[];
};

export function DashboardSidebarNav({ items }: Props) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="flex flex-col gap-0.5 p-2 pb-4"
      aria-label="Разделы личного кабинета"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = navItemActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }),
              "text-foreground hover:bg-primary/8 flex items-center justify-start gap-2",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className="text-left">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
