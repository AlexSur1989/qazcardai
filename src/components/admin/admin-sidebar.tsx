"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Shield } from "lucide-react";

import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { buttonVariants } from "@/components/ui/button";
import {
  ADMIN_NAV_GROUPS,
  adminNavItemActive,
} from "@/lib/admin-nav-config";
import { getAppName } from "@/lib/app-name";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/enums";

type AdminSidebarProps = {
  userEmail: string;
  role: UserRole;
};

export function AdminSidebar({ userEmail, role }: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appName = getAppName();

  const visibleGroups = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => hasPermission(role, item.permission))
      .map((item) => ({
        ...item,
        isActive: adminNavItemActive(pathname, item.href),
      })),
  })).filter((group) => group.items.length > 0);

  const mobileItems = visibleGroups.flatMap((group) => group.items);

  return (
    <aside className="border-border bg-sidebar text-sidebar-foreground flex w-full shrink-0 flex-col overflow-x-hidden border-b md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:max-h-[calc(100dvh-3.5rem)] md:w-64 md:min-w-64 md:max-w-64 md:flex-col md:border-r md:border-b-0">
      <MobileNavDrawer
        title={appName}
        items={mobileItems}
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
        className="hidden min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-2 md:flex"
        aria-label="Админ-разделы"
      >
        {visibleGroups.map((group) => (
          <details key={group.id} open className="group/nav">
            <summary
              className={cn(
                "text-muted-foreground flex cursor-pointer list-none items-center justify-between rounded-md px-2 py-1.5 text-[0.65rem] font-semibold tracking-wide uppercase select-none",
                "[&::-webkit-details-marker]:hidden",
              )}
            >
              <span>{group.title}</span>
              <ChevronDown
                className="size-3.5 shrink-0 transition-transform group-open/nav:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="mt-0.5 flex flex-col gap-0.5 pb-1">
              {group.items.map(({ href, label, icon: Icon, isActive }) => (
                <Link
                  key={href}
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
            </div>
          </details>
        ))}
      </nav>
    </aside>
  );
}
