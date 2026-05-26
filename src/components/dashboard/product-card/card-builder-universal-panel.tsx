"use client";

import { useCallback, useMemo } from "react";

import {
  CARD_BUILDER_CREATION_MODES,
  CARD_BUILDER_SINGLE_CARD_TYPES,
  CARD_BUILDER_UNIVERSAL_CATEGORIES,
  CARD_BUILDER_VISUAL_STYLES,
  labelForUniversalCategory,
  type CardBuilderCreationModeId,
  type CardBuilderSingleCardTypeId,
  type CardBuilderUniversalCategoryId,
  type CardBuilderVisualStyleId,
} from "@/config/card-builder-universal";
import type { CardBuilderTextAmountToggle } from "@/lib/card-builder-style-choice";
import {
  benefitTextareaValue,
  mergeBenefitFactsFromTextarea,
  mergeBeforeAfterFactsFromTextarea,
  mergeProductPurposeFromTextarea,
  mergePromoFactsFromTextarea,
  mergeReviewFactsFromTextarea,
  beforeAfterTextareaValue,
  promoTextareaValue,
  reviewTextareaValue,
  newProductFactId,
  productPurposeTextareaValue,
  type CardBuilderProductFact,
} from "@/lib/card-builder-product-facts";
import { hasUnverifiedWebSuggestedFacts } from "@/lib/card-builder-fact-eligibility";
import type { ProductCardWebResearchMeta } from "@/lib/product-card-web-research-config";
import { CardBuilderFactsReviewPanel } from "@/components/dashboard/product-card/card-builder-facts-review-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CARD_BUILDER_OUTPUT_SIZES,
  labelForCardBuilderOutputSize,
  type CardBuilderOutputSizeId,
} from "@/config/card-builder-output-sizes";

const nativeFieldClass =
  "h-10 w-full min-w-0 rounded-xl border border-input bg-card px-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

const BENEFITS_PLACEHOLDER = `Например:
Лёгкая и компактная
Удобно брать с собой
Подходит для спорта`;

export type VisionSummary = {
  categoryKey?: string;
  productType?: string;
  productNameGuess?: string;
  mainColors?: string[];
  styleGuess?: string | null;
  materialGuess?: string | null;
  analysisFailed?: boolean;
  warnings?: string[];
};

type Props = {
  visionLoading: boolean;
  visionSummary: VisionSummary | null;
  categoryKey: CardBuilderUniversalCategoryId;
  productType: string;
  productNameGuess: string;
  productFacts: CardBuilderProductFact[];
  creationMode: CardBuilderCreationModeId;
  singleCardType: CardBuilderSingleCardTypeId;
  visualStyle: CardBuilderVisualStyleId;
  textAmountToggle: CardBuilderTextAmountToggle;
  gallerySlideCount: 6 | 8;
  outputSizeId: CardBuilderOutputSizeId;
  onCategoryKeyChange: (v: CardBuilderUniversalCategoryId) => void;
  onProductTypeChange: (v: string) => void;
  onProductNameGuessChange: (v: string) => void;
  onProductFactsChange: (facts: CardBuilderProductFact[]) => void;
  onCreationModeChange: (v: CardBuilderCreationModeId) => void;
  onSingleCardTypeChange: (v: CardBuilderSingleCardTypeId) => void;
  onVisualStyleChange: (v: CardBuilderVisualStyleId) => void;
  onTextAmountToggleChange: (v: CardBuilderTextAmountToggle) => void;
  onGallerySlideCountChange: (v: 6 | 8) => void;
  onOutputSizeIdChange: (v: CardBuilderOutputSizeId) => void;
  onRetryAnalysis?: () => void;
  canRetryAnalysis?: boolean;
  webResearchLoading?: boolean;
  webResearchMeta?: ProductCardWebResearchMeta | null;
  onWebResearch?: () => void;
  canWebResearch?: boolean;
  onConfirmFacts?: (confirmIds: string[], deleteIds?: string[]) => void;
  factsConfirming?: boolean;
};

export function CardBuilderUniversalPanel({
  visionLoading,
  visionSummary,
  categoryKey,
  productType,
  productNameGuess,
  productFacts,
  creationMode,
  singleCardType,
  visualStyle,
  textAmountToggle,
  gallerySlideCount,
  outputSizeId,
  onCategoryKeyChange,
  onProductTypeChange,
  onProductNameGuessChange,
  onProductFactsChange,
  onCreationModeChange,
  onSingleCardTypeChange,
  onVisualStyleChange,
  onTextAmountToggleChange,
  onGallerySlideCountChange,
  onOutputSizeIdChange,
  onRetryAnalysis,
  canRetryAnalysis,
  webResearchLoading,
  webResearchMeta,
  onWebResearch,
  canWebResearch,
  onConfirmFacts,
  factsConfirming,
}: Props) {
  const benefitsText = useMemo(() => benefitTextareaValue(productFacts), [productFacts]);
  const productPurposeText = useMemo(() => productPurposeTextareaValue(productFacts), [productFacts]);
  const promoText = useMemo(() => promoTextareaValue(productFacts), [productFacts]);
  const reviewText = useMemo(() => reviewTextareaValue(productFacts), [productFacts]);
  const beforeAfterText = useMemo(() => beforeAfterTextareaValue(productFacts), [productFacts]);
  const hasPendingWebFacts = useMemo(
    () => hasUnverifiedWebSuggestedFacts(productFacts),
    [productFacts],
  );

  const handleBenefitsTextChange = useCallback(
    (text: string) => {
      onProductFactsChange(mergeBenefitFactsFromTextarea(productFacts, text));
    },
    [onProductFactsChange, productFacts],
  );

  const handleProductPurposeChange = useCallback(
    (text: string) => {
      onProductFactsChange(mergeProductPurposeFromTextarea(productFacts, text));
    },
    [onProductFactsChange, productFacts],
  );

  const handlePromoChange = useCallback(
    (text: string) => {
      onProductFactsChange(mergePromoFactsFromTextarea(productFacts, text));
    },
    [onProductFactsChange, productFacts],
  );

  const handleReviewChange = useCallback(
    (text: string) => {
      onProductFactsChange(mergeReviewFactsFromTextarea(productFacts, text));
    },
    [onProductFactsChange, productFacts],
  );

  const handleBeforeAfterChange = useCallback(
    (text: string) => {
      onProductFactsChange(mergeBeforeAfterFactsFromTextarea(productFacts, text));
    },
    [onProductFactsChange, productFacts],
  );

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border">
        <CardHeader>
          <CardTitle className="text-base">Мы распознали товар</CardTitle>
          <CardDescription>
            Распознаём только то, что видно на фото. Для характеристик из интернета — отдельный шаг ниже.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {visionLoading ? (
            <div className="space-y-2">
              <p className="text-muted-foreground flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Распознаём товар на фото…
              </p>
              <p className="text-muted-foreground text-xs">
                Загрузка уже завершена — поля ниже можно заполнять вручную, пока идёт анализ.
              </p>
            </div>
          ) : visionSummary ? (
            <>
              {visionSummary.analysisFailed ? (
                <Alert>
                  <AlertTitle>Не удалось полностью распознать товар</AlertTitle>
                  <AlertDescription>
                    Заполните данные вручную — генерация всё равно доступна.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Категория: </span>
                  <span className="font-medium">
                    {labelForUniversalCategory(visionSummary.categoryKey ?? categoryKey)}
                  </span>
                </div>
                {visionSummary.productNameGuess?.trim() ? (
                  <div>
                    <span className="text-muted-foreground">Название: </span>
                    <span>{visionSummary.productNameGuess.trim()}</span>
                  </div>
                ) : null}
                {visionSummary.productType?.trim() ? (
                  <div>
                    <span className="text-muted-foreground">Тип: </span>
                    <span>{visionSummary.productType.trim()}</span>
                  </div>
                ) : null}
                {visionSummary.mainColors?.length ? (
                  <div>
                    <span className="text-muted-foreground">Цвет: </span>
                    <span>{visionSummary.mainColors.slice(0, 4).join(", ")}</span>
                  </div>
                ) : null}
                {visionSummary.styleGuess ? (
                  <div>
                    <span className="text-muted-foreground">Стиль: </span>
                    <span>{visionSummary.styleGuess}</span>
                  </div>
                ) : null}
                {visionSummary.materialGuess ? (
                  <div>
                    <span className="text-muted-foreground">Материал: </span>
                    <span>{visionSummary.materialGuess}</span>
                  </div>
                ) : null}
              </div>
              {visionSummary.warnings?.length ? (
                <ul className="text-muted-foreground list-inside list-disc text-xs">
                  {visionSummary.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">Загрузите фото — данные появятся автоматически.</p>
          )}
          {canRetryAnalysis && onRetryAnalysis ? (
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={onRetryAnalysis}>
              Обновить распознавание
            </Button>
          ) : null}
          {webResearchMeta?.provider === "mock" ? (
            <p className="text-muted-foreground text-xs">
              Web Research в demo-режиме (нет TAVILY_API_KEY на сервере). Добавьте ключ для реального поиска.
            </p>
          ) : null}
          {canWebResearch && onWebResearch ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-xl"
              disabled={webResearchLoading || visionLoading || visionSummary?.analysisFailed}
              onClick={onWebResearch}
            >
              {webResearchLoading ? "Ищем…" : "Найти характеристики в интернете"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border">
        <CardHeader>
          <CardTitle className="text-base">Проверьте данные товара</CardTitle>
          <CardDescription>
            В генерацию попадают только подтверждённые или видимые на фото данные.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPendingWebFacts ? (
            <Alert>
              <AlertTitle>Есть неподтверждённые характеристики</AlertTitle>
              <AlertDescription>
                Добавьте преимущества вручную или подтвердите найденные характеристики из интернета.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cb-category">Категория</Label>
              <select
                id="cb-category"
                className={nativeFieldClass}
                value={categoryKey}
                onChange={(e) =>
                  onCategoryKeyChange(e.target.value as CardBuilderUniversalCategoryId)
                }
              >
                {CARD_BUILDER_UNIVERSAL_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cb-product-type">Тип товара</Label>
              <Input
                id="cb-product-type"
                value={productType}
                onChange={(e) => onProductTypeChange(e.target.value)}
                className="rounded-xl"
                placeholder="Например: термокружка"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cb-product-name">Название на карточке</Label>
            <Input
              id="cb-product-name"
              value={productNameGuess}
              onChange={(e) => onProductNameGuessChange(e.target.value)}
              className="rounded-xl"
              placeholder="Например: Карманные электронные весы"
              maxLength={200}
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Заголовок товара на слайдах с текстом (главное фото, преимущества и др.). После
              распознавания фото подставляется автоматически — проверьте и при необходимости
              исправьте. Пустое поле — используется название проекта или «Товар».
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cb-product-purpose">Краткое описание товара</Label>
            <Textarea
              id="cb-product-purpose"
              value={productPurposeText}
              onChange={(e) => handleProductPurposeChange(e.target.value)}
              rows={2}
              className="rounded-xl text-sm"
              placeholder="Например: Шампунь против перхоти для мужчин"
            />
            <p className="text-muted-foreground text-xs">
              Назначение или краткое описание — попадёт на lifestyle, главное фото (как подзаголовок) и
              premium-слайды. Не смешивается с преимуществами.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cb-benefits">Преимущества товара</Label>
            <Textarea
              id="cb-benefits"
              value={benefitsText}
              onChange={(e) => handleBenefitsTextChange(e.target.value)}
              rows={4}
              className="rounded-xl text-sm"
              placeholder={BENEFITS_PLACEHOLDER}
            />
            <p className="text-muted-foreground text-xs">
              Каждая строка — отдельное преимущество. Текст попадёт только на слайд «Преимущества» и сохранится
              точно.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cb-promo">Акция / скидка (опционально)</Label>
              <Textarea
                id="cb-promo"
                value={promoText}
                onChange={(e) => handlePromoChange(e.target.value)}
                rows={2}
                className="rounded-xl text-sm"
                placeholder="Например: −20% до 31 мая"
              />
              <p className="text-muted-foreground text-xs">
                Для слайда «Акция / предложение». Без текста акционный слайд не генерируется.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cb-review">Отзыв / рейтинг (опционально)</Label>
              <Textarea
                id="cb-review"
                value={reviewText}
                onChange={(e) => handleReviewChange(e.target.value)}
                rows={2}
                className="rounded-xl text-sm"
                placeholder="Например: «Отличный товар» — 4.9 ★"
              />
              <p className="text-muted-foreground text-xs">
                Только реальные данные. Для слайда «Отзывы / доверие».
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cb-before-after">До / после (опционально)</Label>
            <Textarea
              id="cb-before-after"
              value={beforeAfterText}
              onChange={(e) => handleBeforeAfterChange(e.target.value)}
              rows={2}
              className="rounded-xl text-sm"
              placeholder="Кратко опишите подтверждённый результат"
            />
            <p className="text-muted-foreground text-xs">
              Только если у вас есть реальный подтверждённый эффект. Без данных слайд «До/после» не генерируется.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Характеристики и детали</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() =>
                  onProductFactsChange([
                    ...productFacts,
                    {
                      id: newProductFactId(),
                      label: "Характеристика",
                      value: "",
                      type: "detail",
                      source: "user",
                      visibleOnCard: true,
                      lockedText: true,
                      verifiedByUser: true,
                      evidence: "user_input",
                    },
                  ])
                }
              >
                Добавить вручную
              </Button>
            </div>
            <CardBuilderFactsReviewPanel
              facts={productFacts}
              webResearchMeta={webResearchMeta}
              onFactsChange={onProductFactsChange}
              onConfirmFacts={(confirmIds, deleteIds) => onConfirmFacts?.(confirmIds, deleteIds)}
              confirming={factsConfirming}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border">
        <CardHeader>
          <CardTitle className="text-base">Что создать?</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cb-creation-mode">Режим</Label>
            <select
              id="cb-creation-mode"
              className={nativeFieldClass}
              value={creationMode}
              onChange={(e) => onCreationModeChange(e.target.value as CardBuilderCreationModeId)}
            >
              {CARD_BUILDER_CREATION_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {creationMode === "full_gallery" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cb-gallery-count">Состав галереи</Label>
              <select
                id="cb-gallery-count"
                className={nativeFieldClass}
                value={String(gallerySlideCount)}
                onChange={(e) =>
                  onGallerySlideCountChange(e.target.value === "8" ? 8 : 6)
                }
              >
                <option value="6">6 карточек</option>
                <option value="8">8 карточек</option>
              </select>
            </div>
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <Label>Размер готовой карточки</Label>
            <div className="flex flex-wrap gap-2">
              {CARD_BUILDER_OUTPUT_SIZES.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onOutputSizeIdChange(preset.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    outputSizeId === preset.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/50",
                  )}
                >
                  {labelForCardBuilderOutputSize(preset.id)}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Формат применяется ко всем слайдам галереи или к одной выбранной карточке.
            </p>
          </div>
          {creationMode === "single" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cb-single-type">Тип карточки</Label>
              <select
                id="cb-single-type"
                className={nativeFieldClass}
                value={singleCardType}
                onChange={(e) => onSingleCardTypeChange(e.target.value as CardBuilderSingleCardTypeId)}
              >
                {CARD_BUILDER_SINGLE_CARD_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cb-visual-style">Стиль карточки</Label>
            <select
              id="cb-visual-style"
              className={nativeFieldClass}
              value={visualStyle}
              onChange={(e) => onVisualStyleChange(e.target.value as CardBuilderVisualStyleId)}
            >
              {CARD_BUILDER_VISUAL_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cb-text-amount">Текст на карточке</Label>
            <select
              id="cb-text-amount"
              className={nativeFieldClass}
              value={textAmountToggle}
              onChange={(e) =>
                onTextAmountToggleChange(e.target.value === "less" ? "less" : "more")
              }
            >
              <option value="less">Меньше текста</option>
              <option value="more">Больше текста</option>
            </select>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Итоговая плотность текста зависит от типа слайда — на lifestyle и главном фото текст
              автоматически ограничивается.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
