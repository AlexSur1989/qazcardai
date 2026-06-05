import Link from "next/link";

import { AuthBrandLogo } from "@/components/auth/auth-brand-logo";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

type Props = {
  mode: AuthMode;
};

export function AuthHeader({ mode }: Props) {
  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#b8dce6]/60 bg-white/70 px-4 backdrop-blur-md sm:px-6">
      <AuthBrandLogo />
      <nav className="text-sm">
        {mode === "login" ? (
          <Link
            href="/register"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Регистрация
          </Link>
        ) : (
          <Link
            href="/login"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Вход
          </Link>
        )}
      </nav>
    </header>
  );
}

export function AuthTabs({ mode }: Props) {
  return (
    <div
      className="mb-6 flex rounded-xl border border-[#b8dce6] bg-[#e4f2f7]/80 p-1"
      role="tablist"
      aria-label="Вход или регистрация"
    >
      <Link
        href="/login"
        role="tab"
        aria-selected={mode === "login"}
        className={cn(
          "flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors",
          mode === "login"
            ? "bg-white text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Вход
      </Link>
      <Link
        href="/register"
        role="tab"
        aria-selected={mode === "register"}
        className={cn(
          "flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors",
          mode === "register"
            ? "bg-white text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Регистрация
      </Link>
    </div>
  );
}
