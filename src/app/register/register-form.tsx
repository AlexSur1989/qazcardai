"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { Loader2, Mail, User } from "lucide-react";

import { AuthDivider, AuthLayout } from "@/components/auth/auth-layout";
import { AuthTabs } from "@/components/auth/auth-header";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { PasswordInput } from "@/components/auth/password-input";
import { TelegramAuthSection } from "@/components/auth/telegram-auth-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postAuthLandingPath } from "@/lib/auth";
import { oauthErrorMessage, type AuthOAuthProps } from "@/lib/auth-oauth-ui";

type RegisterFormProps = AuthOAuthProps;

function RegisterFormInner({
  googleAuthUiState,
  googleAuthStartUrl,
  telegramAuthEnabled,
  telegramBotUsername,
  telegramAuthUrl,
}: RegisterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthErr = searchParams.get("error");
  const oauthError = oauthErrorMessage(oauthErr);

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
    <AuthLayout mode="register">
      <AuthTabs mode="register" />
      <h1 className="text-2xl font-semibold tracking-tight">Регистрация</h1>

      <div className="mt-6 space-y-3">
        <GoogleLoginButton
          mode="register"
          uiState={googleAuthUiState}
          authStartUrl={googleAuthStartUrl}
        />
        {showTelegramWidget ? (
          <TelegramAuthSection
            mode="register"
            botUsername={telegramBotUsername}
            authUrl={telegramAuthUrl}
          />
        ) : null}
      </div>

      <AuthDivider />

      {oauthError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{oauthError}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Имя</Label>
          <div className="relative">
            <User
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 pl-9"
              disabled={loading}
              placeholder="Как к вам обращаться"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 pl-9"
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Пароль</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <p className="text-muted-foreground text-xs">Минимум 8 символов</p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Регистрация…
            </>
          ) : (
            "Зарегистрироваться"
          )}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Уже есть аккаунт?{" "}
        <Link
          href="/login"
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Войти
        </Link>
      </p>

      <p className="text-muted-foreground mt-4 text-center text-xs leading-relaxed">
        Создавая аккаунт, вы соглашаетесь с{" "}
        <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
          условиями сервиса
        </Link>
        .
      </p>
    </AuthLayout>
  );
}

export function RegisterForm(props: RegisterFormProps) {
  return (
    <Suspense
      fallback={
        <div className="auth-page-bg flex min-h-dvh items-center justify-center">
          <Loader2 className="text-primary size-8 animate-spin" aria-label="Загрузка" />
        </div>
      }
    >
      <RegisterFormInner {...props} />
    </Suspense>
  );
}
