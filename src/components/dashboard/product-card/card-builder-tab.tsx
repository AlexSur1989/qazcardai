"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CARD_BUILDER_AUDIENCES,
  CARD_BUILDER_BENEFIT_TAGS,
  CARD_BUILDER_GOALS,
  CARD_BUILDER_LANGUAGE_MODES,
  CARD_BUILDER_MARKETPLACES,
  CARD_BUILDER_MUST_SHOW,
  CARD_BUILDER_PRESERVE_ASPECTS,
  CARD_BUILDER_PRICE_SEGMENTS,
  CARD_BUILDER_SALES_STYLES,
  CARD_BUILDER_TEXT_DENSITY,
} from "@/config/card-builder-config";
import type { ProductCategoryId } from "@/config/product-card-categories";
import {
  listTemplatesForSlideRole,
  type CardBuilderTemplateSlideRole,
} from "@/config/card-builder-templates";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import {
  IMAGE_GENERATION_POLL_INTERVAL_MS,
  IMAGE_GENERATION_POLL_MAX_ITERATIONS,
} from "@/lib/generation-client-polling";
import { getFirstOutputUrlFromJson } from "@/lib/product-card-output";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const nativeFieldClass =
  "h-10 w-full min-w-0 rounded-xl border border-input bg-card px-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

type GallerySlide = {
  slideId: string;
  title: string;
  purpose?: string;
  imageRole: string;
  templateId?: string;
  templateLabel?: string;
  layoutPreset?: string;
  previewCaption?: string;
};

type CardBuilderGenHistoryRow = {
  generationId: string;
  slideId: string;
  imageRole?: string;
  createdAt?: string;
  status?: string;
};

type Props = {
  hasImage: boolean;
  canUseBackend: boolean;
  projectId: string | null;
  selectedCategory: ProductCategoryId | null;
  balanceCredits: number;
};

export function CardBuilderTab({
  hasImage,
  canUseBackend,
  projectId,
  selectedCategory,
  balanceCredits,
}: Props) {
  const [marketplace, setMarketplace] = useState("ozon");
  const [goal, setGoal] = useState("full_gallery_6");
  const [preserveProduct, setPreserveProduct] = useState(true);
  const [preserveAspects, setPreserveAspects] = useState<string[]>([
    "shape",
    "color",
    "logo",
    "proportions",
  ]);
  const [creativeStyle, setCreativeStyle] = useState(false);
  const [benefitsSel, setBenefitsSel] = useState<string[]>([]);
  const [benefitsExtra, setBenefitsExtra] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [dimensionsUser, setDimensionsUser] = useState("");
  const [languageMode, setLanguageMode] = useState("auto");
  const [mustSel, setMustSel] = useState<string[]>(["texture", "details"]);
  const [audience, setAudience] = useState("mass_market");
  const [priceSegment, setPriceSegment] = useState("middle");
  const [salesStyle, setSalesStyle] = useState("light_marketplace");
  const [textDensity, setTextDensity] = useState("medium");

  const [slides, setSlides] = useState<GallerySlide[]>([]);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const [estimateSingle, setEstimateSingle] = useState<number | null>(null);
  const [estimateGallery, setEstimateGallery] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);

  const [slideGen, setSlideGen] = useState<Record<string, { status: string; url: string | null }>>(
    {},
  );
  const [genHistory, setGenHistory] = useState<CardBuilderGenHistoryRow[]>([]);
  const [tplBusySlideId, setTplBusySlideId] = useState<string | null>(null);

  const canWork = Boolean(hasImage && canUseBackend && projectId && selectedCategory);

  const planPayload = useMemo(
    () => ({
      selectedCategory: selectedCategory ?? "other",
      marketplace,
      goal,
      preserveProduct,
      preserveAspects,
      allowCreativeStylization: creativeStyle,
      benefits: benefitsSel,
      benefitsExtra: benefitsExtra.trim() || undefined,
      subtitle: subtitle.trim() || undefined,
      dimensions: dimensionsUser.trim() || undefined,
      languageMode,
      mustShow: mustSel,
      audience,
      priceSegment,
      salesStyle,
      textDensity,
    }),
    [
      selectedCategory,
      marketplace,
      goal,
      preserveProduct,
      preserveAspects,
      creativeStyle,
      benefitsSel,
      benefitsExtra,
      subtitle,
      dimensionsUser,
      languageMode,
      mustSel,
      audience,
      priceSegment,
      salesStyle,
      textDensity,
    ],
  );

  const runPlan = useCallback(async () => {
    if (!projectId || !selectedCategory) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await fetch(`/api/product-card-projects/${projectId}/card-builder/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planPayload),
      });
      const parsed = await readJsonSafe<{ slides?: GallerySlide[]; error?: string }>(res);
      if (!parsed.ok) {
        setPlanError(parsed.message);
        return;
      }
      if (!res.ok) {
        setPlanError(parsed.data.error ?? "Не удалось сохранить структуру");
        return;
      }
      const list = parsed.data.slides ?? [];
      setSlides(list);
      setActiveSlideId(list[0]?.slideId ?? null);
    } finally {
      setPlanLoading(false);
    }
  }, [projectId, selectedCategory, planPayload]);

  const runEstimate = useCallback(
    async (mode: "single_slide" | "full_gallery") => {
      if (!projectId) return;
      setEstimating(true);
      try {
        const res = await fetch(`/api/product-card-projects/${projectId}/estimate/card-builder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: slides.length ? "saved" : "payload",
            payload: slides.length ? undefined : planPayload,
            mode,
          }),
        });
        const parsed = await readJsonSafe<{ credits?: number; error?: string }>(res);
        if (!parsed.ok) {
          setPlanError(parsed.message);
          return;
        }
        if (!res.ok) {
          setPlanError(parsed.data.error ?? "Оценка недоступна");
          return;
        }
        const c = parsed.data.credits ?? null;
        if (mode === "single_slide") setEstimateSingle(c);
        else setEstimateGallery(c);
      } finally {
        setEstimating(false);
      }
    },
    [projectId, planPayload, slides.length],
  );

  const pollGen = useCallback(async (generationId: string) => {
    for (let i = 0; i < IMAGE_GENERATION_POLL_MAX_ITERATIONS; i++) {
      const res = await fetch(`/api/generations/${generationId}`);
      const parsed = await readJsonSafe<{ status: string; outputFiles?: unknown }>(res);
      if (!parsed.ok || !res.ok) break;
      const st = parsed.data.status;
      if (st === "SUCCEEDED") {
        return getFirstOutputUrlFromJson(parsed.data.outputFiles) ?? null;
      }
      if (st === "FAILED" || st === "CANCELLED") break;
      await new Promise((r) => setTimeout(r, IMAGE_GENERATION_POLL_INTERVAL_MS));
    }
    return null;
  }, []);

  const syncPlanAndHistoryFromServer = useCallback(async () => {
    if (!projectId || !canUseBackend) return;
    const res = await fetch(`/api/product-card-projects/${projectId}`);
    const parsed = await readJsonSafe<{
      project?: {
        metadata?: {
          cardBuilder?: {
            galleryPlan?: GallerySlide[];
            generations?: unknown;
            settings?: Record<string, unknown>;
          };
        };
      };
    }>(res);
    if (!parsed.ok || !res.ok) return;
    const blk = parsed.data.project?.metadata?.cardBuilder;
    const list = blk?.galleryPlan;
    if (Array.isArray(list) && list.length) {
      setSlides(list as GallerySlide[]);
      setActiveSlideId((prev) => {
        if (prev && list.some((s: GallerySlide) => s.slideId === prev)) return prev;
        return (list[0] as GallerySlide).slideId;
      });
    }
    const rawGens = blk?.generations;
    if (Array.isArray(rawGens)) {
      const rows: CardBuilderGenHistoryRow[] = [];
      for (const x of rawGens) {
        if (!x || typeof x !== "object") continue;
        const r = x as Record<string, unknown>;
        const id = typeof r.generationId === "string" ? r.generationId.trim() : "";
        const slideId = typeof r.slideId === "string" ? r.slideId.trim() : "";
        if (!id || !slideId) continue;
        const row: CardBuilderGenHistoryRow = {
          generationId: id,
          slideId,
        };
        if (typeof r.imageRole === "string") row.imageRole = r.imageRole;
        if (typeof r.createdAt === "string") row.createdAt = r.createdAt;
        if (typeof r.status === "string") row.status = r.status;
        rows.push(row);
      }
      setGenHistory(rows);
    } else {
      setGenHistory([]);
    }

    const saved = blk?.settings;
    if (saved && typeof saved === "object") {
      const lm = saved.languageMode;
      if (typeof lm === "string" && lm.trim()) setLanguageMode(lm.trim());
      if (typeof saved.subtitle === "string") setSubtitle(saved.subtitle);
      if (typeof saved.dimensions === "string") setDimensionsUser(saved.dimensions);
    }
  }, [projectId, canUseBackend]);

  const changeSlideTemplate = useCallback(
    async (slideId: string, templateId: string) => {
      if (!projectId) return;
      setTplBusySlideId(slideId);
      setPlanError(null);
      try {
        const res = await fetch(
          `/api/product-card-projects/${projectId}/card-builder/slide-template`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slideId, templateId }),
          },
        );
        const parsed = await readJsonSafe<{
          galleryPlan?: GallerySlide[];
          error?: string;
          code?: string;
        }>(res);
        if (!parsed.ok) {
          setPlanError(parsed.message);
          return;
        }
        if (!res.ok) {
          setPlanError(parsed.data.error ?? "Не удалось сменить шаблон");
          return;
        }
        const list = parsed.data.galleryPlan;
        if (Array.isArray(list) && list.length) {
          setSlides(list);
        }
      } finally {
        setTplBusySlideId(null);
      }
    },
    [projectId],
  );

  const generateOne = useCallback(
    async (slideId: string) => {
      if (!projectId) return;
      setGenBusy(true);
      try {
        const res = await fetch(
          `/api/product-card-projects/${projectId}/generate/card-builder-slide`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slideId,
              useSavedPlan: true,
            }),
          },
        );
        const parsed = await readJsonSafe<{
          generationId?: string;
          error?: string;
          code?: string;
        }>(res);
        if (!parsed.ok) {
          setPlanError(parsed.message);
          return;
        }
        if (!res.ok) {
          setPlanError(parsed.data.error ?? "Не удалось запустить генерацию");
          return;
        }
        const gid = parsed.data.generationId;
        if (!gid) return;
        setSlideGen((prev) => ({
          ...prev,
          [slideId]: { status: "generating", url: prev[slideId]?.url ?? null },
        }));
        const url = await pollGen(gid);
        setSlideGen((prev) => ({
          ...prev,
          [slideId]: { status: url ? "done" : "error", url },
        }));
        await syncPlanAndHistoryFromServer();
      } finally {
        setGenBusy(false);
      }
    },
    [projectId, pollGen, syncPlanAndHistoryFromServer],
  );

  const generateAll = useCallback(async () => {
    if (!projectId) return;
    setBatchBusy(true);
    await runEstimate("full_gallery");
    try {
      const res = await fetch(`/api/product-card-projects/${projectId}/generate/card-builder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const parsed = await readJsonSafe<{
        totalCredits?: number;
        results?: { slideId?: string; generationId?: string; error?: string }[];
        error?: string;
        code?: string;
      }>(res);
      if (!parsed.ok) {
        setPlanError(parsed.message);
        return;
      }
      if (!res.ok) {
        setPlanError(parsed.data.error ?? "Пакетная генерация недоступна");
        return;
      }
      const rows = parsed.data.results ?? [];
      for (const row of rows) {
        if (!row.slideId) continue;
        if (row.generationId) {
          setSlideGen((p) => ({
            ...p,
            [row.slideId!]: { status: "generating", url: p[row.slideId!]?.url ?? null },
          }));
          const url = await pollGen(row.generationId);
          setSlideGen((p) => ({
            ...p,
            [row.slideId!]: { status: url ? "done" : "error", url },
          }));
        } else {
          setSlideGen((p) => ({
            ...p,
            [row.slideId!]: { status: "error", url: p[row.slideId!]?.url ?? null },
          }));
        }
      }
    } finally {
      setBatchBusy(false);
      await syncPlanAndHistoryFromServer();
    }
  }, [projectId, pollGen, runEstimate, syncPlanAndHistoryFromServer]);

  useEffect(() => {
    void Promise.resolve().then(() => syncPlanAndHistoryFromServer());
  }, [syncPlanAndHistoryFromServer]);

  if (!hasImage) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4">
        {!selectedCategory && (
          <Alert>
            <AlertTitle>Категория</AlertTitle>
            <AlertDescription>Сначала определите категорию товара выше.</AlertDescription>
          </Alert>
        )}

        {planError && (
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{planError}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertTitle>Текст на изображении</AlertTitle>
          <AlertDescription>
            AI встроит текст в дизайн. Мы просим AI сохранить русский и казахский текст точно, но иногда
            модель может исказить буквы. Проверяйте итог перед публикацией. Одна строка текста для слайда —
            не длиннее 60 символов; всего не больше 7 фраз (название, подзаголовок, теги, строки из поля
            дополнительного текста, размеры).
          </AlertDescription>
        </Alert>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Маркетплейс и задача</CardTitle>
            <CardDescription>Канал размещения и что нужно получить</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pc-marketplace">Маркетплейс / канал</Label>
              <select
                id="pc-marketplace"
                className={nativeFieldClass}
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value)}
              >
                {CARD_BUILDER_MARKETPLACES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-goal">Что создать</Label>
              <select
                id="pc-goal"
                className={nativeFieldClass}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              >
                {CARD_BUILDER_GOALS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Товар 1:1</CardTitle>
            <CardDescription>Сохранять исходный товар без искажений</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="pc-preserve"
                type="checkbox"
                checked={preserveProduct}
                onChange={(e) => setPreserveProduct(e.target.checked)}
                className="border-input accent-primary size-4 shrink-0 rounded border"
              />
              <Label htmlFor="pc-preserve">Сохранять товар без изменений</Label>
            </div>
            <div className="flex flex-wrap gap-2">
              {CARD_BUILDER_PRESERVE_ASPECTS.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={preserveAspects.includes(a.id)}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setPreserveAspects((prev) =>
                        on ? [...prev, a.id] : prev.filter((x) => x !== a.id),
                      );
                    }}
                    className="border-input accent-primary size-4 shrink-0 rounded border"
                  />
                  {a.label}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="pc-creative"
                type="checkbox"
                checked={creativeStyle}
                onChange={(e) => setCreativeStyle(e.target.checked)}
                className="border-input accent-primary size-4 shrink-0 rounded border"
              />
              <Label htmlFor="pc-creative">Разрешить креативную стилизацию</Label>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Преимущества и акценты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {CARD_BUILDER_BENEFIT_TAGS.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={benefitsSel.includes(b.id)}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setBenefitsSel((prev) =>
                        on ? [...prev, b.id] : prev.filter((x) => x !== b.id),
                      );
                    }}
                    className="border-input accent-primary size-4 shrink-0 rounded border"
                  />
                  {b.label}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Дополнительные преимущества</Label>
              <Textarea
                value={benefitsExtra}
                onChange={(e) => setBenefitsExtra(e.target.value)}
                rows={2}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-subtitle">Подзаголовок на карточке (необязательно)</Label>
              <Input
                id="pc-subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                maxLength={300}
                className="rounded-xl"
                placeholder="Короткая подпись"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-dimensions">Размеры / характеристики для слайда (необязательно)</Label>
              <Textarea
                id="pc-dimensions"
                value={dimensionsUser}
                onChange={(e) => setDimensionsUser(e.target.value)}
                rows={2}
                maxLength={500}
                className="rounded-xl"
                placeholder="Только то, что можно показать; не выдумывайте цифры"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-lang">Язык текста для подсказок модели</Label>
              <select
                id="pc-lang"
                className={nativeFieldClass}
                value={languageMode}
                onChange={(e) => setLanguageMode(e.target.value)}
              >
                {CARD_BUILDER_LANGUAGE_MODES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Что обязательно показать</Label>
              <div className="flex flex-wrap gap-2">
                {CARD_BUILDER_MUST_SHOW.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={mustSel.includes(m.id)}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setMustSel((prev) =>
                          on ? [...prev, m.id] : prev.filter((x) => x !== m.id),
                        );
                      }}
                      className="border-input accent-primary size-4 shrink-0 rounded border"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-base">Аудитория и стиль</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pc-audience">Для кого товар</Label>
              <select
                id="pc-audience"
                className={nativeFieldClass}
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                {CARD_BUILDER_AUDIENCES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-price-segment">Ценовой сегмент</Label>
              <select
                id="pc-price-segment"
                className={nativeFieldClass}
                value={priceSegment}
                onChange={(e) => setPriceSegment(e.target.value)}
              >
                {CARD_BUILDER_PRICE_SEGMENTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-sales-style">Стиль продаж</Label>
              <select
                id="pc-sales-style"
                className={nativeFieldClass}
                value={salesStyle}
                onChange={(e) => setSalesStyle(e.target.value)}
              >
                {CARD_BUILDER_SALES_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-text-density">Текст на изображении</Label>
              <select
                id="pc-text-density"
                className={nativeFieldClass}
                value={textDensity}
                onChange={(e) => setTextDensity(e.target.value)}
              >
                {CARD_BUILDER_TEXT_DENSITY.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-xl"
            disabled={!canWork || planLoading}
            onClick={() => void runPlan()}
          >
            {planLoading ? "Сохранение…" : "Сгенерировать структуру"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={!canWork || estimating}
            onClick={() => void runEstimate("single_slide")}
          >
            Оценить один слайд
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={!canWork || estimating || slides.length === 0}
            onClick={() => void runEstimate("full_gallery")}
          >
            Оценить всю галерею
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {estimateSingle != null && (
            <span className="tabular-nums">Один слайд ≈ {estimateSingle} ток.</span>
          )}
          {estimateGallery != null && slides.length > 1 && (
            <span className="tabular-nums">Вся галерея ≈ {estimateGallery} ток.</span>
          )}
          <span className="tabular-nums text-foreground">
            Баланс: {balanceCredits}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-xl"
            disabled={!canWork || !activeSlideId || batchBusy || genBusy}
            onClick={() => activeSlideId && void generateOne(activeSlideId)}
          >
            {genBusy ? "Запуск…" : "Сгенерировать выбранный слайд"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            disabled={!canWork || slides.length === 0 || batchBusy || genBusy}
            onClick={() => void generateAll()}
          >
            {batchBusy ? "Генерация галереи…" : "Сгенерировать все слайды"}
          </Button>
        </div>

        {genHistory.length ? (
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base">Создать карточку — ранее в проекте</CardTitle>
              <CardDescription>Отдельно от карточки маркетплейса и других сценариев</CardDescription>
            </CardHeader>
            <CardContent className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {[...genHistory].reverse().map((g) => {
                const title =
                  slides.find((s) => s.slideId === g.slideId)?.title ?? g.slideId.replace(/_/g, " ");
                return (
                  <div
                    key={`${g.generationId}-${g.createdAt ?? ""}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">{title}</div>
                      <div className="text-muted-foreground text-xs">
                        {g.createdAt
                          ? new Date(g.createdAt).toLocaleString("ru-RU", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                        {g.status ? ` · ${g.status}` : ""}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/history/${g.generationId}`}
                      className="text-primary text-xs font-medium underline"
                    >
                      Открыть
                    </Link>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-24 space-y-3">
        <Card className="rounded-2xl border-primary/30 bg-gradient-to-b from-[#e8f8fb] to-white">
          <CardHeader>
            <CardTitle className="text-base">Предпросмотр галереи</CardTitle>
            <CardDescription>Порядок и статус слайдов</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {slides.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                После нажатия «Сгенерировать структуру» здесь появится план из 6–8 кадров.
              </p>
            ) : (
              slides.map((s) => {
                const st = slideGen[s.slideId]?.status ?? "не сгенерировано";
                const url = slideGen[s.slideId]?.url;
                const active = activeSlideId === s.slideId;
                const tplOptions = listTemplatesForSlideRole(s.imageRole as CardBuilderTemplateSlideRole);
                const tplBusy = tplBusySlideId === s.slideId;
                return (
                  <div
                    key={s.slideId}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveSlideId(s.slideId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setActiveSlideId(s.slideId);
                    }}
                    className={cn(
                      "cursor-pointer rounded-xl border p-3 transition-colors",
                      active ? "border-primary bg-primary/5" : "border-border bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm">{s.title}</div>
                        {s.previewCaption ? (
                          <div className="text-muted-foreground mt-0.5 text-xs leading-snug">
                            {s.previewCaption}
                          </div>
                        ) : null}
                        <div className="text-muted-foreground mt-1 text-[11px] capitalize">
                          Статус: {st}
                        </div>
                        <div className="mt-2 space-y-1">
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
                              void changeSlideTemplate(s.slideId, v);
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
                          void generateOne(s.slideId);
                        }}
                      >
                        Сгенерировать
                      </Button>
                    </div>
                    {url ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="max-h-40 rounded-lg border object-contain" />
                        <a href={url} download className="text-primary text-xs underline">
                          Скачать
                        </a>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
