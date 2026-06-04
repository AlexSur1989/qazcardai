"use client";

import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKzt } from "@/lib/format-kzt";
import { cn } from "@/lib/utils";
import type { KaspiManualBillingPublic } from "@/lib/kaspi-manual-config";
import { KaspiManualBillingPanel } from "@/components/dashboard/kaspi-manual-billing-panel";
import { useKaspiManualBilling } from "@/components/dashboard/use-kaspi-manual-billing";

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
  kaspiManual,
}: Props) {
  const manualBilling = useKaspiManualBilling(kaspiManual);
  const manualEnabled = kaspiManual.enabled;

  if (!manualEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пакеты токенов</CardTitle>
          <CardDescription>
            Пополнение через Kaspi / WhatsApp временно недоступно. Обратитесь в поддержку.
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
                    Пополнение скоро
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

  const hasActiveRequest = manualBilling.active !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Пакеты токенов</CardTitle>
        <CardDescription>
          Выберите пакет и нажмите «Пополнить через Kaspi / WhatsApp». Переведите сумму на Kaspi
          с кодом заявки и отправьте чек в WhatsApp. Токены начисляются после проверки
          администратором.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <KaspiManualBillingPanel
          packages={packages}
          billing={manualBilling}
          hidePackagePicker
        />

        <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {packages.map((p) => {
            const bp = bonusPercent(p.baseTokens, p.bonusTokens);
            const popular = isPopularPackageName(p.name);
            const isCreating = manualBilling.creating === p.id;
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
                      <Badge variant="secondary" className="shrink-0 font-normal">
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
                <div className="mt-4">
                  <Button
                    className="w-full"
                    type="button"
                    disabled={
                      hasActiveRequest ||
                      manualBilling.creating !== null ||
                      manualBilling.loading
                    }
                    onClick={() => void manualBilling.createRequest(p.id)}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Создаём заявку…
                      </>
                    ) : (
                      "Пополнить через Kaspi / WhatsApp"
                    )}
                  </Button>
                  {hasActiveRequest ? (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Сначала завершите или отмените текущую заявку выше.
                    </p>
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                  <Sparkles className="size-3" aria-hidden />
                  Токены появятся на балансе после подтверждения оплаты.
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
