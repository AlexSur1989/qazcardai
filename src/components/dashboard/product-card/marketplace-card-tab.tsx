"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, LayoutList, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getPublicMarketplaceCardStyles,
  type MarketplaceCardStyle,
} from "@/config/product-card-categories";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import { getFirstOutputUrlFromJson } from "@/lib/product-card-output";
import { cn } from "@/lib/utils";

const styles = getPublicMarketplaceCardStyles();

type ConceptGenMeta = {
  generationId: string;
  categoryId?: string;
  conceptId?: string;
  createdAt?: string;
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
};

export function MarketplaceCardTab({
  hasImage,
  canUseBackend,
  projectId,
  balanceCredits,
  cardSizePresets,
}: Props) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<"original" | "concept_generation">("original");
  const [sourceGenerationId, setSourceGenerationId] = useState<string | null>(null);
  const [conceptRows, setConceptRows] = useState<ConceptGenMeta[]>([]);
  const [genPreviews, setGenPreviews] = useState<Record<string, GenPreview | undefined>>({});

  const [title, setTitle] = useState("");
  const [benefits, setBenefits] = useState("");
  const [extraText, setExtraText] = useState("");
  const [userInstructions, setUserInstructions] = useState("");
  const [style, setStyle] = useState<MarketplaceCardStyle>(styles[0]!.id);
  const [cardSize, setCardSize] = useState(cardSizePresets[0]?.id ?? "square");
  const [overlayTemplate, setOverlayTemplate] = useState("bottom_panel");

  const [estimating, setEstimating] = useState(false);
  const [estimateCredits, setEstimateCredits] = useState<number | null>(null);
  const [estErr, setEstErr] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    generationId: string;
    status: string;
    costCredits: number;
    outputUrl: string | null;
  } | null>(null);
  const [overlayPreview, setOverlayPreview] = useState<{
    svg: string;
    width: number;
    height: number;
    label: string;
  } | null>(null);

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
    const parsed = await readJsonSafe<{
      project?: { metadata?: { conceptGenerations?: unknown } };
    }>(res);
    if (!parsed.ok || !res.ok) {
      return;
    }
    const list = parsed.data.project?.metadata?.conceptGenerations;
    const rows: ConceptGenMeta[] = Array.isArray(list)
      ? list
          .map((x) => {
            if (x && typeof x === "object" && "generationId" in x) {
              const g = (x as { generationId: unknown }).generationId;
              if (typeof g === "string" && g.trim()) {
                return { generationId: g.trim() } as ConceptGenMeta;
              }
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
      await loadProjectMeta();
    })();
  }, [projectId, canUseBackend, loadProjectMeta]);

  useEffect(() => {
    if (conceptRows.length === 0) {
      void (async () => {
        await Promise.resolve();
        if (sourceType === "concept_generation") {
          setSourceType("original");
          setSourceGenerationId(null);
        }
      })();
      return;
    }
    void (async () => {
      const next: Record<string, GenPreview> = {};
      for (const r of conceptRows) {
        const res = await fetch(`/api/generations/${r.generationId}`);
        const p = await readJsonSafe<{
          status: string;
          outputFiles: unknown;
        }>(res);
        if (p.ok && res.ok) {
          next[r.generationId] = {
            id: r.generationId,
            status: p.data.status,
            outputUrl: getFirstOutputUrlFromJson(p.data.outputFiles),
          };
        }
      }
      setGenPreviews((prev) => ({ ...prev, ...next }));
    })();
  }, [conceptRows, sourceType]);

  useEffect(() => {
    if (!canEstimate) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setEstimating(true);
      setEstErr(null);
      const res = await fetch(
        `/api/product-card-projects/${projectId}/estimate/marketplace-card`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType,
            sourceGenerationId: sourceType === "original" ? null : sourceGenerationId,
            style,
            cardSize,
            overlayTemplate,
          }),
        },
      );
      const parsed = await readJsonSafe<{ credits?: number; error?: string }>(res);
      if (cancelled) return;
      if (!parsed.ok) {
        setEstErr(parsed.message);
        setEstimateCredits(null);
        setEstimating(false);
        return;
      }
      if (!res.ok) {
        setEstErr(parsed.data.error ?? "Оценка недоступна");
        setEstimateCredits(null);
        setEstimating(false);
        return;
      }
      setEstimateCredits(
        typeof parsed.data.credits === "number" ? parsed.data.credits : null,
      );
      setEstimating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [canEstimate, projectId, sourceType, sourceGenerationId, style, cardSize, overlayTemplate]);

  useEffect(() => {
    if (sourceType !== "concept_generation" || !conceptRows.length) return;
    const firstId = conceptRows[0]?.generationId;
    if (!firstId) return;
    void (async () => {
      await Promise.resolve();
      if (!sourceGenerationId || !conceptRows.some((r) => r.generationId === sourceGenerationId)) {
        setSourceGenerationId(firstId);
      }
    })();
  }, [sourceType, conceptRows, sourceGenerationId]);

  useEffect(() => {
    if (!projectId || !canUseBackend) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await fetch(
          `/api/product-card-projects/${projectId}/preview/marketplace-card`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productTitle: title,
              benefits,
              extraText,
              style,
              cardSize,
              overlayTemplate,
            }),
          },
        );
        const parsed = await readJsonSafe<{
          svg?: string;
          size?: { width?: number; height?: number; label?: string };
        }>(res);
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
  }, [projectId, canUseBackend, title, benefits, extraText, style, cardSize, overlayTemplate]);

  const showEstimate = canEstimate;
  const creditsToShow = showEstimate ? estimateCredits : null;
  const errToShow = showEstimate ? estErr : null;
  const notEnough = creditsToShow != null && balanceCredits < creditsToShow;
  const canSubmit =
    showEstimate && !estimating && creditsToShow != null && !errToShow && !notEnough;

  const onSubmit = async () => {
    if (!projectId || !canUseBackend) return;
    setGenError(null);
    setResult(null);
    setGenerating(true);
    const benefitsList = benefits
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    try {
      const body: Record<string, unknown> = {
        sourceType,
        sourceGenerationId:
          sourceType === "original" ? null : sourceGenerationId,
        productTitle: title.trim(),
        benefits: benefitsList.length > 0 ? benefitsList : benefits.trim() || "",
        extraText: extraText.trim(),
        style,
        cardSize,
        overlayTemplate,
        userInstructions: userInstructions.trim(),
      };
      if (typeof estimateCredits === "number" && Number.isFinite(estimateCredits)) {
        body.clientEstimateCredits = estimateCredits;
      }
      const res = await fetch(
        `/api/product-card-projects/${projectId}/generate/marketplace-card`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const parsed = await readJsonSafe<{
        generationId?: string;
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
      if (res.status === 402) {
        setGenError(parsed.data.error ?? "Недостаточно кредитов");
        return;
      }
      if (res.status === 409 && parsed.data.code === "PRICE_CHANGED") {
        setGenError(
          (parsed.data.error as string) ??
            "Стоимость изменилась — дождитесь обновления оценки и попробуйте снова",
        );
        setEstimateCredits(null);
        return;
      }
      if (!res.ok) {
        const d = parsed.data;
        const detail =
          typeof d.reason === "string" && d.reason.trim() !== "" ? ` — ${d.reason}` : "";
        setGenError((d.error ?? "Ошибка") + detail);
        return;
      }
      const d = parsed.data;
      const genId = d.generationId;
      if (!genId) {
        setGenError("Нет generationId");
        return;
      }
      let st = d.status ?? "QUEUED";
      let outputUrl: string | null = null;
      const terminal = new Set(["COMPLETED", "FAILED", "REFUNDED", "CANCELLED", "BLOCKED"]);
      for (let i = 0; i < 24; i++) {
        const gRes = await fetch(`/api/generations/${genId}`);
        const p = await readJsonSafe<{ status: string; outputFiles: unknown }>(gRes);
        if (p.ok && gRes.ok) {
          st = p.data.status;
          outputUrl = getFirstOutputUrlFromJson(p.data.outputFiles) ?? outputUrl;
        }
        if (terminal.has(st) && (st !== "COMPLETED" || outputUrl)) break;
        if (i < 23) await new Promise((r) => setTimeout(r, 1500));
      }
      setResult({
        generationId: genId,
        status: st,
        costCredits: typeof d.costCredits === "number" ? d.costCredits : 0,
        outputUrl,
      });
      void loadProjectMeta();
      router.refresh();
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
          AI создаёт визуальную основу, а QazCard AI накладывает текст отдельно, чтобы подписи были чёткими.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canUseBackend && (
          <div className="space-y-3">
            <Label className="text-[#0C2D38]">Источник изображения</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={sourceType === "original" ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => {
                  setSourceType("original");
                  setSourceGenerationId(null);
                }}
              >
                Исходные фото
              </Button>
              {conceptRows.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant={sourceType === "concept_generation" ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setSourceType("concept_generation")}
                >
                  Сгенерированное фото
                </Button>
              )}
            </div>
            {conceptRows.length === 0 && (
              <p className="text-xs text-[#4a6e7a]">
                Сначала создайте AI-фото во вкладке «Фото с концепциями».
              </p>
            )}
            {sourceType === "concept_generation" && conceptRows.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {conceptRows.map((r) => {
                  const pr = genPreviews[r.generationId];
                  return (
                    <button
                      key={r.generationId}
                      type="button"
                      onClick={() => setSourceGenerationId(r.generationId)}
                      className={cn(
                        "rounded-2xl border-2 p-2 text-left text-xs transition-colors",
                        sourceGenerationId === r.generationId
                          ? "border-[#00AFCA] bg-[#F4FBFD]"
                          : "border-[#B8DCE6] bg-white hover:border-[#00AFCA]/45",
                      )}
                    >
                      <p className="break-all font-mono text-[#4a6e7a]">
                        {r.generationId.slice(0, 12)}…
                      </p>
                      {pr && (
                        <p className="mt-1 text-[#4a6e7a]">
                          {pr.status}
                          {pr.outputUrl ? "" : " · нет preview"}
                        </p>
                      )}
                      {pr?.outputUrl && (
                        <div className="mt-2 max-h-24 overflow-hidden rounded-xl border border-[#B8DCE6] bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element -- remote URL */}
                          <img
                            src={pr.outputUrl}
                            alt=""
                            className="max-h-24 w-full object-contain"
                          />
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
          <Label htmlFor="m-title" className="text-[#0C2D38]">
            Название товара
          </Label>
          <Input
            id="m-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Протеиновый батончик с шоколадом"
            className="rounded-xl border-[#B8DCE6]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="m-benefits" className="text-[#0C2D38]">
            Преимущества
          </Label>
          <Textarea
            id="m-benefits"
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            rows={4}
            placeholder={"Без сахара\n20 г белка\nНатуральный состав\nПодходит для перекуса"}
            className="rounded-xl border-[#B8DCE6]"
          />
          <p className="text-xs text-[#4a6e7a]">Каждая строка — отдельный пункт</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="m-extra" className="text-[#0C2D38]">
            Дополнительный текст
          </Label>
          <Textarea
            id="m-extra"
            value={extraText}
            onChange={(e) => setExtraText(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="50 г, Хит продаж, Новинка"
            className="rounded-xl border-[#B8DCE6]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="m-what" className="text-[#0C2D38]">
            Что добавить или изменить
          </Label>
          <Textarea
            id="m-what"
            value={userInstructions}
            onChange={(e) => setUserInstructions(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Плашки, акценты, стиль под маркетплейс, фон…"
            className="rounded-xl border-[#B8DCE6]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="m-style" className="text-[#0C2D38]">
            Стиль карточки
          </Label>
          <select
            id="m-style"
            className="border-input bg-background w-full max-w-md rounded-xl border-[#B8DCE6] px-3 py-2 text-sm"
            value={style}
            onChange={(e) => setStyle(e.target.value as MarketplaceCardStyle)}
          >
            {styles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {cardSizePresets.length > 0 && (
          <div className="space-y-2">
            <Label className="text-[#0C2D38]">Размер карточки</Label>
            <div className="flex flex-wrap gap-2">
              {cardSizePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setCardSize(preset.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    cardSize === preset.id
                      ? "border-[#00AFCA] bg-[#e8f8fb] text-[#006b82]"
                      : "border-border bg-background text-foreground",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="m-overlay" className="text-[#0C2D38]">
            Шаблон размещения текста
          </Label>
          <select
            id="m-overlay"
            className="border-input bg-background w-full max-w-md rounded-xl border-[#B8DCE6] px-3 py-2 text-sm"
            value={overlayTemplate}
            onChange={(e) => setOverlayTemplate(e.target.value)}
          >
            <option value="bottom_panel">Текст снизу</option>
            <option value="left_panel">Текст слева</option>
            <option value="badges_callouts">Плашки вокруг товара</option>
          </select>
          <p className="text-xs text-[#4a6e7a]">
            AI создаёт фон без текста; читаемые подписи добавляет QazCard AI поверх кадра.
          </p>
        </div>

        {overlayPreview && (
          <div className="space-y-2">
            <Label className="text-[#0C2D38]">Превью текста и плашек</Label>
            <div
              className="max-w-md overflow-hidden rounded-2xl border border-[#B8DCE6] bg-gradient-to-br from-[#f7fbfc] to-[#e7f5f8]"
              style={{ aspectRatio: `${overlayPreview.width} / ${overlayPreview.height}` }}
            >
              <div
                className="h-full w-full"
                dangerouslySetInnerHTML={{ __html: overlayPreview.svg }}
              />
            </div>
            <p className="text-xs text-[#4a6e7a]">
              {overlayPreview.label}: финальная генерация использует эту же сетку, шрифты и плашки.
            </p>
          </div>
        )}

        {canUseBackend && (
          <div className="space-y-1 text-sm text-[#4a6e7a]">
            {showEstimate && estimating && <p>Рассчитываем стоимость…</p>}
            {errToShow && (
              <p className="text-destructive" role="alert">
                {errToShow}
              </p>
            )}
            {showEstimate && !estimating && creditsToShow != null && !errToShow && (
              <p>
                Стоимость:{" "}
                <span className="font-medium tabular-nums text-[#0C2D38]">{creditsToShow}</span>{" "}
                ток. · баланс:{" "}
                <span className="font-medium tabular-nums text-[#0C2D38]">{balanceCredits}</span>
                {creditsToShow != null && (
                  <span>
                    {" "}
                    · после:{" "}
                    <span className="font-medium tabular-nums text-[#0C2D38]">
                      {Math.max(0, balanceCredits - creditsToShow)}
                    </span>
                  </span>
                )}
              </p>
            )}
            {notEnough && (
              <p>
                Недостаточно токенов.{" "}
                <Link href="/dashboard/billing" className="font-medium text-[#00AFCA] underline">
                  Пополнить баланс
                </Link>
              </p>
            )}
          </div>
        )}

        <Button
          type="button"
          onClick={() => void onSubmit()}
          disabled={!canSubmit || generating}
        >
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Создаём карточку…
            </>
          ) : (
            "Создать карточку"
          )}
        </Button>
        {!canUseBackend && (
          <p className="text-xs text-[#4a6e7a]">Сначала привяжите фото к проекту.</p>
        )}

        {genError && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertTitle>Генерация</AlertTitle>
            <AlertDescription>{genError}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-3 rounded-2xl border border-[#B8DCE6] bg-white/90 p-4 shadow-sm">
            <p className="text-sm font-medium text-[#0C2D38]">
              {result.status === "COMPLETED" && result.outputUrl ? "Карточка готова" : "Карточка создаётся"}
            </p>
            <p className="font-mono text-xs text-[#4a6e7a]">
              {result.generationId} · {result.status}
            </p>
            {result.status === "COMPLETED" && result.outputUrl && (
              <div className="space-y-2">
                <div className="max-h-80 overflow-hidden rounded-xl border border-[#B8DCE6] bg-[#F4FBFD]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- user generation URL */}
                  <img src={result.outputUrl} alt="Карточка" className="max-h-80 w-full object-contain" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                    href={`/api/generations/${result.generationId}/download`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Скачать
                  </a>
                </div>
                <p className="text-xs text-[#4a6e7a]">
                  Для видео выберите эту карточку источником на вкладке «Видео».
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-[#B8DCE6]"
                  onClick={() => {
                    setResult(null);
                    void loadProjectMeta();
                  }}
                >
                  Сделать ещё вариант
                </Button>
              </div>
            )}
            {(result.status === "QUEUED" ||
              result.status === "PROCESSING" ||
              (result.status === "COMPLETED" && !result.outputUrl)) && (
              <Link
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#B8DCE6] bg-white px-3 text-sm font-medium text-[#0C2D38]"
                href={`/dashboard/history/${result.generationId}`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Открыть в истории
              </Link>
            )}
            {result.status === "FAILED" && (
              <p className="text-sm text-destructive">Ошибка; токены обычно возвращаются.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
