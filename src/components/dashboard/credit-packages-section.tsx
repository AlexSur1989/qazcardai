"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type CreditPackageCard = {
  id: string;
  name: string;
  description: string;
  credits: number;
  amount: string;
  currency: string;
};

type Props = {
  packages: CreditPackageCard[];
  stripeReady: boolean;
};

function formatMoney(amount: string, currency: string) {
  const c = currency.toUpperCase();
  if (c === "USD") {
    return `$${amount}`;
  }
  return `${amount} ${c}`;
}

export function CreditPackagesSection({ packages, stripeReady }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(packageId: string) {
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

  if (!stripeReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пакеты кредитов</CardTitle>
          <CardDescription>
            Для приёма платежей на сервере должны быть заданы{" "}
            <code className="text-xs">STRIPE_SECRET_KEY</code> и в окружении — Price
            id для пакетов.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Обратитесь к администратору или см. <code>.env.example</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (packages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пакеты кредитов</CardTitle>
          <CardDescription>
            Задайте в .env идентификаторы Stripe Price (см. STRIPE_PRICE_ID_PACK_*).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Ключи Secret заданы, но ни один пакет не сопоставлен с Price id в
            Dashboard.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Пакеты кредитов</CardTitle>
        <CardDescription>
          Оплата через Stripe Checkout. Кредиты начисляются автоматически после
          подтверждения webhook (не по кнопке «назад» с успехом).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Не удалось перейти к оплате</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <li
              key={p.id}
              className="border-border flex flex-col rounded-lg border p-4"
            >
              <p className="text-foreground font-medium">{p.name}</p>
              <p className="text-muted-foreground mt-1 text-xs">{p.description}</p>
              <p className="mt-2 text-lg font-semibold tabular-nums">
                {p.credits} кр. · {formatMoney(p.amount, p.currency)}
              </p>
              <Button
                className="mt-3 w-full"
                type="button"
                disabled={loading !== null}
                onClick={() => void buy(p.id)}
              >
                {loading === p.id ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Создаём сессию…
                  </>
                ) : (
                  "Купить"
                )}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
