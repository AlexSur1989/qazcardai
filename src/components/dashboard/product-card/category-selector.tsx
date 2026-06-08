"use client";

import { Loader2, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { ProductCategory, ProductCategoryId } from "@/config/product-card-categories";
import { MANUAL_PRODUCT_CATEGORY_OPTIONS } from "@/config/product-card-manual-categories";
import { formatProductCategoryClassifierReason } from "@/lib/product-card-classifier-ui";
import {
  PRODUCT_CARD_CLASSIFIER_MANUAL_HINT,
  PRODUCT_CARD_CLASSIFIER_MANUAL_TITLE,
} from "@/lib/product-card-scenario-setup-copy";
import { publicUserErrorMessage } from "@/lib/user-facing-copy";

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
  onSelectCategory: (id: ProductCategoryId) => void;
  autoClassifyReady?: boolean;
  classifierAdminHint?: string | null;
};

function ManualCategoryPicker({
  selectedCategory,
  onSelectCategory,
  canPersist,
}: {
  selectedCategory: ProductCategoryId | null;
  onSelectCategory: (id: ProductCategoryId) => void;
  canPersist: boolean;
}) {
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
        {MANUAL_PRODUCT_CATEGORY_OPTIONS.map((c) => (
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
  onSelectCategory,
  autoClassifyReady = true,
  classifierAdminHint = null,
}: Props) {
  if (!hasImage) {
    return (
      <div className="space-y-2">
        <h3 className="text-foreground text-base font-semibold">Категория товара</h3>
        <p className="text-muted-foreground text-sm">
          После загрузки фото выберите категорию — это поможет ИИ лучше оформить карточку.
        </p>
      </div>
    );
  }

  if (!autoClassifyReady) {
    return (
      <Card>
        <CardHeader className="space-y-0 pb-2">
          <CardTitle className="text-lg">{PRODUCT_CARD_CLASSIFIER_MANUAL_TITLE}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>{PRODUCT_CARD_CLASSIFIER_MANUAL_HINT}</AlertDescription>
          </Alert>
          {classifierAdminHint ? (
            <p className="text-muted-foreground border-border/60 border-t pt-2 font-mono text-[10px]">
              Admin: {classifierAdminHint}
            </p>
          ) : null}
          <ManualCategoryPicker
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
            canPersist={canPersist}
          />
        </CardContent>
      </Card>
    );
  }

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
            <AlertDescription>{publicUserErrorMessage(classifyError)}</AlertDescription>
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
        </div>
        {!canPersist && (
          <p className="text-muted-foreground text-xs">
            Сначала дождитесь загрузки фото на сервер. Локальный preview без S3 к проекту не
            привязывается.
          </p>
        )}

        {classifyInfo && !classifyLoading && !classifyInfo.classifierFailed && (
          <div className="text-muted-foreground text-xs">
            {typeof classifyInfo.confidence === "number" && !showMockProviderHint && (
              <span className="text-foreground font-medium">
                Уверенность: {Math.round(classifyInfo.confidence * 100)}%
              </span>
            )}
            {(() => {
              const userReason = formatProductCategoryClassifierReason(
                classifyInfo.reason,
                classifyInfo.classifierFailed,
              );
              if (!userReason) return null;
              return (
                <>
                  {typeof classifyInfo.confidence === "number" && !showMockProviderHint ? " · " : null}
                  {userReason}
                </>
              );
            })()}
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
      </CardContent>
    </Card>
  );
}
