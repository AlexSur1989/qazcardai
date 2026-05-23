"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";

import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { Button } from "@/components/ui/button";
import { postAuthLandingPath } from "@/lib/auth";

type RegisterFormProps = {
  telegramAuthEnabled: boolean;
  telegramBotUsername?: string;
  telegramAuthUrl?: string;
};

function RegisterFormInner({
  telegramAuthEnabled,
  telegramBotUsername,
  telegramAuthUrl,
}: RegisterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthErr = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось зарегистрироваться");
        setLoading(false);
        return;
      }

      const signRes = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (!signRes?.ok || signRes.error) {
        router.push("/login?registered=1");
        router.refresh();
        setLoading(false);
        return;
      }

      const session = await getSession();
      const target = postAuthLandingPath(null, session?.user?.role);
      router.push(target);
      router.refresh();
    } catch {
      setError("Ошибка сети. Попробуйте снова.");
      setLoading(false);
    }
  }

  const showTelegramWidget =
    telegramAuthEnabled && telegramBotUsername && telegramAuthUrl;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Регистрация</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link
          href="/login"
          className="text-primary underline-offset-4 hover:underline"
        >
          Войти
        </Link>
      </p>

      {oauthErr ? (
        <p className="text-destructive mt-4 text-sm" role="alert">
          Не удалось войти через Telegram. Попробуйте ещё раз.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Имя (необязательно)
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
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
            Пароль (мин. 8 символов)
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
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
          {loading ? "Регистрация…" : "Зарегистрироваться"}
        </Button>
      </form>

      {showTelegramWidget ? (
        <div className="mt-6 space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background text-muted-foreground px-2">или</span>
            </div>
          </div>
          <TelegramLoginButton
            botUsername={telegramBotUsername}
            authUrl={telegramAuthUrl}
          />
        </div>
      ) : null}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          На главную
        </Link>
      </p>
    </main>
  );
}

export function RegisterForm(props: RegisterFormProps) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-12 text-sm text-muted-foreground">
          Загрузка…
        </main>
      }
    >
      <RegisterFormInner {...props} />
    </Suspense>
  );
}
