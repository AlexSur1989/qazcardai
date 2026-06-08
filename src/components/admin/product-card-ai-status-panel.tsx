import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductCardModelSlotDiagnostics } from "@/server/services/productCardModelSetup";

const STATUS_LABEL: Record<ProductCardModelSlotDiagnostics["status"], string> = {
  ready: "Настроено",
  missing_assignment: "Не назначено",
  missing_model: "Slug не найден",
  inactive: "Неактивна",
  wrong_scope: "Неверная конфигурация",
};

const STATUS_VARIANT: Record<
  ProductCardModelSlotDiagnostics["status"],
  "qazBlue" | "outline" | "destructive"
> = {
  ready: "qazBlue",
  missing_assignment: "outline",
  missing_model: "destructive",
  inactive: "outline",
  wrong_scope: "destructive",
};

type Props = {
  slots: ProductCardModelSlotDiagnostics[];
};

export function ProductCardAiStatusPanel({ slots }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Product Card AI status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Диагностика назначенных моделей для сценариев карточки товара. Генерация работает
          только при статусе «Настроено».
        </p>
        <div className="divide-border/80 divide-y rounded-lg border border-border/80">
          {slots.map((slot) => (
            <div
              key={slot.productCardModelType}
              className="flex flex-col gap-1.5 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">{slot.label}</p>
                <p className="text-muted-foreground font-mono text-[10px]">
                  {slot.appSettingKey}
                </p>
                <p className="text-muted-foreground text-xs">
                  Slug:{" "}
                  <span className="font-mono">
                    {slot.assignedSlug.trim() || "— не назначено —"}
                  </span>
                </p>
                {slot.modelName ? (
                  <p className="text-muted-foreground text-xs">
                    Модель: {slot.modelName}
                    {slot.modelSlug ? (
                      <>
                        {" "}
                        (
                        <span className="font-mono">{slot.modelSlug}</span>)
                      </>
                    ) : null}
                  </p>
                ) : null}
                <p className="text-muted-foreground text-xs">{slot.adminHint}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge variant={STATUS_VARIANT[slot.status]}>
                  {STATUS_LABEL[slot.status]}
                </Badge>
                {slot.modelId ? (
                  <Link
                    href={`/admin/models/${slot.modelId}/edit`}
                    className="text-primary text-xs underline"
                  >
                    Редактировать
                  </Link>
                ) : (
                  <Link href="/admin/models" className="text-primary text-xs underline">
                    AI-модели
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
