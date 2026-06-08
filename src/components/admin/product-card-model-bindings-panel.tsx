"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ProductCardModelOption = {
  slug: string;
  name: string;
};

export type ProductCardModelBindingsPanelProps = {
  initial: {
    classifierModelSlug: string;
    conceptImageModelSlug: string;
    marketplaceCardModelSlug: string;
    videoModelSlug: string;
  };
  options: {
    classifier: ProductCardModelOption[];
    conceptImage: ProductCardModelOption[];
    marketplaceCard: ProductCardModelOption[];
    video: ProductCardModelOption[];
  };
  warnings: {
    classifier?: string;
    conceptImage?: string;
    marketplaceCard?: string;
    video?: string;
  };
  canEdit: boolean;
};

const ROWS = [
  {
    key: "classifierModelSlug" as const,
    label: "Классификация товара",
    settingKey: "PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG",
    optionsKey: "classifier" as const,
    warningKey: "classifier" as const,
  },
  {
    key: "conceptImageModelSlug" as const,
    label: "Фото с концепциями",
    settingKey: "PRODUCT_CARD_DEFAULT_CONCEPT_IMAGE_MODEL_SLUG",
    optionsKey: "conceptImage" as const,
    warningKey: "conceptImage" as const,
  },
  {
    key: "marketplaceCardModelSlug" as const,
    label: "Карточка товара",
    settingKey: "PRODUCT_CARD_DEFAULT_MARKETPLACE_CARD_MODEL_SLUG",
    optionsKey: "marketplaceCard" as const,
    warningKey: "marketplaceCard" as const,
  },
  {
    key: "videoModelSlug" as const,
    label: "Видео товара",
    settingKey: "PRODUCT_CARD_DEFAULT_VIDEO_MODEL_SLUG",
    optionsKey: "video" as const,
    warningKey: "video" as const,
  },
];

export function ProductCardModelBindingsPanel({
  initial,
  options,
  warnings,
  canEdit,
}: ProductCardModelBindingsPanelProps) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);

  const totalOptions =
    options.classifier.length +
    options.conceptImage.length +
    options.marketplaceCard.length +
    options.video.length;

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/product-card/model-bindings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Не удалось сохранить");
        return;
      }
      toast.success("Назначение моделей сохранено");
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Назначение моделей</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalOptions === 0 ? (
          <Alert>
            <AlertTitle>Нет доступных моделей</AlertTitle>
            <AlertDescription>
              Сначала добавьте модель в{" "}
              <Link href="/admin/models" className="underline">
                AI-моделях
              </Link>{" "}
              (scope PRODUCT_CARD, active).
            </AlertDescription>
          </Alert>
        ) : null}

        {ROWS.map((row) => {
          const opts = options[row.optionsKey];
          return (
            <div key={row.key} className="space-y-1.5">
              <Label htmlFor={`bind-${row.key}`}>
                {row.label}
                <span className="text-muted-foreground ml-2 font-mono text-[10px]">
                  {row.settingKey}
                </span>
              </Label>
              <select
                id={`bind-${row.key}`}
                disabled={!canEdit || opts.length === 0}
                className="border-border bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                value={values[row.key]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [row.key]: e.target.value }))
                }
              >
                <option value="">
                  {opts.length === 0
                    ? "— нет активных моделей —"
                    : "— не назначено —"}
                </option>
                {opts.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.name} ({m.slug})
                  </option>
                ))}
              </select>
              {opts.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Нет активных моделей для «{row.label}». Создайте модель в{" "}
                  <Link href="/admin/models" className="underline">
                    AI-моделях
                  </Link>{" "}
                  (scope PRODUCT_CARD, тип {row.label}), заполните Kie Model ID и активируйте.
                </p>
              ) : null}
              {warnings[row.warningKey] ? (
                <p className="text-amber-700 text-xs">{warnings[row.warningKey]}</p>
              ) : null}
            </div>
          );
        })}

        {canEdit ? (
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? "Сохранение…" : "Сохранить назначение"}
          </Button>
        ) : (
          <p className="text-muted-foreground text-xs">
            Нужно право models.product_card.manage для изменения.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
