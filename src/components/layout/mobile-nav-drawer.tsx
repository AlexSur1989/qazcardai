"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

const navLinkBase =
  "!h-auto min-h-10 w-full items-start justify-start gap-2 py-2.5 whitespace-normal text-left break-words";

function MobileNavDrawerShell({ title, items }: Omit<Props, "activeKey">) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const overlay =
    mounted && open ? (
      <div
        className="fixed inset-0 z-[200] flex md:hidden"
        role="dialog"
        aria-modal="true"
        id="mobile-nav-panel"
      >
        <button
          type="button"
          className="bg-background/70 absolute inset-0 backdrop-blur-sm"
          aria-label="Закрыть меню"
          tabIndex={-1}
          onClick={() => setOpen(false)}
        />
        <nav
          className="bg-sidebar text-sidebar-foreground border-border relative z-10 flex h-full w-[min(20rem,88vw)] min-w-0 shrink-0 flex-col border-r shadow-xl"
          aria-label={title}
        >
          <div className="border-border shrink-0 border-b px-3 py-3">
            <p className="text-foreground text-sm font-semibold leading-tight">{title}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">Выберите раздел</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            <div className="flex flex-col gap-1">
              {items.map(({ href, label, icon: Icon, isActive }) => (
                <Link
                  key={href + label}
                  href={href}
                  className={cn(
                    buttonVariants({
                      variant: isActive ? "secondary" : "ghost",
                      size: "sm",
                    }),
                    navLinkBase,
                    isActive &&
                      "border border-primary/35 bg-primary/10 font-medium text-kaz-sky-deep",
                  )}
                  onClick={() => setOpen(false)}
                >
                  <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 break-words">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>
      </div>
    ) : null;

  return (
    <>
      <div className="border-border flex shrink-0 items-center justify-between border-b bg-white/90 px-3 py-2 backdrop-blur-sm md:hidden">
        <span className="text-foreground mr-2 min-w-0 truncate text-sm font-semibold tracking-tight">
          {title}
        </span>
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
      </div>
      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}

