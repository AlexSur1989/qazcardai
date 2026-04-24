"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

import { buttonVariants } from "@/components/ui/button";
import { canAccessAdminPanel } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          AI Media
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2">
          {status === "authenticated" && session?.user ? (
            <>
              <span className="text-muted-foreground hidden max-w-[10rem] truncate text-xs sm:inline sm:max-w-xs">
                {session.user.email}
              </span>
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Кабинет
              </Link>
              {canAccessAdminPanel(session.user.role) ? (
                <Link
                  href="/admin"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Админ
                </Link>
              ) : null}
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                onClick={() => void signOut({ callbackUrl: "/" })}
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Вход
              </Link>
              <Link
                href="/auth/register"
                className={cn(buttonVariants({ variant: "default", size: "sm" }))}
              >
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
