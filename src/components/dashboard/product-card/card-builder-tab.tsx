"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CARD_BUILDER_AUDIENCES,
  CARD_BUILDER_BENEFIT_TAGS,
  CARD_BUILDER_GOALS,
  CARD_BUILDER_MARKETPLACES,
  CARD_BUILDER_MUST_SHOW,
  CARD_BUILDER_PRESERVE_ASPECTS,
  CARD_BUILDER_PRICE_SEGMENTS,
  CARD_BUILDER_SALES_STYLES,
  CARD_BUILDER_TEXT_DENSITY,
} from "@/config/card-builder-presets";
import type { ProductCategoryId } from "@/config/product-card-categories";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import { getFirstOutputUrlFromJson } from "@/lib/product-card-output";
import {
  IMAGE_GENERATION_POLL_INTERVAL_MS,
  IMAGE_GENERATION_POLL_MAX_ITERATIONS,
} from "@/lib/generation-client-polling";
import { cn } from "@/lib/utils";

const SELECT_BASE =
  "border-input w-full max-w-md rounded-xl border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm";

const PREVIEW_PLACEHOLDER = [
  { title: "Главное фото", purpose: "Первый экран галереи" },
  { title: "Преимущества", purpose: "Ключевые УТП" },
  { title: "Материалы", purpose: "Фактура и состав" },
  { title: "Размеры", purpose: "Масштаб и пропорции" },
  { title: "Lifestyle", purpose: "Товар в контексте" },
  { title: "Постер", purpose: "Премиальный кадр" },
] as const;

type SlideRow = {
  slideId?: string;
  title: string;
  purpose?: string;
  imageRole?: string;
};

type GenPeek = {
  generationId?: string | null;
  status: string;
  outputUrl: string | null;
};

function terminal(status: string): boolean {
  return ["COMPLETED", "FAILED", "REFUNDED", "CANCELLED", "BLOCKED"].includes(status);
}

function coerceCredits(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

type Props = {
  selectedCategory: ProductCategoryId | null;
  hasImage: boolean;
  canUseBackend: boolean;
  projectId: string | null;
  balanceCredits: number;
  reloadProject?: () => Promise<boolean>;
};

export function CardBuilderTab({
  selectedCategory,
  hasImage,
  canUseBackend,
  projectId,
  balanceCredits,
  reloadProject,
}: Props) {
  const [marketplace, setMarketplace] = useState<string>(CARD_BUILDER_MARKETPLACES[5]!.id);
  const [goal, setGoal] = useState<string>(CARD_BUILDER_GOALS[8]!.id);
  const [preserveProduct, setPreserveProduct] = useState(true);
  const [preserveAspects, setPreserveAspects] = useState<
    Partial<Record<(typeof CARD_BUILDER_PRESERVE_ASPECTS)[number], boolean>>
  >({
    shape: true,
    color: true,
    proportions: true,
  });
  const [allowCreativeStyle, setAllowCreativeStyle] = useState(false);
  const [benefitTagsSelected, setBenefitTagsSelected] = useState<Record<string, boolean>>({});
  const [benefitsExtra, setBenefitsExtra] = useState("");
  const [mustShowSelected, setMustShowSelected] = useState<Record<string, boolean>>({});
  const [audience, setAudience] = useState<string>("");
  const [priceSegment, setPriceSegment] = useState<string>("");
  const [salesStyle, setSalesStyle] = useState<string>("light_marketplace");
  const [textDensity, setTextDensity] = useState<string>("medium");

  const [structureSlides, setStructureSlides] = useState<SlideRow[]>(() => [...PREVIEW_PLACEHOLDER]);
  const [genBySlide, setGenBySlide] = useState<Record<string, GenPeek>>({});
  const [planSaving, setPlanSaving] = useState(false);
  const [galleryEst, setGalleryEst] = useState<number | null>(null);
  const [slideEst, setSlideEst] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const balanceNum = coerceCredits(balanceCredits) ?? 0;
  const isFullGalleryGoal = goal === "full_gallery_6" || goal === "full_gallery_8";

  const bodyBase = useMemo(
    () => ({
      marketplace,
      goal,
      preserveProduct,
      preserveAspects: (CARD_BUILDER_PRESERVE_ASPECTS as readonly string[]).filter((k) =>
        Boolean(preserveAspects[k as keyof typeof preserveAspects]),
      ),
      allowCreativeStyle,
      benefitsTags: Object.entries(benefitTagsSelected)
        .filter(([, v]) => v)
        .map(([k]) => k),
      benefitsExtra: benefitsExtra.trim(),
      mustShow: Object.entries(mustShowSelected)
        .filter(([, v]) => v)
        .map(([k]) => k),
      audience: audience || null,
      priceSegment: priceSegment || null,
      salesStyle,
      textDensity,
    }),
    [
      marketplace,
      goal,
      preserveProduct,
      preserveAspects,
      allowCreativeStyle,
      benefitTagsSelected,
      benefitsExtra,
      mustShowSelected,
      audience,
      priceSegment,
      salesStyle,
      textDensity,
    ],
  );

  const loadCardBuilderStructure = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`/api/product-card-projects/${projectId}`);
    const parsed = await readJsonSafe<{
      project?: { metadata?: { cardBuilder?: { galleryPlan?: unknown } } };
    }>(res);
    if (!parsed.ok || !res.ok) return;
    const plan = parsed.data.project?.metadata?.cardBuilder?.galleryPlan;
    if (!Array.isArray(plan) || plan.length === 0) {
      setStructureSlides([...PREVIEW_PLACEHOLDER]);
      return;
    }
    const rows = plan.flatMap((x): SlideRow[] => {
      if (!x || typeof x !== "object") return [];
      const o = x as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title : "";
      const purpose = typeof o.purpose === "string" ? o.purpose : "";
      const slideId = typeof o.slideId === "string" ? o.slideId : undefined;
      const imageRole = typeof o.imageRole === "string" ? o.imageRole : undefined;
      if (!title && !slideId) return [];
      return [{ slideId, title: title || slideId || "Слайд", purpose, imageRole }];
    });
    setStructureSlides(rows.length > 0 ? rows : [...PREVIEW_PLACEHOLDER]);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !canUseBackend) return;
    void loadCardBuilderStructure();
  }, [canUseBackend, loadCardBuilderStructure, projectId]);

  const refresh = useCallback(async () => {
    await loadCardBuilderStructure();
    if (reloadProject) await reloadProject();
  }, [loadCardBuilderStructure, reloadProject]);

  const fetchGenerationPeek = useCallback(async (generationId: string): Promise<GenPeek> => {
    const res = await fetch(`/api/generations/${generationId}`);
    const parsed = await readJsonSafe<{ status?: string; outputFiles?: unknown }>(res);
    if (!parsed.ok || !res.ok) {
      return { status: "UNKNOWN", outputUrl: null };
    }
    const status = typeof parsed.data.status === "string" ? parsed.data.status : "UNKNOWN";
    const outputUrl = getFirstOutputUrlFromJson(parsed.data.outputFiles);
    return { status, outputUrl };
  }, []);

  const pollUntilDone = useCallback(
    async (generationId: string, slideKey: string) => {
      for (let i = 0; i < IMAGE_GENERATION_POLL_MAX_ITERATIONS; i++) {
        const peek = await fetchGenerationPeek(generationId);
        setGenBySlide((prev) => ({
          ...prev,
          [slideKey]: { generationId, status: peek.status, outputUrl: peek.outputUrl },
        }));
        if (terminal(peek.status) && (peek.status !== "COMPLETED" || peek.outputUrl)) break;
        if (i < IMAGE_GENERATION_POLL_MAX_ITERATIONS - 1) {
          await new Promise((r) => setTimeout(r, IMAGE_GENERATION_POLL_INTERVAL_MS));
        }
      }
    },
    [fetchGenerationPeek],
  );

  const runEstimateHints = useCallback(async () => {
    if (!projectId) return;
    setEstimating(true);
    setMessage(null);
    try {
      const slideRes = await fetch(`/api/product-card-projects/${projectId}/estimate/card-builder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "slide",
          salesStyle,
          textDensity,
        }),
      });

      const sParsed = await readJsonSafe<{ credits?: unknown; error?: string }>(slideRes);
      if (!slideRes.ok || !sParsed.ok) {
        setSlideEst(null);
      } else {
        setSlideEst(coerceCredits(sParsed.data.credits));
      }

      if (isFullGalleryGoal) {
        const gallRes = await fetch(`/api/product-card-projects/${projectId}/estimate/card-builder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: goal === "full_gallery_8" ? "gallery_8" : "gallery_6",
            salesStyle,
            textDensity,
          }),
        });
        const gParsed = await readJsonSafe<{ credits?: unknown }>(gallRes);
        if (!gallRes.ok || !gParsed.ok) {
          setGalleryEst(null);
        } else {
          setGalleryEst(coerceCredits(gParsed.data.credits));
        }
      } else {
        setGalleryEst(null);
      }
    } finally {
      setEstimating(false);
    }
  }, [goal, isFullGalleryGoal, projectId, salesStyle, textDensity]);

  useEffect(() => {
    if (!projectId || !canUseBackend) return;
    void runEstimateHints();
  }, [canUseBackend, projectId, runEstimateHints]);

  async function saveStructure() {
    if (!projectId || !selectedCategory) {
      setMessage("Нужно фото и выбранная категория.");
      return;
    }
    setPlanSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/product-card-projects/${projectId}/card-builder/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyBase),
      });
      const parsed = await readJsonSafe<{ slides?: unknown[]; error?: string }>(res);
      if (!parsed.ok) {
        setMessage(parsed.message);
        return;
      }
      if (!res.ok) {
        setMessage(parsed.data.error ?? "Не удалось сохранить структуру");
        return;
      }
      const next = parsed.data.slides;
      if (Array.isArray(next) && next.length > 0) {
        setStructureSlides(
          next.map((s) =>
            typeof s === "object" && s !== null
              ? {
                  slideId: typeof (s as { slideId?: string }).slideId === "string"
                    ? (s as { slideId: string }).slideId
                    : undefined,
                  title:
                    typeof (s as { title?: string }).title === "string"
                      ? (s as { title: string }).title
                      : "",
                  purpose:
                    typeof (s as { purpose?: string }).purpose === "string"
                      ? (s as { purpose: string }).purpose
                      : "",
                  imageRole:
                    typeof (s as { imageRole?: string }).imageRole === "string"
                      ? (s as { imageRole: string }).imageRole
                      : "",
                }
              : { title: "Слайд" },
          ),
        );
      }
      toast.success("Структура карточки сохранена");
      await runEstimateHints();
      await refresh();
    } finally {
      setPlanSaving(false);
    }
  }

  async function generateSlide(slide: SlideRow) {
    const key = slide.slideId ?? slide.title;
    if (!projectId || !slide.slideId) {
      setMessage("Обновите структуру — у слайда нет номера.");
      return;
    }
    setBusy(key);
    setMessage(null);
    try {
      if (slideEst == null) await runEstimateHints();
      const res = await fetch(`/api/product-card-projects/${projectId}/generate/card-builder-slide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideId: slide.slideId, clientEstimateCredits: slideEst }),
      });
      const parsed = await readJsonSafe<{
        generationId?: string;
        code?: string;
        error?: string;
      }>(res);
      if (!parsed.ok) {
        setMessage(parsed.message);
        return;
      }
      if (!res.ok) {
        if (parsed.data.code === "PRICE_CHANGED") {
          await runEstimateHints();
        }
        setMessage(parsed.data.error ?? "Не удалось запустить генерацию");
        return;
      }
      const gid = parsed.data.generationId;
      if (gid) {
        setGenBySlide((prev) => ({
          ...prev,
          [key]: { generationId: gid, status: "QUEUED", outputUrl: null },
        }));
        void pollUntilDone(gid, key);
      }
    } finally {
      setBusy(null);
    }
  }

  async function generateWholeGallery() {
    if (!projectId || !isFullGalleryGoal) return;
    setBusy("gallery");
    setMessage(null);
    try {
      if (galleryEst == null) await runEstimateHints();
      const res = await fetch(`/api/product-card-projects/${projectId}/generate/card-builder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientEstimateCredits: galleryEst }),
      });
      const parsed = await readJsonSafe<{
        generationIds?: string[];
        code?: string;
        error?: string;
      }>(res);
      if (!parsed.ok) {
        setMessage(parsed.message);
        return;
      }
      if (!res.ok) {
        if (parsed.data.code === "PRICE_CHANGED") {
          await runEstimateHints();
        }
        setMessage(parsed.data.error ?? "Не удалось запустить галерею");
        return;
      }
      const ids = parsed.data.generationIds ?? [];
      const keyedSlides = structureSlides.filter((s) => s.slideId);
      ids.forEach((gid, idx) => {
        const slide = keyedSlides[idx];
        if (!slide?.slideId) return;
        const key = slide.slideId;
        setGenBySlide((prev) => ({
          ...prev,
          [key]: { generationId: gid, status: "QUEUED", outputUrl: null },
        }));
        void pollUntilDone(gid, key);
      });
    } finally {
      setBusy(null);
    }
  }

  const canPlan = Boolean(projectId && canUseBackend && hasImage && selectedCategory);

  const ruAspect: Record<string, string> = {
    shape: "форма",
    color: "цвет",
    logo: "логотип",
    proportions: "пропорции",
    material: "материал",
    packaging: "упаковка",
    details: "детали",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
      <div className="space-y-6">
        {!hasImage ? (
          <Alert>
            <AlertTitle>Сначала фото товара</AlertTitle>
            <AlertDescription>Загрузите изображение, чтобы открыть мастер галереи.</AlertDescription>
          </Alert>
        ) : null}
        {!selectedCategory && hasImage ? (
          <Alert>
            <AlertTitle>Категория</AlertTitle>
            <AlertDescription>Уточните категорию товара — по ней строится подсказка для визуала.</AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-3">
          <Label className="text-base font-medium">Где будет размещаться витрина</Label>
          <select
            className={SELECT_BASE}
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
          >
            {CARD_BUILDER_MARKETPLACES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </section>

        <section className="space-y-3">
          <Label className="text-base font-medium">Что нужно создать</Label>
          <select className={SELECT_BASE} value={goal} onChange={(e) => setGoal(e.target.value)}>
            {CARD_BUILDER_GOALS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-base font-medium">Сохранять товар 1:1</Label>
            <Button
              type="button"
              variant={preserveProduct ? "default" : "outline"}
              size="sm"
              onClick={() => setPreserveProduct((v) => !v)}
            >
              {preserveProduct ? "Да — без искажений" : "Выключено"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Дополнительно уточните, что сохранять. При включении «разрешить креатив» допускается лёгкая
            стилизация.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(CARD_BUILDER_PRESERVE_ASPECTS as readonly string[]).map((idRaw) => {
              const key = idRaw as keyof typeof preserveAspects;
              return (
                <label key={idRaw} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="border-input size-4 rounded border"
                    checked={Boolean(preserveAspects[key])}
                    disabled={!preserveProduct}
                    onChange={(e) =>
                      setPreserveAspects((p) => ({ ...p, [key]: e.target.checked }))
                    }
                  />
                  {ruAspect[idRaw] ?? idRaw}
                </label>
              );
            })}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="border-input size-4 rounded border"
              checked={allowCreativeStyle}
              onChange={(e) => setAllowCreativeStyle(e.target.checked)}
            />
            Разрешить креативную стилизацию
          </label>
        </section>

        <section className="space-y-2 rounded-xl border border-border bg-white p-4">
          <Label className="text-base font-medium">Ключевые преимущества</Label>
          <div className="flex flex-wrap gap-2">
            {CARD_BUILDER_BENEFIT_TAGS.map((b) => (
              <Button
                key={b.id}
                type="button"
                variant={benefitTagsSelected[b.id] ? "default" : "outline"}
                size="sm"
                className="rounded-full text-xs"
                onClick={() =>
                  setBenefitTagsSelected((p) => ({ ...p, [b.id]: !p[b.id] }))
                }
              >
                {b.label}
              </Button>
            ))}
          </div>
          <Textarea
            value={benefitsExtra}
            onChange={(e) => setBenefitsExtra(e.target.value)}
            placeholder="Дополнительные преимущества"
            rows={3}
          />
        </section>

        <section className="space-y-2 rounded-xl border border-border bg-white p-4">
          <Label className="text-base font-medium">Что обязательно показать</Label>
          <div className="flex flex-wrap gap-2">
            {CARD_BUILDER_MUST_SHOW.map((x) => (
              <Button
                key={x.id}
                type="button"
                variant={mustShowSelected[x.id] ? "default" : "outline"}
                size="sm"
                className="rounded-full text-xs"
                onClick={() =>
                  setMustShowSelected((p) => ({ ...p, [x.id]: !p[x.id] }))
                }
              >
                {x.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Для кого товар</Label>
            <select
              className={SELECT_BASE}
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="">Не задано</option>
              {CARD_BUILDER_AUDIENCES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Ценовой сегмент</Label>
            <select
              className={SELECT_BASE}
              value={priceSegment}
              onChange={(e) => setPriceSegment(e.target.value)}
            >
              <option value="">Не задано</option>
              {CARD_BUILDER_PRICE_SEGMENTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Стиль продаж</Label>
            <select
              className={SELECT_BASE}
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
            <Label>Текст на изображении</Label>
            <select
              className={SELECT_BASE}
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
        </section>

        {message ? (
          <Alert variant="destructive">
            <AlertTitle>Внимание</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canPlan || planSaving || !selectedCategory}
            onClick={() => void saveStructure()}
          >
            {planSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение…
              </>
            ) : (
              <>Сгенерировать структуру карточки</>
            )}
          </Button>
          {isFullGalleryGoal ? (
            <Button
              type="button"
              disabled={
                !canPlan ||
                busy === "gallery" ||
                galleryEst == null ||
                estimating ||
                !structureSlides.some((s) => s.slideId)
              }
              onClick={() => void generateWholeGallery()}
            >
              {busy === "gallery" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Сгенерировать все слайды
              {galleryEst != null ? (
                <span className="text-muted-foreground ml-2 text-xs">({galleryEst} ток.)</span>
              ) : estimating ? (
                <span className="text-muted-foreground ml-2 text-xs">…оценка</span>
              ) : null}
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          Баланс: <span className="text-foreground font-medium">{balanceNum}</span> · отдельные слайды:{" "}
          {slideEst != null ? (
            <>
              около <span className="font-medium">{slideEst}</span> ток.
            </>
          ) : estimating ? (
            "оцениваем…"
          ) : (
            "нажмите «структура» после выбора настроек"
          )}
          .
        </p>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="size-4" aria-hidden />
              Предпросмотр структуры
            </div>
            <ul className="space-y-3">
              {structureSlides.map((slide, idx) => {
                const sk = slide.slideId ?? `${idx}`;
                const g = slide.slideId ? genBySlide[slide.slideId] : genBySlide[sk];
                const statusHuman = !slide.slideId
                  ? "черновик"
                  : g == null
                    ? "не сгенерировано"
                    : g.status === "QUEUED" || g.status === "PROCESSING"
                      ? "генерируется"
                      : g.status === "COMPLETED"
                        ? "готово"
                        : g.status === "FAILED"
                          ? "ошибка"
                          : "в работе";

                return (
                  <li
                    key={`${slide.title}-${idx}`}
                    className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/15 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums">
                        {(idx + 1).toString().padStart(2, "0")}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium leading-snug">{slide.title}</p>
                        {slide.purpose ? (
                          <p className="text-muted-foreground text-xs">{slide.purpose}</p>
                        ) : null}
                        <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
                          <span className={cn("rounded-full border px-2 py-0.5")}>{statusHuman}</span>
                          {slideEst != null && slide.slideId ? (
                            <span className="tabular-nums">{slideEst} ток.</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {slide.slideId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 text-xs"
                          disabled={!canPlan || busy === slide.slideId || !selectedCategory}
                          onClick={() => void generateSlide(slide)}
                        >
                          Сгенерировать
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        disabled={!canPlan || planSaving || !selectedCategory}
                        onClick={() => void saveStructure()}
                      >
                        Изменить
                      </Button>
                      {g?.generationId ? (
                        <a
                          className="border-border text-foreground hover:bg-muted inline-flex h-8 items-center rounded-lg border px-2 text-xs"
                          href={`/dashboard/history/${g.generationId}`}
                        >
                          История
                        </a>
                      ) : null}
                      {g?.outputUrl ? (
                        <a
                          className="border-border text-foreground hover:bg-muted inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs"
                          href={g.outputUrl}
                          download
                        >
                          <Download className="size-3.5" aria-hidden /> Скачать
                        </a>
                      ) : null}
                      {slide.slideId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          disabled={busy === slide.slideId || !canPlan || !slide.slideId || !selectedCategory}
                          onClick={() => void generateSlide(slide)}
                        >
                          <RefreshCw className="mr-1 size-3.5" aria-hidden />
                          Ещё раз
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="outline" disabled className="h-8 text-xs">
                        Вариант B — скоро
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled className="h-8 text-xs">
                        Убрать текст — скоро
                      </Button>
                    </div>
                    {g?.outputUrl ? (
                      <div className="mt-3 overflow-hidden rounded-md border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={g.outputUrl}
                          alt=""
                          className="h-40 w-full object-cover sm:h-48"
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {!isFullGalleryGoal ? (
              <p className="text-muted-foreground text-[11px] leading-snug">
                Для массового запуска выберите цель «Полная галерея 6/8», затем кнопка «Сгенерировать все» появится
                слева.
              </p>
            ) : (
              <p className="text-muted-foreground text-[11px] leading-snug">
                Полная галерея запускается после сохранённой структуры из 6 или 8 кадров.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
          <p>Вариант B, правки текста и подготовка к ролику появятся в следующих версиях.</p>
        </div>
      </aside>
    </div>
  );
}
