import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCT_CARD_SCENARIO_CATALOG } from "@/lib/product-card-admin-meta";
import { cn } from "@/lib/utils";
import type { ProductCardScenarioToggles } from "@/server/services/productCardSettings";

type Props = {
  scenarios: ProductCardScenarioToggles;
  productCardEnabled: boolean;
  webResearchEnabled?: boolean;
};

export function ProductCardAdminOverview({
  scenarios,
  productCardEnabled,
  webResearchEnabled,
}: Props) {
  const cards = [...PRODUCT_CARD_SCENARIO_CATALOG].sort(
    (a, b) => a.overviewOrder - b.overviewOrder,
  );

  return (
    <div className="space-y-4">
      <Card className="border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Статус раздела</CardTitle>
          <CardDescription>
            {productCardEnabled
              ? "AI-карточки товара доступны клиентам в кабинете."
              : "Раздел выключен — клиенты не видят сценарии карточки товара."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant={productCardEnabled ? "default" : "secondary"}>
            {productCardEnabled ? "Включено" : "Выключено"}
          </Badge>
          <Badge variant={webResearchEnabled ? "default" : "outline"}>
            Умное заполнение товара: {webResearchEnabled ? "включено" : "выключено"}
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((meta) => {
          const toggle = scenarios[meta.id];
          const enabled = toggle.enabled;
          const clientLabel = toggle.label.trim() || meta.title;

          return (
            <Card key={meta.id} className="border-border/80">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="text-base">{meta.title}</CardTitle>
                  <Badge variant={enabled ? "default" : "secondary"}>
                    {enabled ? "Включено" : "Выключено"}
                  </Badge>
                </div>
                <CardDescription>{meta.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Название для клиента
                  </p>
                  <p className="font-medium">{clientLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Где видит клиент
                  </p>
                  <p className="text-muted-foreground text-sm">{meta.clientHint}</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    href={meta.pricingHref}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Цены
                  </Link>
                  <Link
                    href={meta.generationsHref}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Генерации
                  </Link>
                  <Link
                    href={meta.scenariosHref}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  >
                    Настроить сценарий
                  </Link>
                </div>
                <p className="text-muted-foreground text-xs">
                  Тарифы:{" "}
                  <Link href={meta.pricingHref} className="underline">
                    {meta.pricingLabel}
                  </Link>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
