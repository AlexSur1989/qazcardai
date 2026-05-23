"use client";

import { useMemo } from "react";

import type { ProductCardMarketplaceProfile } from "@/config/product-card-marketplace-profiles";
import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
import { getAllowedTemplatesForSlide } from "@/config/card-builder-template-allowlist";
import type { CardBuilderProductFact } from "@/lib/card-builder-product-facts";
import {
  buildSlidePreviewModels,
  formatUnusedFactLine,
  unusedProductFactsForSlides,
} from "@/lib/card-builder-slide-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const nativeFieldClass =
  "h-10 w-full min-w-0 rounded-xl border border-input bg-card px-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

type GallerySlide = {
  slideId: string;
  title: string;
  imageRole: string;
  templateId?: string;
  templateLabel?: string;
};

type SlideGenEntry = { status: string; url: string | null };

type Props = {
  slides: GallerySlide[];
  productFacts: CardBuilderProductFact[];
  productTitle: string;
  textDensity: string;
  mainPhotoTextAllowed: boolean;
  slideGen: Record<string, SlideGenEntry>;
  activeSlideId: string | null;
  onSelectSlide: (slideId: string) => void;
  canWork: boolean;
  genBusy: boolean;
  batchBusy: boolean;
  tplBusySlideId: string | null;
  resolvedPlannerCategory: string;
  templateProfile: ProductCardMarketplaceProfile;
  onChangeTemplate: (slideId: string, templateId: string) => void;
  onGenerateSlide: (slideId: string) => void;
  styleReferencePreviewActive: boolean;
  primaryStyleReferenceThumbUrl: string;
  slideProgressLabel: (status: string) => string;
};

function ExactTextBadge() {
  return (
    <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px] font-normal">
      Точный текст
    </Badge>
  );
}

export function CardBuilderGalleryPreview({
  slides,
  productFacts,
  productTitle,
  textDensity,
  mainPhotoTextAllowed,
  slideGen,
  activeSlideId,
  onSelectSlide,
  canWork,
  genBusy,
  batchBusy,
  tplBusySlideId,
  resolvedPlannerCategory,
  templateProfile,
  onChangeTemplate,
  onGenerateSlide,
  styleReferencePreviewActive,
  primaryStyleReferenceThumbUrl,
  slideProgressLabel,
}: Props) {
  const previewModels = useMemo(
    () =>
      buildSlidePreviewModels(slides, productFacts, {
        productTitle: productTitle.trim() || undefined,
        textDensity,
        mainPhotoTextAllowed,
      }),
    [slides, productFacts, productTitle, textDensity, mainPhotoTextAllowed],
  );

  const previewBySlideId = useMemo(() => {
    const map = new Map<string, (typeof previewModels)[number]>();
    for (const m of previewModels) map.set(m.slideId, m);
    return map;
  }, [previewModels]);

  const unusedFacts = useMemo(
    () => unusedProductFactsForSlides(
      slides.map((s) => s.imageRole),
      productFacts,
    ),
    [slides, productFacts],
  );

  return (
    <Card className="rounded-2xl border-primary/30 bg-gradient-to-b from-[#e8f8fb] to-white">
      <CardHeader>
        <CardTitle className="text-base">Структура карточки</CardTitle>
        <CardDescription>
          Проверьте, какие карточки будут созданы и какой текст попадёт на каждый слайд, прежде чем
          тратить токены.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {styleReferencePreviewActive ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
            {primaryStyleReferenceThumbUrl.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element -- style ref thumb
              <img
                src={primaryStyleReferenceThumbUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-md border object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <div className="font-medium text-primary">Референс стиля активен</div>
              <div className="text-muted-foreground leading-snug">
                Товар остаётся с исходного фото; референс влияет только на верстку и визуальную
                подачу.
              </div>
            </div>
          </div>
        ) : null}

        {slides.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Нажмите «Сгенерировать структуру» — здесь появится план из 6–8 карточек с текстом и
            данными по каждому слайду.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {slides.map((s) => {
                const preview = previewBySlideId.get(s.slideId);
                const st = slideGen[s.slideId]?.status ?? "не сгенерировано";
                const url = slideGen[s.slideId]?.url;
                const active = activeSlideId === s.slideId;
                const tplOptions = getAllowedTemplatesForSlide({
                  categoryKey: resolvedPlannerCategory,
                  marketplaceProfile: templateProfile,
                  imageRole: s.imageRole as CardBuilderTemplateSlideRole,
                  currentTemplateId: s.templateId,
                  hasConcreteDimensions: false,
                  mustShowScale: false,
                });
                const tplBusy = tplBusySlideId === s.slideId;

                return (
                  <div
                    key={s.slideId}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectSlide(s.slideId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onSelectSlide(s.slideId);
                    }}
                    className={cn(
                      "cursor-pointer rounded-xl border p-3 transition-colors",
                      active ? "border-primary bg-primary/5" : "border-border bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <div className="text-muted-foreground text-[11px] font-medium tabular-nums">
                            Карточка {preview?.index ?? "—"}
                          </div>
                          <div className="font-medium text-sm">{preview?.title ?? s.title}</div>
                          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                            {preview?.purpose}
                          </p>
                          <p className="text-muted-foreground mt-1 text-[11px]">
                            Шаблон: {preview?.templateLabel ?? s.templateLabel ?? "—"}
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-[11px]">
                            Статус генерации: {slideProgressLabel(st)}
                          </p>
                        </div>

                        <div className="rounded-lg border border-border/80 bg-muted/20 px-2.5 py-2">
                          <div className="text-[11px] font-medium text-foreground">Текст на карточке</div>
                          {preview && preview.cardTextPhrases.length > 0 ? (
                            <ul className="mt-1.5 space-y-1 text-xs">
                              {preview.cardTextPhrases.map((phrase) => (
                                <li key={phrase} className="flex flex-wrap items-center gap-1.5">
                                  <span>{phrase}</span>
                                  <ExactTextBadge />
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground mt-1 text-xs">Без текста</p>
                          )}
                        </div>

                        <div className="rounded-lg border border-border/80 bg-muted/20 px-2.5 py-2">
                          <div className="text-[11px] font-medium text-foreground">Данные товара</div>
                          {preview && preview.facts.length > 0 ? (
                            <ul className="mt-1.5 space-y-1 text-xs">
                              {preview.facts.map((f) => (
                                <li key={f.id} className="flex flex-wrap items-center gap-1.5">
                                  <span>
                                    {f.label}: {f.value}
                                  </span>
                                  {f.exactText ? <ExactTextBadge /> : null}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground mt-1 text-xs">Без дополнительных данных</p>
                          )}
                        </div>

                        {preview?.warning ? (
                          <p className="text-amber-800 dark:text-amber-200 text-[11px] leading-snug">
                            {preview.warning}
                          </p>
                        ) : null}

                        <div className="space-y-1 pt-1">
                          <Label className="text-[11px] text-muted-foreground">Изменить шаблон</Label>
                          <select
                            className={`${nativeFieldClass} h-9 max-w-full text-xs`}
                            value={s.templateId ?? tplOptions[0]?.templateId ?? ""}
                            disabled={!canWork || tplBusy || tplOptions.length < 2}
                            aria-busy={tplBusy}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v || v === s.templateId) return;
                              onChangeTemplate(s.slideId, v);
                            }}
                          >
                            {tplOptions.map((t) => (
                              <option key={t.templateId} value={t.templateId}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg shrink-0 text-xs"
                        disabled={!canWork || genBusy || batchBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateSlide(s.slideId);
                        }}
                      >
                        Сгенерировать
                      </Button>
                    </div>
                    {url ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- generation preview */}
                        <img src={url} alt="" className="max-h-40 rounded-lg border object-contain" />
                        <a href={url} download className="text-primary text-xs underline">
                          Скачать
                        </a>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-2.5">
              <div className="text-xs font-medium">Неиспользованные данные</div>
              {unusedFacts.length === 0 ? (
                <p className="text-muted-foreground mt-1 text-xs">Все данные распределены по карточкам.</p>
              ) : (
                <ul className="text-muted-foreground mt-1.5 list-inside list-disc space-y-0.5 text-xs">
                  {unusedFacts.map((f) => (
                    <li key={f.id}>{formatUnusedFactLine(f)}</li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
