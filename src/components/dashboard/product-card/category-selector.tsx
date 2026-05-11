"use client";

import { Loader2, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { ProductCategory, ProductCategoryId } from "@/config/product-card-categories";

import type { CategorySourceUi, ClassifyInfo, ClassifyFlowState } from "./use-product-card-project";

type Props = {
  hasImage: boolean;
  canPersist: boolean;
  categories: readonly ProductCategory[];
  selectedCategory: ProductCategoryId | null;
  categorySource: CategorySourceUi;
  classifyLoading: boolean;
  classifyFlow: ClassifyFlowState;
  classifyError: string | null;
  classifyInfo: ClassifyInfo;
  onClassify: () => void | Promise<void>;
  onMockTest: () => void;
  onSelectCategory: (id: ProductCategoryId) => void;
};

function sourceLabel(s: CategorySourceUi): string {
  if (s === "ai") return "AI (сервер)";
  if (s === "mock") return "тест (mock)";
  if (s === "manual") return "вручную";
  return "—";
}

export function CategorySelector({
  hasImage,
  canPersist,
  categories,
  selectedCategory,
  categorySource,
  classifyLoading,
  classifyFlow,
  classifyError,
  classifyInfo,
  onClassify,
  onMockTest,
  onSelectCategory,
}: Props) {
  if (!hasImage) {
    return (
      <div className="space-y-2">
        <h3 className="text-foreground text-base font-semibold">Категория товара</h3>
        <p className="text-muted-foreground text-sm">
          После сохранения фото на сервер категория определяется автоматически. При необходимости
          скорректируйте её вручную.
        </p>
      </div>
    );
  }

  const selected = selectedCategory
    ? categories.find((c) => c.id === selectedCategory)
    : undefined;
  const showMockProviderHint = classifyInfo?.provider === "mock";
  const showAiSuggestion =
    Boolean(classifyInfo?.label) &&
    !showMockProviderHint &&
    !classifyInfo?.classifierFailed;

  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">Категория товара</CardTitle>
          <Badge variant="qazBlue" className="font-normal">
            AI
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showMockProviderHint && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Тестовый классификатор</AlertTitle>
            <AlertDescription>
              Сейчас включен тестовый классификатор. Вы можете выбрать категорию вручную.
            </AlertDescription>
          </Alert>
        )}

        {classifyInfo?.classifierFailed && !showMockProviderHint && (
          <Alert variant="destructive">
            <AlertTitle>Автоматическая категория</AlertTitle>
            <AlertDescription>
              Не удалось уверенно распознать категорию — по умолчанию выставлено «Прочее». При
              необходимости выберите другую категорию вручную.
              {classifyInfo.reason?.trim() ? (
                <span className="mt-2 block text-sm opacity-90">
                  {classifyInfo.reason.trim()}
                </span>
              ) : null}
            </AlertDescription>
          </Alert>
        )}

        {showAiSuggestion && (
          <p className="text-foreground text-sm font-medium" aria-live="polite">
            AI предложил категорию: {classifyInfo!.label}
          </p>
        )}

        {categorySource === "ai" && !showMockProviderHint && (
          <Alert>
            <AlertTitle>Категория от AI</AlertTitle>
            <AlertDescription>
              Значение с сервера. При неверном результате укажите категорию вручную.
            </AlertDescription>
          </Alert>
        )}

        {classifyLoading && (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            <Loader2 className="text-primary mr-1 inline h-3.5 w-3.5 animate-spin" />
            Анализируем фото...
          </p>
        )}

        {classifyFlow === "error" && classifyError && (
          <Alert variant="destructive">
            <AlertTitle>Классификация</AlertTitle>
            <AlertDescription>{classifyError}</AlertDescription>
          </Alert>
        )}

        {classifyFlow === "not_started" && canPersist && !classifyLoading && !classifyInfo && (
          <p className="text-muted-foreground text-xs">
            Если категория не появилась после загрузки фото или вы сменили снимки, нажмите кнопку
            ниже для повторного анализа.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="default"
            onClick={() => void onClassify()}
            disabled={!canPersist || classifyLoading}
          >
            {classifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Определить категорию (AI)
          </Button>
          <Button type="button" variant="secondary" onClick={onMockTest} disabled={!canPersist}>
            Тест: «Прочее»
          </Button>
        </div>
        {!canPersist && (
          <p className="text-muted-foreground text-xs">
            Сначала дождитесь загрузки фото на сервер. Локальный preview без S3 к проекту не
            привязывается.
          </p>
        )}

        {classifyInfo && !classifyLoading && (
          <div className="text-muted-foreground text-xs">
            {typeof classifyInfo.confidence === "number" && !showMockProviderHint && (
              <span className="text-foreground font-medium">
                Уверенность: {Math.round(classifyInfo.confidence * 100)}%
              </span>
            )}
            {typeof classifyInfo.confidence === "number" && !showMockProviderHint && classifyInfo.reason
              ? " · "
              : null}
            {classifyInfo.reason}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="pcat-select">Категория вручную</Label>
          <select
            id="pcat-select"
            className="border-input w-full max-w-md rounded-xl border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm"
            value={selectedCategory ?? ""}
            onChange={(e) => {
              const v = e.target.value as ProductCategoryId;
              if (v) onSelectCategory(v);
            }}
          >
            <option value="" disabled>
              Выберите категорию…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <div className="qaz-surface-muted max-w-2xl space-y-2 p-4">
            <p className="text-foreground text-sm font-medium">{selected.label}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{selected.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {selected.subcategories.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs font-normal">
                  {s}
                </Badge>
              ))}
            </div>
            {categorySource && (
              <p className="text-muted-foreground text-xs">Источник: {sourceLabel(categorySource)}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
