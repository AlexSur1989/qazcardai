"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutList, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  IMAGE_GENERATION_POLL_INTERVAL_MS,
  IMAGE_GENERATION_POLL_MAX_ITERATIONS,
} from "@/lib/generation-client-polling";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PRODUCT_CARD_CANVASES,
  getPublicProductCardTemplatePresets,
  getPublicProductCardTypographyPresets,
  type ProductCardTemplatePresetId,
  type ProductCardTypographyPresetId,
} from "@/config/product-card-overlay-presets";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import { getFirstOutputUrlFromJson } from "@/lib/product-card-output";
import { cn } from "@/lib/utils";

import { ProductCardTemplatePreview } from "./product-card-template-preview";
import {
  ProductCardVariantGallery,
  type ProductCardVariantGalleryItem,
} from "./product-card-variant-gallery";

const templates = getPublicProductCardTemplatePresets();
const typographyPresets = getPublicProductCardTypographyPresets();
const fallbackSizes = PRODUCT_CARD_CANVASES.filter((item) => item.id === "square" || item.id === "story");

function coerceEstimateCredits(value: unknown): number | null {
  const n =
    typeof value === "bigint"
      ? Number(value)
      : typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.trim())
          : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

function coerceBalanceCredits(value: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function graphemeLen(s: string): number {
  return [...s.trim()].length;
}

type ConceptGenMeta = {
  generationId: string;
};

type GenPreview = {
  id: string;
  status: string;
  outputUrl: string | null;
};

type Props = {
  hasImage: boolean;
  canUseBackend: boolean;
  projectId: string | null;
  balanceCredits: number;
  cardSizePresets: { id: string; label: string; aspectRatio: string }[];
  canLayoutDebug?: boolean;
};

type GenerationMode = "marketplace_card" | "marketplace_card_variants";

function styleForTemplate(template: string): string {
  if (template === "dark_infographic" || template === "feature_grid") return "infographic";
  if (template === "promo_poster") return "bright_advertising";
  if (template === "lifestyle_model") return "premium";
  if (template === "clean_catalog") return "minimalist";
  return "clean_marketplace";
}

function terminal(status: string): boolean {
  return ["COMPLETED", "FAILED", "REFUNDED", "CANCELLED", "BLOCKED"].includes(status);
}

export function MarketplaceCardTab({
  hasImage,
  canUseBackend,
  projectId,
  balanceCredits,
  cardSizePresets,
  canLayoutDebug = false,
}: Props) {
  const balanceNum = coerceBalanceCredits(balanceCredits);
  const [sourceType, setSourceType] = useState<"original" | "concept_generation">("original");
  const [sourceGenerationId, setSourceGenerationId] = useState<string | null>(null);
  const [conceptRows, setConceptRows] = useState<ConceptGenMeta[]>([]);
  const [genPreviews, setGenPreviews] = useState<Record<string, GenPreview | undefined>>({});

  const [generationMode, setGenerationMode] = useState<GenerationMode>("marketplace_card");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [benefits, setBenefits] = useState("");
  const [extraText, setExtraText] = useState("");
  const [statsText, setStatsText] = useState("");
  const [sizeText, setSizeText] = useState("");
  const [userInstructions, setUserInstructions] = useState("");
  const [templatePreset, setTemplatePreset] = useState<ProductCardTemplatePresetId>("light_marketplace");
  const [typographyPreset, setTypographyPreset] = useState<ProductCardTypographyPresetId>("classic");
  const [cardSize, setCardSize] = useState(cardSizePresets[0]?.id ?? "square");
  const [useIcons, setUseIcons] = useState(true);
  const [useArrows, setUseArrows] = useState(true);
  const [useShadows, setUseShadows] = useState(true);
  const [previewLayoutDebug, setPreviewLayoutDebug] = useState(false);

  const [estimating, setEstimating] = useState(false);
  const [estimateCredits, setEstimateCredits] = useState<number | null>(null);
  const [perVariantCredits, setPerVariantCredits] = useState<number | null>(null);
  const [estimatedVariantCount, setEstimatedVariantCount] = useState(1);
  const [estErr, setEstErr] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [results, setResults] = useState<ProductCardVariantGalleryItem[]>([]);
  const [overlayPreview, setOverlayPreview] = useState<{
    svg: string;
    width: number;
    height: number;
    label: string;
  } | null>(null);

  const sizeOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string; aspectRatio: string }>();
    for (const preset of cardSizePresets) map.set(preset.id, preset);
    for (const preset of fallbackSizes) {
      if (!map.has(preset.id)) map.set(preset.id, { id: preset.id, label: preset.label, aspectRatio: preset.aspectRatio });
    }
    return [...map.values()];
  }, [cardSizePresets]);

  const [variantPackCount, setVariantPackCount] = useState<4 | 5 | 6>(6);
  const variantCount = generationMode === "marketplace_card_variants" ? variantPackCount : 1;
  const currentStyle = styleForTemplate(templatePreset);

  const canEstimate = useMemo(
    () =>
      Boolean(
        projectId &&
          canUseBackend &&
          (sourceType === "original" || (sourceType === "concept_generation" && sourceGenerationId)),
      ),
    [projectId, canUseBackend, sourceType, sourceGenerationId],
  );

  const loadProjectMeta = useCallback(async () => {
    if (!projectId) {
      setConceptRows([]);
      return;
    }
    const res = await fetch(`/api/product-card-projects/${projectId}`);
    const parsed = await readJsonSafe<{ project?: { metadata?: { conceptGenerations?: unknown } } }>(res);
    if (!parsed.ok || !res.ok) return;
    const list = parsed.data.project?.metadata?.conceptGenerations;
    const rows: ConceptGenMeta[] = Array.isArray(list)
      ? list
          .map((x) => {
            if (x && typeof x === "object" && "generationId" in x) {
              const g = (x as { generationId: unknown }).generationId;
              if (typeof g === "string" && g.trim()) return { generationId: g.trim() };
            }
            return null;
          })
          .filter((x): x is ConceptGenMeta => x != null)
      : [];
    setConceptRows(rows);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !canUseBackend) return;
    void (async () => {
      await Promise.resolve();
      await loadProjectMeta();
    })();
  }, [projectId, canUseBackend, loadProjectMeta]);

  useEffect(() => {
    if (conceptRows.length === 0) {
      if (sourceType === "concept_generation") {
        void (async () => {
          await Promise.resolve();
          setSourceType("original");
          setSourceGenerationId(null);
        })();
      }
      return;
    }
    void (async () => {
      const next: Record<string, GenPreview> = {};
      for (const row of conceptRows) {
        const res = await fetch(`/api/generations/${row.generationId}`);
        const parsed = await readJsonSafe<{ status: string; outputFiles: unknown }>(res);
        if (parsed.ok && res.ok) {
          next[row.generationId] = {
            id: row.generationId,
            status: parsed.data.status,
            outputUrl: getFirstOutputUrlFromJson(parsed.data.outputFiles),
          };
        }
      }
      setGenPreviews((prev) => ({ ...prev, ...next }));
    })();
  }, [conceptRows, sourceType]);

  useEffect(() => {
    if (sourceType !== "concept_generation" || !conceptRows.length) return;
    const firstId = conceptRows[0]?.generationId;
    if (!firstId) return;
    if (!sourceGenerationId || !conceptRows.some((r) => r.generationId === sourceGenerationId)) {
      void (async () => {
        await Promise.resolve();
        setSourceGenerationId(firstId);
      })();
    }
  }, [sourceType, conceptRows, sourceGenerationId]);

  useEffect(() => {
    if (!canEstimate) return;
    let cancelled = false;
    void (async () => {
      setEstimating(true);
      setEstErr(null);
      const res = await fetch(`/api/product-card-projects/${projectId}/estimate/marketplace-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceGenerationId: sourceType === "original" ? null : sourceGenerationId,
          style: currentStyle,
          cardSize,
          generationMode,
          variantCount,
        }),
      });
      const parsed = await readJsonSafe<{
        credits?: number;
        perVariantCredits?: number;
        variantCount?: number;
        error?: string;
      }>(res);
      if (cancelled) return;
      if (!parsed.ok || !res.ok) {
        setEstErr(parsed.ok ? parsed.data.error ?? "Оценка недоступна" : parsed.message);
        setEstimateCredits(null);
        setPerVariantCredits(null);
        setEstimating(false);
        return;
      }
      setEstimateCredits(coerceEstimateCredits(parsed.data.credits));
      setPerVariantCredits(coerceEstimateCredits(parsed.data.perVariantCredits));
      setEstimatedVariantCount(typeof parsed.data.variantCount === "number" ? parsed.data.variantCount : variantCount);
      setEstimating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [canEstimate, projectId, sourceType, sourceGenerationId, currentStyle, cardSize, generationMode, variantCount]);

  useEffect(() => {
    if (!projectId || !canUseBackend) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/product-card-projects/${projectId}/preview/marketplace-card`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productTitle: title,
            subtitle,
            benefits,
            extraText,
            statsText,
            sizeText,
            style: currentStyle,
            cardSize,
            templatePreset,
            typographyPreset,
            useIcons,
            useArrows,
            useShadows,
            preserveProductLabel: false,
            layoutDebug: canLayoutDebug && previewLayoutDebug,
          }),
        });
        const parsed = await readJsonSafe<{ svg?: string; size?: { width?: number; height?: number; label?: string } }>(res);
        if (cancelled) return;
        if (!parsed.ok || !res.ok || typeof parsed.data.svg !== "string") {
          setOverlayPreview(null);
          return;
        }
        setOverlayPreview({
          svg: parsed.data.svg,
          width: typeof parsed.data.size?.width === "number" ? parsed.data.size.width : 1000,
          height: typeof parsed.data.size?.height === "number" ? parsed.data.size.height : 1000,
          label: parsed.data.size?.label ?? "Preview",
        });
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [projectId, canUseBackend, title, subtitle, benefits, extraText, statsText, sizeText, currentStyle, cardSize, templatePreset, typographyPreset, useIcons, useArrows, useShadows, canLayoutDebug, previewLayoutDebug]);

  const showEstimate = canEstimate;
  const creditsInt = showEstimate ? coerceEstimateCredits(estimateCredits) : null;
  const notEnough = creditsInt != null && balanceNum < creditsInt;
  const balanceAfter =
    creditsInt != null ? Math.max(0, balanceNum - creditsInt) : null;
  const canSubmit =
    showEstimate && !estimating && creditsInt != null && !estErr && !notEnough;

  async function pollGeneration(item: ProductCardVariantGalleryItem): Promise<ProductCardVariantGalleryItem> {
    let status = item.status || "QUEUED";
    let outputUrl = item.outputUrl;
    let errorMessage = item.errorMessage ?? null;
    for (let i = 0; i < IMAGE_GENERATION_POLL_MAX_ITERATIONS; i++) {
      const res = await fetch(`/api/generations/${item.generationId}`);
      const parsed = await readJsonSafe<{ status: string; outputFiles: unknown; errorMessage?: string | null }>(res);
      if (parsed.ok && res.ok) {
        status = parsed.data.status;
        outputUrl = getFirstOutputUrlFromJson(parsed.data.outputFiles) ?? outputUrl;
        errorMessage = parsed.data.errorMessage ?? errorMessage;
      }
      if (terminal(status) && (status !== "COMPLETED" || outputUrl)) break;
      if (i < IMAGE_GENERATION_POLL_MAX_ITERATIONS - 1) {
        await new Promise((r) => setTimeout(r, IMAGE_GENERATION_POLL_INTERVAL_MS));
      }
    }
    return { ...item, status, outputUrl, errorMessage };
  }

  const onSubmit = async () => {
    if (!projectId || !canUseBackend) return;
    setGenError(null);
    setResults([]);
    setGenerating(true);
    const benefitsList = benefits.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    try {
      const body = {
        sourceType,
        sourceGenerationId: sourceType === "original" ? null : sourceGenerationId,
        generationMode,
        variantCount,
        productTitle: title.trim(),
        subtitle: subtitle.trim(),
        benefits: benefitsList.length > 0 ? benefitsList : benefits.trim() || "",
        extraText: extraText.trim(),
        statsText: statsText.trim(),
        sizeText: sizeText.trim(),
        style: currentStyle,
        cardSize,
        templatePreset,
        typographyPreset,
        preserveProductLabel: false,
        useIcons,
        useArrows,
        useShadows,
        userInstructions: userInstructions.trim(),
        clientEstimateCredits: typeof estimateCredits === "number" ? estimateCredits : null,
      };
      const res = await fetch(`/api/product-card-projects/${projectId}/generate/marketplace-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const parsed = await readJsonSafe<{
        generationId?: string;
        generationIds?: string[];
        variants?: ProductCardVariantGalleryItem[];
        status?: string;
        costCredits?: number;
        error?: string;
        code?: string;
        reason?: string;
      }>(res);
      if (!parsed.ok) {
        setGenError(parsed.message);
        return;
      }
      if (!res.ok) {
        const detail = typeof parsed.data.reason === "string" && parsed.data.reason.trim() ? ` — ${parsed.data.reason}` : "";
        setGenError((parsed.data.error ?? "Ошибка") + detail);
        if (res.status === 409 && parsed.data.code === "PRICE_CHANGED") setEstimateCredits(null);
        return;
      }
      const initialItems: ProductCardVariantGalleryItem[] = Array.isArray(parsed.data.variants)
        ? parsed.data.variants.map((v) => ({ ...v, outputUrl: null }))
        : parsed.data.generationId
          ? [{
              generationId: parsed.data.generationId,
              status: parsed.data.status ?? "QUEUED",
              costCredits: parsed.data.costCredits ?? 0,
              outputUrl: null,
              templatePreset,
              typographyPreset,
              variantIndex: 0,
            }]
          : [];
      if (initialItems.length === 0) {
        setGenError("Нет generationId");
        return;
      }
      setResults(initialItems);
      const polled = await Promise.all(initialItems.filter((item) => !item.generationId.startsWith("failed-")).map(pollGeneration));
      const byId = new Map(polled.map((item) => [item.generationId, item]));
      setResults(initialItems.map((item) => byId.get(item.generationId) ?? item));
      void loadProjectMeta();
    } catch {
      setGenError("Сеть или сервер недоступен");
    } finally {
      setGenerating(false);
    }
  };

  if (!hasImage) {
    return (
      <Alert>
        <AlertTitle>Нет исходного фото</AlertTitle>
        <AlertDescription>Загрузите фото товара выше, чтобы открыть этот сценарий.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-primary/15">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <LayoutList className="size-5" />
          Карточка товара
        </CardTitle>
        <CardDescription>
          AI создаёт визуальную основу без текста, а QazCard AI накладывает финальные подписи, плашки, иконки и стрелки отдельно.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {canUseBackend && (
          <div className="space-y-3">
            <Label className="text-[#0C2D38]">Источник изображения</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={sourceType === "original" ? "default" : "outline"} className="rounded-xl" onClick={() => { setSourceType("original"); setSourceGenerationId(null); }}>
                Исходные фото
              </Button>
              {conceptRows.length > 0 && (
                <Button type="button" size="sm" variant={sourceType === "concept_generation" ? "default" : "outline"} className="rounded-xl" onClick={() => setSourceType("concept_generation")}>
                  Сгенерированное фото
                </Button>
              )}
            </div>
            {conceptRows.length === 0 && <p className="text-xs text-[#4a6e7a]">Сначала создайте AI-фото во вкладке «Фото с концепциями».</p>}
            {sourceType === "concept_generation" && conceptRows.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {conceptRows.map((row) => {
                  const preview = genPreviews[row.generationId];
                  return (
                    <button key={row.generationId} type="button" onClick={() => setSourceGenerationId(row.generationId)} className={cn("rounded-2xl border-2 p-2 text-left text-xs transition-colors", sourceGenerationId === row.generationId ? "border-[#00AFCA] bg-[#F4FBFD]" : "border-[#B8DCE6] bg-white hover:border-[#00AFCA]/45")}>
                      <p className="break-all font-mono text-[#4a6e7a]">{row.generationId.slice(0, 12)}…</p>
                      {preview && <p className="mt-1 text-[#4a6e7a]">{preview.status}{preview.outputUrl ? "" : " · нет preview"}</p>}
                      {preview?.outputUrl && (
                        <div className="mt-2 max-h-24 overflow-hidden rounded-xl border border-[#B8DCE6] bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element -- remote URL */}
                          <img src={preview.outputUrl} alt="" className="max-h-24 w-full object-contain" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-[#0C2D38]">Тип генерации</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={generationMode === "marketplace_card" ? "default" : "outline"} className="rounded-xl" onClick={() => setGenerationMode("marketplace_card")}>Один вариант</Button>
            <Button type="button" size="sm" variant={generationMode === "marketplace_card_variants" ? "default" : "outline"} className="rounded-xl" onClick={() => setGenerationMode("marketplace_card_variants")}>Витрина (4–6 вариантов)</Button>
          </div>
        </div>

        {generationMode === "marketplace_card_variants" && (
          <div className="space-y-2">
            <Label className="text-[#0C2D38]">Сколько вариантов</Label>
            <div className="flex flex-wrap gap-2">
              {([4, 5, 6] as const).map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={variantPackCount === n ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setVariantPackCount(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
            <p className="text-xs text-[#4a6e7a]">У каждого варианта — своя генерация и общий ID группы; ошибка одного не отменяет остальные.</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="m-title" className="text-[#0C2D38]">Название товара</Label>
            <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Стильные солнцезащитные очки" className="rounded-xl border-[#B8DCE6]" />
            {graphemeLen(title) > 44 && (
              <p className="text-xs text-amber-800/90" role="status">
                Заголовок длинный — на карточке мы уменьшим кегль или перенесём текст максимум на две строки.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-subtitle" className="text-[#0C2D38]">Подзаголовок</Label>
            <Input id="m-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={160} placeholder="Классический черный цвет" className="rounded-xl border-[#B8DCE6]" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="m-benefits" className="text-[#0C2D38]">Преимущества</Label>
          <Textarea id="m-benefits" value={benefits} onChange={(e) => setBenefits(e.target.value)} rows={4} placeholder={"Удобная посадка\nПремиум качество\nКүннен қорғайды\nЖеңіл жақтау"} className="rounded-xl border-[#B8DCE6]" />
          <p className="text-xs text-[#4a6e7a]">Каждая строка — отдельный пункт. Лучше 3–5 коротких преимуществ.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="m-extra" className="text-[#0C2D38]">Дополнительный текст</Label>
            <Input id="m-extra" value={extraText} onChange={(e) => setExtraText(e.target.value)} maxLength={200} placeholder="Хит продаж" className="rounded-xl border-[#B8DCE6]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-stats" className="text-[#0C2D38]">Статистика / цифры</Label>
            <Input id="m-stats" value={statsText} onChange={(e) => setStatsText(e.target.value)} maxLength={120} placeholder="UV400" className="rounded-xl border-[#B8DCE6]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-size" className="text-[#0C2D38]">Объём / вес / размер</Label>
            <Input id="m-size" value={sizeText} onChange={(e) => setSizeText(e.target.value)} maxLength={120} placeholder="Универсальный размер" className="rounded-xl border-[#B8DCE6]" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="m-what" className="text-[#0C2D38]">Пожелания к визуалу</Label>
          <Textarea id="m-what" value={userInstructions} onChange={(e) => setUserInstructions(e.target.value)} maxLength={1000} rows={3} placeholder="Фон, атмосфера, композиция, свет…" className="rounded-xl border-[#B8DCE6]" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-[#0C2D38]">Стиль карточки / композиция</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((template) => (
                <button key={template.id} type="button" onClick={() => setTemplatePreset(template.id)} className={cn("rounded-2xl border p-3 text-left transition", templatePreset === template.id ? "border-[#00AFCA] bg-[#e8f8fb]" : "border-[#B8DCE6] bg-white hover:border-[#00AFCA]/45")}>
                  <p className="text-sm font-medium text-[#0C2D38]">{template.label}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-[#4a6e7a]">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#0C2D38]">Типографика</Label>
              <div className="flex flex-wrap gap-2">
                {typographyPresets.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => setTypographyPreset(preset.id)} className={cn("rounded-full border px-3 py-1.5 text-xs transition", typographyPreset === preset.id ? "border-[#00AFCA] bg-[#e8f8fb] text-[#006b82]" : "border-border bg-background text-foreground")}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#0C2D38]">Размер карточки</Label>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => setCardSize(preset.id)} className={cn("rounded-full border px-3 py-1.5 text-xs transition", cardSize === preset.id ? "border-[#00AFCA] bg-[#e8f8fb] text-[#006b82]" : "border-border bg-background text-foreground")}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 text-sm text-[#0C2D38]">
              {[{ label: "Добавлять иконки", value: useIcons, set: setUseIcons }, { label: "Добавлять стрелки", value: useArrows, set: setUseArrows }, { label: "Добавлять тени", value: useShadows, set: setUseShadows }].map((row) => (
                <label key={row.label} className="flex items-start gap-2 rounded-xl border border-[#B8DCE6] bg-white p-2">
                  <input type="checkbox" checked={row.value} onChange={(e) => row.set(e.target.checked)} className="mt-1" />
                  <span>{row.label}</span>
                </label>
              ))}
              <div className="flex items-start gap-2 rounded-xl border border-dashed border-[#c9dbe1] bg-[#f9fcfd] p-2 opacity-90">
                <input type="checkbox" disabled checked={false} readOnly className="mt-1" aria-hidden />
                <span className="text-[#345b66]">
                  <span className="font-medium text-[#0C2D38]">
                    Сохранить надписи и упаковку без изменений{" "}
                    <span className="rounded bg-[#eef6f9] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#006b82]">Скоро</span>
                  </span>
                  <span className="mt-1 block text-xs leading-snug">
                    Скоро: оставим оригинальный слой товара с этикеткой поверх нового фона через cutout. Сейчас опция недоступна.
                  </span>
                </span>
              </div>
              {canLayoutDebug && (
                <label className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/40 p-2">
                  <input type="checkbox" checked={previewLayoutDebug} onChange={(e) => setPreviewLayoutDebug(e.target.checked)} className="mt-1" />
                  <span>
                    <span className="font-medium">Отладка оверлея (админ)</span>
                    <span className="mt-1 block text-xs text-[#6b5720]">Показать запретную зону и safe-zone в SVG-превью.</span>
                  </span>
                </label>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-[#4a6e7a]">
          Превью показывает примерную схему зон. Финальная карточка после генерации подстраивается под силуэт товара на базовом изображении и может использовать другую раскладку, если места для текста мало.
        </p>
        <ProductCardTemplatePreview svg={overlayPreview?.svg ?? null} width={overlayPreview?.width ?? 1000} height={overlayPreview?.height ?? 1000} label={overlayPreview?.label ?? "Preview"} />

        {canUseBackend && (
          <div className="space-y-1 text-sm text-[#4a6e7a]">
            {showEstimate && estimating && <p>Рассчитываем стоимость…</p>}
            {estErr && <p className="text-destructive" role="alert">{estErr}</p>}
            {showEstimate && !estimating && creditsInt != null && !estErr && (
              <p>
                Один вариант:{" "}
                <span className="font-medium tabular-nums text-[#0C2D38]">
                  {coerceEstimateCredits(perVariantCredits ?? undefined) ?? creditsInt}
                </span>{" "}
                ток. · Количество: <span className="font-medium tabular-nums text-[#0C2D38]">{estimatedVariantCount}</span> ·
                Итого: <span className="font-medium tabular-nums text-[#0C2D38]">{creditsInt}</span> ток. · Баланс:{" "}
                <span className="font-medium tabular-nums text-[#0C2D38]">{balanceNum}</span> · После:{" "}
                <span className="font-medium tabular-nums text-[#0C2D38]">{balanceAfter ?? 0}</span>
              </p>
            )}
            {notEnough && (
              <p>
                Недостаточно токенов. <Link href="/dashboard/billing" className="font-medium text-[#00AFCA] underline">Пополнить баланс</Link>
              </p>
            )}
          </div>
        )}

        <Button type="button" onClick={() => void onSubmit()} disabled={!canSubmit || generating}>
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {generationMode === "marketplace_card_variants" ? `Создаём ${variantCount} вариантов…` : "Создаём карточку…"}
            </>
          ) : generationMode === "marketplace_card_variants" ? `Создать ${variantCount} вариантов` : "Создать карточку"}
        </Button>
        {!canUseBackend && <p className="text-xs text-[#4a6e7a]">Сначала привяжите фото к проекту.</p>}

        {genError && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertTitle>Генерация</AlertTitle>
            <AlertDescription>{genError}</AlertDescription>
          </Alert>
        )}

        <ProductCardVariantGallery
          items={results}
          onEditText={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onCreateSimilar={(item) => {
            if (item.templatePreset) setTemplatePreset(item.templatePreset as ProductCardTemplatePresetId);
            if (item.typographyPreset) setTypographyPreset(item.typographyPreset as ProductCardTypographyPresetId);
            setGenerationMode("marketplace_card");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </CardContent>
    </Card>
  );
}
