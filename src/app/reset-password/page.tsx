"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const cardClass =
  "w-full max-w-md rounded-2xl border border-[#b8dce6] bg-white p-8 shadow-sm shadow-sky-900/5";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className={cardClass}>
        <h1 className="text-2xl font-semibold tracking-tight">Новый пароль</h1>
        <p className="text-destructive mt-4 text-sm" role="alert">
          Ссылка восстановления недействительна.
        </p>
        <p className="mt-4">
          <Link
            href="/forgot-password"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Запросить новую ссылку
          </Link>
        </p>
        <p className="mt-2">
          <Link
            href="/login"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Вернуться ко входу
          </Link>
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          confirmPassword: confirm,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (res.status === 429) {
        setError("Слишком много попыток. Подождите и повторите.");
        return;
      }
      if (!res.ok) {
        setError(
          data.error ??
            "Ссылка восстановления недействительна или истекла.",
        );
        return;
      }
      if (data.message) {
        setDone(true);
      }
    } catch {
      setError("Ошибка сети. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={cardClass}>
        <h1 className="text-2xl font-semibold tracking-tight">Готово</h1>
        <p className="mt-4 text-sm text-foreground">
          Пароль успешно изменен. Теперь вы можете войти.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className={cn(buttonVariants(), "inline-flex w-full justify-center")}
          >
            Войти
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <h1 className="text-2xl font-semibold tracking-tight">Новый пароль</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Введите новый пароль для вашего аккаунта.
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Новый пароль
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
            className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-lg border border-[#b8dce6]/80 px-3 py-2 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-sm font-medium">
            Повторите пароль
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-lg border border-[#b8dce6]/80 px-3 py-2 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          />
        </div>
        {error ? (
          <div className="space-y-2">
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
            <p>
              <Link
                href="/forgot-password"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Запросить новую ссылку
              </Link>
            </p>
          </div>
        ) : null}
        <Button type="submit" disabled={loading} className="h-10 w-full">
          {loading ? "Сохранение…" : "Изменить пароль"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="from-muted/20 to-background min-h-dvh flex flex-col items-center justify-center bg-gradient-to-b px-4 py-12">
      <Suspense
        fallback={
          <div className="text-muted-foreground text-sm">Загрузка…</div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
