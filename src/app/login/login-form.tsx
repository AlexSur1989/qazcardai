"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  pickLoginRedirectParam,
  postAuthLandingPath,
} from "@/lib/auth";

function safePathCallback(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = pickLoginRedirectParam(
    searchParams.get("next"),
    searchParams.get("callbackUrl"),
  );
  const callbackUrl = safePathCallback(rawRedirect);
  const registered = searchParams.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      });
      if (res == null) {
        setError("Нет ответа от сервера. Обновите страницу и попробуйте снова.");
        return;
      }
      if (res.status === 429) {
        setError("Слишком много попыток входа. Подождите минуту и повторите.");
        return;
      }
      if (res.error) {
        if (res.error === "RateLimit") {
          setError("Слишком много попыток входа. Подождите минуту и повторите.");
          return;
        }
        setError("Неверный email или пароль");
        return;
      }
      if (res.ok) {
        const session = await getSession();
        const target = postAuthLandingPath(
          rawRedirect,
          session?.user?.role,
        );
        router.push(target);
        router.refresh();
        return;
      }
      setError("Не удалось войти. Попробуйте снова.");
    } catch {
      setError("Не удалось войти. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Вход</h1>
      <p className="text-muted-foreground flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="text-primary underline-offset-4 hover:underline"
          >
            Регистрация
          </Link>
        </span>
        <Link
          href="/forgot-password"
          className="text-primary shrink-0 underline-offset-4 hover:underline"
        >
          Забыли пароль?
        </Link>
      </p>

      {registered ? (
        <p className="mt-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Регистрация прошла успешно. Войдите с выбранным паролем.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading}>
          {loading ? "Вход…" : "Войти"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          На главную
        </Link>
      </p>
    </main>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-12 text-sm text-muted-foreground">
          Загрузка…
        </main>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
