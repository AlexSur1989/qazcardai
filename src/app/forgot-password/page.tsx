"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const cardClass =
  "w-full max-w-md rounded-2xl border border-[#b8dce6] bg-white p-8 shadow-sm shadow-sky-900/5";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setDevUrl(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        devResetUrl?: string;
      };
      if (res.status === 429) {
        setError("Слишком много запросов. Подождите и повторите.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить запрос");
        return;
      }
      if (data.message) {
        setDone(true);
        if (data.devResetUrl) setDevUrl(data.devResetUrl);
      }
    } catch {
      setError("Ошибка сети. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="from-muted/20 to-background min-h-dvh flex flex-col items-center justify-center bg-gradient-to-b px-4 py-12">
      <div className={cardClass}>
        <h1 className="text-2xl font-semibold tracking-tight">Восстановление пароля</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Введите email, и мы отправим ссылку для восстановления пароля.
        </p>

        {done ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-foreground">
              Если аккаунт с таким email существует, мы отправили ссылку для
              восстановления пароля.
            </p>
            {devUrl ? (
              <p className="rounded-md border border-dashed border-[#b8dce6] bg-sky-50/80 p-3 font-mono text-xs break-all text-muted-foreground">
                Dev: <a className="text-primary underline" href={devUrl}>{devUrl}</a>
              </p>
            ) : null}
            <p>
              <Link
                href="/auth/login"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Вернуться ко входу
              </Link>
            </p>
          </div>
        ) : (
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
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-lg border border-[#b8dce6]/80 px-3 py-2 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={loading} className="h-10 w-full">
              {loading ? "Отправка…" : "Отправить ссылку"}
            </Button>
          </form>
        )}

        {!done ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link
              href="/auth/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Вернуться ко входу
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
