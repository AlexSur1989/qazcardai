"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn, useSession } from "next-auth/react";
import { Loader2, Mail } from "lucide-react";

import { AuthDivider, AuthLayout } from "@/components/auth/auth-layout";
import { AuthTabs } from "@/components/auth/auth-header";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { PasswordInput } from "@/components/auth/password-input";
import { TelegramAuthSection } from "@/components/auth/telegram-auth-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  pickLoginRedirectParam,
  postAuthLandingPath,
} from "@/lib/auth";
import { oauthErrorMessage, type AuthOAuthProps } from "@/lib/auth-oauth-ui";

function safePathCallback(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

type LoginFormProps = AuthOAuthProps;

function LoginFormInner({
  googleAuthUiState,
  googleAuthStartUrl,
  telegramAuthEnabled,
  telegramBotUsername,
  telegramAuthUrl,
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = pickLoginRedirectParam(
    searchParams.get("next"),
    searchParams.get("callbackUrl"),
  );
  const callbackUrl = safePathCallback(rawRedirect);
  const oauthErr = searchParams.get("error");
  const oauthError = oauthErrorMessage(oauthErr);
  const registered = searchParams.get("registered") === "1";

  const { data: clientSession, status: clientStatus } = useSession();
  useEffect(() => {
    if (clientStatus !== "authenticated" || !clientSession?.user) return;
    const target = postAuthLandingPath(rawRedirect, clientSession.user.role);
    router.replace(target);
  }, [clientStatus, clientSession, rawRedirect, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
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
        const target = postAuthLandingPath(rawRedirect, session?.user?.role);
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

  const showTelegramWidget =
    telegramAuthEnabled && telegramBotUsername && telegramAuthUrl;

  return (
    <AuthLayout mode="login">
      <AuthTabs mode="login" />
      <h1 className="text-2xl font-semibold tracking-tight">Вход</h1>

      <div className="mt-6 space-y-3">
        <GoogleLoginButton
          mode="login"
          uiState={googleAuthUiState}
          authStartUrl={googleAuthStartUrl}
        />
        {showTelegramWidget ? (
          <TelegramAuthSection
            mode="login"
            botUsername={telegramBotUsername}
            authUrl={telegramAuthUrl}
          />
        ) : null}
      </div>

      <AuthDivider />

      {registered ? (
        <Alert className="mb-4 border-[#b8dce6] bg-[#f6fcfe]">
          <AlertDescription>
            Регистрация прошла успешно. Войдите с выбранным паролем.
          </AlertDescription>
        </Alert>
      ) : null}

      {oauthError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{oauthError}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="border-input text-primary size-4 rounded border"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
            />
            <span>Запомнить меня</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-primary underline-offset-4 hover:underline"
          >
            Забыли пароль?
          </Link>
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
              Вход…
            </>
          ) : (
            "Войти"
          )}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Нет аккаунта?{" "}
        <Link
          href="/register"
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Регистрация
        </Link>
      </p>

      <p className="text-muted-foreground mt-4 text-center text-xs leading-relaxed">
        Мы используем надёжное шифрование для защиты ваших данных.
      </p>
    </AuthLayout>
  );
}

export function LoginForm(props: LoginFormProps) {
  return (
    <Suspense
      fallback={
        <div className="auth-page-bg flex min-h-dvh items-center justify-center">
          <Loader2 className="text-primary size-8 animate-spin" aria-label="Загрузка" />
        </div>
      }
    >
      <LoginFormInner {...props} />
    </Suspense>
  );
}
