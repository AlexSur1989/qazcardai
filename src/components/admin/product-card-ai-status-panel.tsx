import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ProductCardModelSlotDiagnostics,
  ProductCardReadinessStatus,
} from "@/server/services/productCardModelSetup";

const STATUS_LABEL: Record<ProductCardModelSlotDiagnostics["status"], string> = {
  ready: "Назначено",
  missing_assignment: "Не назначено",
  missing_model: "Slug не найден",
  inactive: "Неактивна",
  wrong_scope: "Неверная конфигурация",
};

const READINESS_LABEL: Record<ProductCardReadinessStatus, string> = {
  Ready: "Ready",
  Missing: "Missing",
  Inactive: "Inactive",
  Misconfigured: "Misconfigured",
};

const READINESS_VARIANT: Record<
  ProductCardReadinessStatus,
  "qazBlue" | "outline" | "destructive"
> = {
  Ready: "qazBlue",
  Missing: "outline",
  Inactive: "outline",
  Misconfigured: "destructive",
};

function classifierUserStatusLabel(
  slot: ProductCardModelSlotDiagnostics,
): string | null {
  if (slot.productCardModelType !== "PRODUCT_CLASSIFIER") return null;
  if (slot.readinessStatus === "Ready") return "Распознавание товара — готово";
  return "Распознавание товара — не подключено";
}

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
          Readiness для сценариев карточки товара. Генерация доступна пользователям только при
          статусе Ready.
        </p>
        <div className="divide-border/80 divide-y rounded-lg border border-border/80">
          {slots.map((slot) => (
            <div
              key={slot.productCardModelType}
              className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">{slot.label}</p>
                {classifierUserStatusLabel(slot) ? (
                  <p className="text-muted-foreground text-xs">{classifierUserStatusLabel(slot)}</p>
                ) : null}
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
                        (<span className="font-mono">{slot.modelSlug}</span>)
                      </>
                    ) : null}
                  </p>
                ) : null}
                {slot.readinessIssues.length > 0 ? (
                  <ul className="text-muted-foreground list-inside list-disc text-xs">
                    {slot.readinessIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-xs">{slot.adminHint}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge variant={READINESS_VARIANT[slot.readinessStatus]}>
                  {READINESS_LABEL[slot.readinessStatus]}
                </Badge>
                <Badge variant="outline">{STATUS_LABEL[slot.status]}</Badge>
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
