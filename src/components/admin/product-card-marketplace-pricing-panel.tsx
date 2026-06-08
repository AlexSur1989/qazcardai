"use client";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarketplaceCardPricingSummary } from "@/server/services/marketplaceCardPricingSummary";

type Props = {
  pricing: MarketplaceCardPricingSummary | null;
  missingModel?: boolean;
};

export function ProductCardMarketplacePricingPanel({ pricing, missingModel }: Props) {
  if (missingModel || !pricing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marketplace card pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Активная модель PRODUCT_MARKETPLACE_CARD не найдена. Назначьте модель в блоке выше.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Marketplace card pricing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground text-xs">
          Модель: <span className="font-mono">{pricing.modelSlug}</span> · {pricing.modelName}
        </p>
        <dl className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
            <dt className="text-muted-foreground text-xs">Model base credits</dt>
            <dd className="text-lg font-semibold tabular-nums">{pricing.modelBaseCredits}</dd>
          </div>
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
            <dt className="text-muted-foreground text-xs">Minimum marketplace card tokens</dt>
            <dd className="text-lg font-semibold tabular-nums">{pricing.minScenarioTokens}</dd>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <dt className="text-muted-foreground text-xs">Final user price</dt>
            <dd className="text-lg font-semibold tabular-nums">{pricing.finalCredits}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Итоговая цена не может быть ниже минимальной цены сценария. Сейчас пользователь видит{" "}
          <strong className="text-foreground">{pricing.finalCredits} токенов</strong>.
          {pricing.limitedByMinimum
            ? " Минимум сценария выше базовой цены модели."
            : null}
        </p>
        <p className="text-muted-foreground font-mono text-[10px] leading-relaxed">
          {pricing.formula}
        </p>
        <p className="text-xs">
          Изменить минимум:{" "}
          <Link href="/admin/pricing?tab=marketplace" className="text-primary underline">
            Цены и тарифы → Карточка товара
          </Link>
          {" · "}
          AppSetting{" "}
          <span className="font-mono">PRODUCT_CARD_MIN_MARKETPLACE_CARD_TOKENS</span>
        </p>
      </CardContent>
    </Card>
  );
}
