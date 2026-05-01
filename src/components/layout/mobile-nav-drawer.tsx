"use client";

import type { ComponentType } from "react";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MobileNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  isActive?: boolean;
};

type Props = {
  title: string;
  items: MobileNavItem[];
  /** Ключ для перерисовки при смене pathname (например pathname) */
  activeKey?: string;
};

export function MobileNavDrawer({ title, items, activeKey }: Props) {
  return (
    <MobileNavDrawerShell
      key={activeKey ?? "mobile-nav"}
      title={title}
      items={items}
    />
  );
}

function MobileNavDrawerShell({ title, items }: Omit<Props, "activeKey">) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-border flex items-center justify-between border-b bg-white/90 px-3 py-2 backdrop-blur-sm md:hidden">
      <span className="text-foreground text-sm font-semibold tracking-tight">{title}</span>
      <button
        type="button"
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "shrink-0",
        )}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
        <span className="sr-only">Меню</span>
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          role="dialog"
          aria-modal="true"
          id="mobile-nav-panel"
        >
          <button
            type="button"
            className="bg-background/60 absolute inset-0 backdrop-blur-sm"
            aria-label="Закрыть"
            onClick={() => setOpen(false)}
          />
          <nav
            className="bg-sidebar text-sidebar-foreground border-border relative z-10 flex h-full w-[min(18rem,100vw)] flex-col gap-0.5 border-r p-3 shadow-xl"
            aria-label={title}
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
                  "justify-start gap-2",
                  isActive &&
                    "border border-primary/35 bg-primary/10 font-medium text-kaz-sky-deep",
                )}
                onClick={() => setOpen(false)}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}

