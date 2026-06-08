"use client";

import { Loader2, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { ProductCategory, ProductCategoryId } from "@/config/product-card-categories";
import { MANUAL_PRODUCT_CATEGORY_OPTIONS } from "@/config/product-card-manual-categories";
import {
  formatClassifierConfidenceText,
  PRODUCT_CLASSIFIER_MISSING_HINT,
  type ProductClassifierResult,
} from "@/lib/product-classifier-result";
import {
  PRODUCT_CARD_CLASSIFIER_MANUAL_TITLE,
} from "@/lib/product-card-scenario-setup-copy";
import { publicUserErrorMessage } from "@/lib/user-facing-copy";

import type { CategorySourceUi } from "./use-product-card-project";

type Props = {
  hasImage: boolean;
  canPersist: boolean;
  categories: readonly ProductCategory[];
  selectedCategory: ProductCategoryId | null;
  categorySource: CategorySourceUi;
  classifierEnabled: boolean;
  classifyLoading: boolean;
  classifyError: string | null;
  pendingResult: ProductClassifierResult | null;
  showResult: boolean;
  onClassify: () => void | Promise<void>;
  onApply: () => void | Promise<void>;
  onEditManually: () => void;
  onRetry: () => void | Promise<void>;
  onSelectCategory: (id: ProductCategoryId) => void;
  classifierAdminHint?: string | null;
  devMockActive?: boolean;
};

function ManualCategoryPicker({
  selectedCategory,
  onSelectCategory,
  canPersist,
  categories,
  useManualOptions,
}: {
  selectedCategory: ProductCategoryId | null;
  onSelectCategory: (id: ProductCategoryId) => void;
  canPersist: boolean;
  categories: readonly ProductCategory[];
  useManualOptions: boolean;
}) {
  const options = useManualOptions ? MANUAL_PRODUCT_CATEGORY_OPTIONS : categories;

  return (
    <div className="space-y-2">
      <Label htmlFor="pcat-manual-select">{PRODUCT_CARD_CLASSIFIER_MANUAL_TITLE}</Label>
      <select
        id="pcat-manual-select"
        className="border-input w-full max-w-md rounded-xl border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm"
        value={selectedCategory ?? ""}
        disabled={!canPersist}
        onChange={(e) => {
          const v = e.target.value as ProductCategoryId;
          if (v) onSelectCategory(v);
        }}
      >
        <option value="" disabled>
          Выберите категорию…
        </option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      {!canPersist ? (
        <p className="text-muted-foreground text-xs">
          Сначала дождитесь загрузки фото на сервер.
        </p>
      ) : null}
    </div>
  );
}

export function ProductClassifierPanel({
  hasImage,
  canPersist,
  categories,
  selectedCategory,
  categorySource,
  classifierEnabled,
  classifyLoading,
  classifyError,
  pendingResult,
  showResult,
  onClassify,
  onApply,
  onEditManually,
  onRetry,
  onSelectCategory,
  classifierAdminHint = null,
  devMockActive = false,
}: Props) {
  if (!hasImage) {
    return (
      <div className="space-y-2">
        <h3 className="text-foreground text-base font-semibold">Категория товара</h3>
        <p className="text-muted-foreground text-sm">
          После загрузки фото можно распознать товар или выбрать категорию вручную.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="text-lg">Распознавание товара</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!classifierEnabled ? (
          <Alert>
            <AlertDescription>{PRODUCT_CLASSIFIER_MISSING_HINT}</AlertDescription>
          </Alert>
        ) : (
          <>
            {devMockActive ? (
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Dev mock</AlertTitle>
                <AlertDescription>
                  Включён тестовый режим classifier (только development). Kie.ai не вызывается.
                </AlertDescription>
              </Alert>
            ) : null}

            {!showResult ? (
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  ИИ может предложить название, категорию и преимущества по фото. Вы всегда можете
                  исправить данные вручную.
                </p>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => void onClassify()}
                  disabled={!canPersist || classifyLoading}
                >
                  {classifyLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Распознать товар по фото
                </Button>
                {classifyLoading ? (
                  <p className="text-muted-foreground text-sm" aria-live="polite">
                    ИИ анализирует фото товара…
                  </p>
                ) : null}
              </div>
            ) : pendingResult ? (
              <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
                <div className="space-y-1">
                  <p className="text-foreground text-sm font-semibold">ИИ предложил данные</p>
                  <p className="text-muted-foreground text-xs">
                    {formatClassifierConfidenceText(pendingResult.confidence)}
                  </p>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
                  <dt className="text-muted-foreground">Название товара</dt>
                  <dd className="text-foreground">{pendingResult.productTitle || "—"}</dd>
                  <dt className="text-muted-foreground">Категория</dt>
                  <dd className="text-foreground">{pendingResult.categoryLabel}</dd>
                  <dt className="text-muted-foreground">Что видно на фото</dt>
                  <dd className="text-foreground">{pendingResult.visibleProduct || "—"}</dd>
                  <dt className="text-muted-foreground">Преимущества</dt>
                  <dd className="text-foreground">
                    {pendingResult.suggestedBenefits.length > 0 ? (
                      <ul className="list-inside list-disc space-y-0.5">
                        {pendingResult.suggestedBenefits.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </dd>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void onApply()}>
                    Применить
                  </Button>
                  <Button type="button" variant="outline" onClick={onEditManually}>
                    Изменить вручную
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void onRetry()}
                    disabled={classifyLoading}
                  >
                    Распознать заново
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}

        {classifyError ? (
          <Alert variant="destructive">
            <AlertTitle>Распознавание</AlertTitle>
            <AlertDescription>{publicUserErrorMessage(classifyError)}</AlertDescription>
          </Alert>
        ) : null}

        {categorySource === "ai" && selectedCategory ? (
          <Alert>
            <AlertTitle>Категория от ИИ</AlertTitle>
            <AlertDescription>
              Значение применено из распознавания. При необходимости измените категорию ниже.
            </AlertDescription>
          </Alert>
        ) : null}

        {classifierAdminHint ? (
          <p className="text-muted-foreground border-border/60 border-t pt-2 font-mono text-[10px]">
            Admin: {classifierAdminHint}
          </p>
        ) : null}

        <ManualCategoryPicker
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          canPersist={canPersist}
          categories={categories}
          useManualOptions={!classifierEnabled}
        />
      </CardContent>
    </Card>
  );
}
