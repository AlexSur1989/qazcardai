"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CARD_BUILDER_PRODUCT_FACT_TYPE_LABELS,
  productFactSourceLabel,
  type CardBuilderProductFact,
} from "@/lib/card-builder-product-facts";
import { isWebSuggestedFact } from "@/lib/card-builder-product-facts";
import type { ProductCardWebResearchMeta } from "@/lib/product-card-web-research-config";
import { cn } from "@/lib/utils";

type Props = {
  facts: CardBuilderProductFact[];
  webResearchMeta?: ProductCardWebResearchMeta | null;
  onFactsChange: (facts: CardBuilderProductFact[]) => void;
  onConfirmFacts: (confirmIds: string[], deleteIds?: string[]) => void;
  confirming?: boolean;
};

function sourceBadgeVariant(
  source: CardBuilderProductFact["source"],
): "default" | "secondary" | "outline" | "destructive" {
  if (source === "web_suggested") return "outline";
  if (source === "vision_ai") return "secondary";
  return "default";
}

export function CardBuilderFactsReviewPanel({
  facts,
  webResearchMeta,
  onFactsChange,
  onConfirmFacts,
  confirming,
}: Props) {
  const reviewFacts = useMemo(
    () => facts.filter((f) => f.type !== "benefit" && f.type !== "product_purpose"),
    [facts],
  );

  const pendingWeb = reviewFacts.filter(
    (f) => isWebSuggestedFact(f) && (f.needsReview !== false || f.verifiedByUser !== true),
  );

  function updateFact(id: string, patch: Partial<CardBuilderProductFact>) {
    onFactsChange(
      facts.map((f) =>
        f.id === id
          ? {
              ...f,
              ...patch,
              source: f.source === "vision_ai" && patch.value != null ? "user" : f.source,
            }
          : f,
      ),
    );
  }

  function confirmOne(id: string) {
    onConfirmFacts([id]);
  }

  function removeOne(id: string) {
    onConfirmFacts([], [id]);
  }

  if (reviewFacts.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Характеристики с фото или из интернета появятся здесь после анализа.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {webResearchMeta?.uncertainMatch ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-950">
          Мы нашли похожие товары. Проверьте характеристики перед генерацией карточек.
        </p>
      ) : null}

      {pendingWeb.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          {pendingWeb.length} характеристик из интернета ждут подтверждения.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Характеристика</th>
              <th className="px-3 py-2 font-medium">Значение</th>
              <th className="px-3 py-2 font-medium">Тип</th>
              <th className="px-3 py-2 font-medium">Источник</th>
              <th className="px-3 py-2 font-medium">В карточках</th>
              <th className="px-3 py-2 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {reviewFacts.map((f) => {
              const pending =
                isWebSuggestedFact(f) &&
                (f.needsReview !== false || f.verifiedByUser !== true);
              return (
                <tr
                  key={f.id}
                  className={cn(
                    "border-t border-border/60",
                    pending && "bg-amber-50/40",
                  )}
                >
                  <td className="px-3 py-2 align-top">
                    <input
                      className="w-full min-w-[100px] rounded border border-input bg-background px-2 py-1"
                      value={f.label}
                      onChange={(e) => updateFact(f.id, { label: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <textarea
                      className="w-full min-w-[140px] rounded border border-input bg-background px-2 py-1"
                      rows={2}
                      value={f.value}
                      onChange={(e) => updateFact(f.id, { value: e.target.value })}
                    />
                    {f.evidenceTitle ? (
                      <p className="text-muted-foreground mt-1 text-[10px]">
                        Источник: {f.evidenceTitle}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    {CARD_BUILDER_PRODUCT_FACT_TYPE_LABELS[f.type]}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Badge variant={sourceBadgeVariant(f.source)} className="text-[10px]">
                      {productFactSourceLabel(f.source)}
                    </Badge>
                    {f.needsReview ? (
                      <p className="text-amber-700 mt-1 text-[10px]">Нужна проверка</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      className="size-4 rounded border"
                      checked={f.visibleOnCard !== false}
                      onChange={(e) => updateFact(f.id, { visibleOnCard: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col gap-1">
                      {pending ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 text-[10px]"
                          disabled={confirming}
                          onClick={() => confirmOne(f.id)}
                        >
                          Подтвердить
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] text-destructive"
                        disabled={confirming}
                        onClick={() => removeOne(f.id)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
