"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatKzt } from "@/lib/format-kzt";
import { cn } from "@/lib/utils";
import type { KaspiManualBillingPublic } from "@/lib/kaspi-manual-config";
import { KaspiManualBillingPanel } from "@/components/dashboard/kaspi-manual-billing-panel";

export type BillingTokenPackage = {
  id: string;
  name: string;
  priceKzt: number;
  baseTokens: number;
  bonusTokens: number;
  totalTokens: number;
  description: string | null;
};

type Props = {
  packages: BillingTokenPackage[];
  stripeReady: boolean;
  kaspiReady: boolean;
  kaspiManual: KaspiManualBillingPublic;
};

function bonusPercent(base: number, bonus: number) {
  if (base <= 0 || bonus <= 0) return 0;
  return Math.round((bonus / base) * 100);
}

function isPopularPackageName(name: string) {
  return /pro|studio|премиум|premium/i.test(name);
}

export function TokenPackagesBillingSection({
  packages,
  stripeReady,
  kaspiReady,
  kaspiManual,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [loadingKaspi, setLoadingKaspi] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buyStripe(packageId: string) {
    setError(null);
    setLoading(packageId);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, provider: "stripe" }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setError("Нет ссылки на оплату");
    } catch {
      setError("Сеть: не удалось создать сессию оплаты");
    } finally {
      setLoading(null);
    }
  }

  async function buyKaspi(packageId: string) {
    setError(null);
    setLoadingKaspi(packageId);
    try {
      const res = await fetch("/api/billing/payments/kaspi/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenPackageId: packageId }),
      });
      const data = (await res.json()) as { paymentUrl?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      if (data.paymentUrl) {
        window.location.assign(data.paymentUrl);
        return;
      }
      setError("Нет ссылки на оплату Kaspi");
    } catch {
      setError("Сеть: не удалось создать Kaspi-платёж");
    } finally {
      setLoadingKaspi(null);
    }
  }

  if (!stripeReady && !kaspiReady && !kaspiManual.enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пакеты токенов</CardTitle>
          <CardDescription>
            Для приёма платежей настройте Stripe или Kaspi Pay (см.{" "}
            <code className="text-xs">.env.example</code>), либо включите ручной перевод Kaspi в
            админке (KASPI_MANUAL_SETTINGS).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {packages.length > 0 ? (
            <ul className="space-y-3">
              {packages.map((p) => (
                <li key={p.id} className="qaz-surface flex flex-col p-4">
                  <p className="text-foreground font-medium">{p.name}</p>
                  <p className="text-muted-foreground mt-1 text-sm">{p.description}</p>
                  <p className="text-muted-foreground mt-2 text-sm font-medium">
                    {formatKzt(p.priceKzt)} · {p.totalTokens} токенов
                  </p>
                  <Button className="mt-3 w-full" type="button" disabled variant="secondary">
                    Платежи скоро
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Пакеты будут доступны позже.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (packages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пакеты токенов</CardTitle>
          <CardDescription>Каталог пуст. Обратитесь в поддержку.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Пакеты токенов</CardTitle>
        <CardDescription>
          {stripeReady
            ? "Оплата через Stripe Checkout. Токены начисляются после webhook на сервере."
            : null}
          {stripeReady && kaspiReady ? " " : null}
          {kaspiReady
            ? "Kaspi Pay: токены только после подтверждения на сервере (webhook), а не со страницы «успех» в браузере."
            : null}
          {kaspiManual.enabled
            ? " Kaspi перевод: токены только после ручной проверки администратором."
            : null}
          {!stripeReady && kaspiReady
            ? "Сейчас доступна тестовая оплата Kaspi Pay (mock)."
            : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {kaspiManual.enabled ? (
          <KaspiManualBillingPanel packages={packages} publicSettings={kaspiManual} />
        ) : null}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Не удалось перейти к оплате</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {packages.map((p) => {
            const bp = bonusPercent(p.baseTokens, p.bonusTokens);
            const popular = isPopularPackageName(p.name);
            return (
              <li key={p.id} className="qaz-surface relative flex flex-col p-5">
                {popular && (
                  <div className="absolute top-3 right-3">
                    <Badge variant="qazGold" className="font-medium">
                      Популярный
                    </Badge>
                  </div>
                )}
                <div
                  className={cn(
                    "flex flex-wrap items-start justify-between gap-2",
                    popular && "pr-16",
                  )}
                >
                  <p className="text-foreground text-lg font-semibold">{p.name}</p>
                  {p.bonusTokens > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="secondary"
                        className={cn("font-normal", "shrink-0")}
                      >
                        +{p.bonusTokens} бонусных токенов
                      </Badge>
                      {bp > 0 && (
                        <Badge variant="outline" className="shrink-0 font-normal">
                          +{bp}% бонус
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{p.description}</p>
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {formatKzt(p.priceKzt)}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {p.baseTokens}
                  {p.bonusTokens > 0 ? ` + ${p.bonusTokens} бонусных` : ""} токенов
                </p>
                <p className="text-foreground mt-1 text-sm font-medium">
                  Итого: {p.totalTokens} токенов
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {stripeReady ? (
                    <Button
                      className="w-full"
                      type="button"
                      disabled={loading !== null || loadingKaspi !== null}
                      onClick={() => void buyStripe(p.id)}
                    >
                      {loading === p.id ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Создаём сессию…
                        </>
                      ) : (
                        "Купить пакет (Stripe)"
                      )}
                    </Button>
                  ) : null}
                  {kaspiReady ? (
                    <Button
                      className="w-full"
                      type="button"
                      variant={stripeReady ? "secondary" : "default"}
                      disabled={loading !== null || loadingKaspi !== null}
                      onClick={() => void buyKaspi(p.id)}
                    >
                      {loadingKaspi === p.id ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Создаём Kaspi-платёж…
                        </>
                      ) : (
                        "Оплатить через Kaspi"
                      )}
                    </Button>
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                  <Sparkles className="size-3" aria-hidden />
                  Статус оплаты: pending → success после сервера; баланс не меняется до подтверждения.
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
