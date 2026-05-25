import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCT_CARD_SCENARIO_CATALOG } from "@/lib/product-card-admin-meta";
import type { ProductCardScenarioToggles } from "@/server/services/productCardSettings";

type Props = {
  scenarios: ProductCardScenarioToggles;
};

/** Read-only preview клиентских текстов. Редактирование — на вкладке «Сценарии». */
export function ProductCardAdminTextsTab({ scenarios }: Props) {
  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>Подсказки и тексты</AlertTitle>
        <AlertDescription>
          Здесь — preview текстов, которые видит клиент. Названия сценариев редактируются на вкладке{" "}
          <Link href="/admin/product-card?tab=scenarios" className="underline">
            Сценарии
          </Link>
          . Редактирование help text и empty states в интерфейсе будет добавлено позже.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        {PRODUCT_CARD_SCENARIO_CATALOG.map((meta) => {
          const toggle = scenarios[meta.id];
          return (
            <Card key={meta.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{meta.title}</CardTitle>
                <CardDescription>{meta.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Название вкладки в кабинете</p>
                  <p className="font-medium">{toggle.label || meta.title}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Подсказка для клиента (preview)</p>
                  <p className="text-muted-foreground">{meta.clientHint}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Статус</p>
                  <p>{toggle.enabled ? "Показывается клиентам" : "Скрыт от клиентов"}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">TODO: тексты интерфейса</CardTitle>
          <CardDescription>
            Инструкции, help text и empty states сейчас заданы в коде кабинета. Отдельный редактор
            текстов — в следующих итерациях.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
