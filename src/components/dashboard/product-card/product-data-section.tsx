"use client";

import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { ProductCategoryId } from "@/config/product-card-categories";
import { MANUAL_PRODUCT_CATEGORY_OPTIONS } from "@/config/product-card-manual-categories";
import { PRODUCT_CLASSIFIER_MISSING_HINT } from "@/lib/product-classifier-result";
import { publicUserErrorMessage } from "@/lib/user-facing-copy";

import type { CategorySourceUi } from "./use-product-card-project";

export type ProductAiAnalysisStatus =
  | "idle"
  | "analyzing"
  | "filled"
  | "unavailable"
  | "error";

type Props = {
  hasImage: boolean;
  canPersist: boolean;
  selectedCategory: ProductCategoryId | null;
  categorySource: CategorySourceUi;
  classifierEnabled: boolean;
  aiAnalysisStatus: ProductAiAnalysisStatus;
  classifyError: string | null;
  productTitle: string;
  onProductTitleChange: (value: string) => void;
  onSelectCategory: (id: ProductCategoryId) => void;
  onRetryAnalysis?: () => void | Promise<void>;
  classifierAdminHint?: string | null;
  retryDisabled?: boolean;
};

function aiStatusMessage(status: ProductAiAnalysisStatus): string | null {
  switch (status) {
    case "analyzing":
      return "ИИ анализирует фото товара…";
    case "filled":
      return "ИИ определил название и категорию. При необходимости измените их вручную.";
    case "unavailable":
      return "Автоматическое заполнение временно недоступно. Заполните данные вручную.";
    default:
      return null;
  }
}

export function ProductDataSection({
  hasImage,
  canPersist,
  selectedCategory,
  classifierEnabled,
  aiAnalysisStatus,
  classifyError,
  productTitle,
  onProductTitleChange,
  onSelectCategory,
  onRetryAnalysis,
  classifierAdminHint = null,
  retryDisabled = false,
}: Props) {
  if (!hasImage) {
    return (
      <div className="space-y-2">
        <h3 className="text-foreground text-base font-semibold">Данные товара</h3>
        <p className="text-muted-foreground text-sm">
          После загрузки фото здесь появятся название и категория товара.
        </p>
      </div>
    );
  }

  const statusLine = aiStatusMessage(aiAnalysisStatus);
  const categoryOptions = MANUAL_PRODUCT_CATEGORY_OPTIONS;

  return (
    <section className="min-w-0 max-w-full space-y-4" aria-label="Данные товара">
      <div className="space-y-1">
        <h3 className="text-foreground inline-flex items-center gap-1 text-base font-semibold">
          Данные товара
          <InfoTooltip content="Название и категория используются во всех сценариях. Преимущества для карточки заполняются во вкладке «Карточка товара»." />
        </h3>
      </div>

      {statusLine ? (
        <p
          className="text-muted-foreground flex items-center gap-2 text-sm"
          aria-live="polite"
        >
          {aiAnalysisStatus === "analyzing" ? (
            <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
          ) : null}
          {statusLine}
        </p>
      ) : null}

      {!classifierEnabled && aiAnalysisStatus === "unavailable" ? (
        <Alert>
          <AlertDescription>{PRODUCT_CLASSIFIER_MISSING_HINT}</AlertDescription>
        </Alert>
      ) : null}

      {classifyError ? (
        <Alert variant="destructive">
          <AlertDescription>{publicUserErrorMessage(classifyError)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid w-full min-w-0 max-w-full gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="pc-product-title" className="inline-flex items-center gap-1">
            Название товара
            <InfoTooltip content="Краткое название для всех сценариев. Его можно изменить вручную после автоматического распознавания фото." />
          </Label>
          <Input
            id="pc-product-title"
            className="w-full min-w-0"
            value={productTitle}
            disabled={!canPersist}
            maxLength={200}
            placeholder="Например: Беспроводной геймпад"
            onChange={(e) => onProductTitleChange(e.target.value)}
          />
        </div>

        <div className="min-w-0 space-y-2">
          <Label htmlFor="pc-product-category" className="inline-flex items-center gap-1">
            Категория
            <InfoTooltip content="Категория помогает подобрать подходящие концепции съёмки и стиль карточки товара." />
          </Label>
          <select
            id="pc-product-category"
            className="border-input w-full min-w-0 max-w-full rounded-xl border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm"
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
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {onRetryAnalysis && classifierEnabled ? (
          <p className="text-muted-foreground text-xs">
            <button
              type="button"
              className="text-primary underline disabled:opacity-50"
              disabled={retryDisabled || !canPersist}
              onClick={() => void onRetryAnalysis()}
            >
              Обновить данные по фото
            </button>
          </p>
        ) : null}
      </div>

      {classifierAdminHint ? (
        <details className="max-w-full">
          <summary className="text-muted-foreground cursor-pointer text-xs">Admin debug</summary>
          <p className="text-muted-foreground mt-1 break-all font-mono text-[10px] leading-relaxed">
            {classifierAdminHint}
          </p>
        </details>
      ) : null}
    </section>
  );
}
