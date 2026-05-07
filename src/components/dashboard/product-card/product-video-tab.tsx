"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, Download, ExternalLink, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getPublicProductVideoMotionStyles,
  type ProductVideoMotionStyle,
} from "@/config/product-card-categories";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import { getFirstOutputPreviewUrl } from "@/lib/generation-output-utils";
import {
  VIDEO_GENERATION_POLL_INTERVAL_MS,
  VIDEO_GENERATION_POLL_MAX_ITERATIONS,
} from "@/lib/generation-client-polling";
import { cn } from "@/lib/utils";

const motions = getPublicProductVideoMotionStyles();

type SourceTab = "original" | "concept_generation" | "marketplace_card_generation";

type ConceptRow = { generationId: string };
type MarketplaceRow = { generationId: string };

type GenPreview = { id: string; status: string; outputUrl: string | null };

type Props = {
  hasImage: boolean;
  canUseBackend: boolean;
  projectId: string | null;
  balanceCredits: number;
  videoPresets: { duration: number; resolution: string; aspectRatio: string }[];
};

export function ProductVideoTab({
  hasImage,
  canUseBackend,
  projectId,
  balanceCredits,
  videoPresets,
}: Props) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<SourceTab>("original");
  const [sourceGenerationId, setSourceGenerationId] = useState<string | null>(null);
  const [conceptRows, setConceptRows] = useState<ConceptRow[]>([]);
  const [cardRows, setCardRows] = useState<MarketplaceRow[]>([]);
  const [genPreviews, setGenPreviews] = useState<Record<string, GenPreview | undefined>>({});

  const [duration, setDuration] = useState<5 | 10>(5);
  const [resolution, setResolution] = useState(videoPresets[0]?.resolution ?? "720p");
  const [aspectRatio, setAspectRatio] = useState(videoPresets[0]?.aspectRatio ?? "16:9");
  const [motion, setMotion] = useState<ProductVideoMotionStyle>("none");
  const [userPrompt, setUserPrompt] = useState("");

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

  const canEstimate = useMemo(
    () =>
      Boolean(
        projectId &&
          canUseBackend &&
          (sourceType === "original" ||
            (sourceType === "concept_generation" && sourceGenerationId) ||
            (sourceType === "marketplace_card_generation" && sourceGenerationId)),
      ),
    [projectId, canUseBackend, sourceType, sourceGenerationId],
  );

  const loadProjectMeta = useCallback(async () => {
    if (!projectId) {
      setConceptRows([]);
      setCardRows([]);
      return;
    }
    const res = await fetch(`/api/product-card-projects/${projectId}`);
    const parsed = await readJsonSafe<{
      project?: {
        metadata?: {
          conceptGenerations?: unknown;
          marketplaceCardGenerations?: unknown;
        };
      };
    }>(res);
    if (!parsed.ok || !res.ok) {
      return;
    }
    const cList = parsed.data.project?.metadata?.conceptGenerations;
    const cRows: ConceptRow[] = Array.isArray(cList)
      ? cList
          .map((x) => {
            if (x && typeof x === "object" && "generationId" in x) {
              const g = (x as { generationId: unknown }).generationId;
              if (typeof g === "string" && g.trim()) {
                return { generationId: g.trim() } as ConceptRow;
              }
            }
            return null;
          })
          .filter((x): x is ConceptRow => x != null)
      : [];
    setConceptRows(cRows);
    const mList = parsed.data.project?.metadata?.marketplaceCardGenerations;
    const mRows: MarketplaceRow[] = Array.isArray(mList)
      ? mList
          .map((x) => {
            if (x && typeof x === "object" && "generationId" in x) {
              const g = (x as { generationId: unknown }).generationId;
              if (typeof g === "string" && g.trim()) {
                return { generationId: g.trim() } as MarketplaceRow;
              }
            }
            return null;
          })
          .filter((x): x is MarketplaceRow => x != null)
      : [];
    setCardRows(mRows);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !canUseBackend) return;
    void (async () => {
      await loadProjectMeta();
    })();
  }, [projectId, canUseBackend, loadProjectMeta]);

  useEffect(() => {
    if (sourceType === "concept_generation" && conceptRows.length === 0) {
      void (async () => {
        await Promise.resolve();
        setSourceType("original");
        setSourceGenerationId(null);
      })();
    }
  }, [sourceType, conceptRows.length]);

  useEffect(() => {
    if (sourceType === "marketplace_card_generation" && cardRows.length === 0) {
      void (async () => {
        await Promise.resolve();
        setSourceType("original");
        setSourceGenerationId(null);
      })();
    }
  }, [sourceType, cardRows.length]);

  const idsToPreviewKey = useMemo(() => {
    if (sourceType === "original") return "";
    if (sourceType === "concept_generation") {
      return conceptRows.map((r) => r.generationId).join(",");
    }
    return cardRows.map((r) => r.generationId).join(",");
  }, [sourceType, conceptRows, cardRows]);

  useEffect(() => {
    const ids = idsToPreviewKey ? idsToPreviewKey.split(",").filter(Boolean) : [];
    if (ids.length === 0) return;
    void (async () => {
      const next: Record<string, GenPreview> = {};
      for (const id of ids) {
        const res = await fetch(`/api/generations/${id}`);
        const p = await readJsonSafe<{ status: string; outputFiles: unknown }>(res);
        if (p.ok && res.ok) {
          next[id] = {
            id,
            status: p.data.status,
            outputUrl: getFirstOutputPreviewUrl(p.data.outputFiles),
          };
        }
      }
      setGenPreviews((prev) => ({ ...prev, ...next }));
    })();
  }, [idsToPreviewKey]);

  useEffect(() => {
    if (!canEstimate) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setEstimating(true);
      setEstErr(null);
      const res = await fetch(`/api/product-card-projects/${projectId}/estimate/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceGenerationId: sourceType === "original" ? null : sourceGenerationId,
          duration,
          resolution,
          aspectRatio,
          motionStyle: motion,
        }),
      });
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
      setEstimateCredits(typeof parsed.data.credits === "number" ? parsed.data.credits : null);
      setEstimating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [canEstimate, projectId, sourceType, sourceGenerationId, duration, resolution, aspectRatio, motion]);

  const showEstimate = canEstimate;
  const creditsToShow = showEstimate ? estimateCredits : null;
  const errToShow = showEstimate ? estErr : null;
  const notEnough = creditsToShow != null && balanceCredits < creditsToShow;
  const canSubmit = showEstimate && !estimating && creditsToShow != null && !errToShow && !notEnough;

  const resolutionOptions = useMemo(() => {
    const s = new Set(videoPresets.map((p) => p.resolution));
    return Array.from(s);
  }, [videoPresets]);

  const applyResolution = useCallback(
    (res: string) => {
      setResolution(res);
      const match =
        videoPresets.find((p) => p.resolution === res && p.duration === duration) ??
        videoPresets.find((p) => p.resolution === res);
      if (match) {
        setDuration(match.duration === 10 ? 10 : 5);
        setAspectRatio(match.aspectRatio);
      }
    },
    [videoPresets, duration],
  );

  const setDurationPick = useCallback(
    (d: 5 | 10) => {
      setDuration(d);
      const match =
        videoPresets.find((p) => p.duration === d && p.resolution === resolution) ??
        videoPresets.find((p) => p.duration === d);
      if (match) {
        setResolution(match.resolution);
        setAspectRatio(match.aspectRatio);
      }
    },
    [videoPresets, resolution],
  );

  const onSubmit = async () => {
    if (!projectId || !canUseBackend) return;
    setGenError(null);
    setResult(null);
    setGenerating(true);
    try {
      const body: Record<string, unknown> = {
        sourceType,
        sourceGenerationId: sourceType === "original" ? null : sourceGenerationId,
        duration,
        resolution,
        aspectRatio,
        motionStyle: motion,
        userPrompt: userPrompt.trim(),
      };
      if (typeof estimateCredits === "number" && Number.isFinite(estimateCredits)) {
        body.clientEstimateCredits = estimateCredits;
      }
      const res = await fetch(`/api/product-card-projects/${projectId}/generate/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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
      for (let i = 0; i < VIDEO_GENERATION_POLL_MAX_ITERATIONS; i++) {
        const gRes = await fetch(`/api/generations/${genId}`);
        const p = await readJsonSafe<{ status: string; outputFiles: unknown }>(gRes);
        if (p.ok && gRes.ok) {
          st = p.data.status;
          outputUrl = getFirstOutputPreviewUrl(p.data.outputFiles) ?? outputUrl;
        }
        if (terminal.has(st) && (st !== "COMPLETED" || outputUrl)) break;
        if (i < VIDEO_GENERATION_POLL_MAX_ITERATIONS - 1) {
          await new Promise((r) => setTimeout(r, VIDEO_GENERATION_POLL_INTERVAL_MS));
        }
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
          <Clapperboard className="size-5" />
          Видео товара
        </CardTitle>
        <CardDescription>
          Короткий ролик из исходного фото, AI-кадра или готовой карточки. На сервере добавляются
          технические правила качества; здесь — длительность, разрешение и ваши пожелания.
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
              <Button
                type="button"
                size="sm"
                variant={sourceType === "concept_generation" ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => {
                  if (conceptRows.length > 0) {
                    setSourceType("concept_generation");
                    setSourceGenerationId(conceptRows[0]!.generationId);
                  }
                }}
                disabled={conceptRows.length === 0}
              >
                Сгенерированное фото
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sourceType === "marketplace_card_generation" ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => {
                  if (cardRows.length > 0) {
                    setSourceType("marketplace_card_generation");
                    setSourceGenerationId(cardRows[0]!.generationId);
                  }
                }}
                disabled={cardRows.length === 0}
              >
                Карточка товара
              </Button>
            </div>
            {conceptRows.length === 0 && (
              <p className="text-xs text-[#4a6e7a]">
                Сначала создайте AI-фото во вкладке «Фото с концепциями».
              </p>
            )}
            {cardRows.length === 0 && (
              <p className="text-xs text-[#4a6e7a]">
                Сначала создайте карточку во вкладке «Карточка товара».
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
            {sourceType === "marketplace_card_generation" && cardRows.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {cardRows.map((r) => {
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
          <Label className="text-[#0C2D38]">Длительность</Label>
          <div className="flex flex-wrap gap-2">
            {([5, 10] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationPick(d)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  duration === d
                    ? "border-[#00AFCA] bg-[#e8f8fb] text-[#006b82]"
                    : "border-[#B8DCE6] bg-white text-[#0C2D38]",
                )}
              >
                {d} сек
              </button>
            ))}
          </div>
        </div>

        {resolutionOptions.length > 0 && (
          <div className="space-y-2">
            <Label className="text-[#0C2D38]">Разрешение</Label>
            <div className="flex flex-wrap gap-2">
              {resolutionOptions.map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => applyResolution(res)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    resolution === res
                      ? "border-[#00AFCA] bg-[#e8f8fb] text-[#006b82]"
                      : "border-[#B8DCE6] bg-white text-[#0C2D38]",
                  )}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>
        )}

        {videoPresets.length > 0 && (
          <div className="space-y-2">
            <Label className="text-[#0C2D38]">Быстрый пресет</Label>
            <div className="flex flex-wrap gap-2">
              {videoPresets.map((preset) => {
                const active =
                  duration === preset.duration &&
                  resolution === preset.resolution &&
                  aspectRatio === preset.aspectRatio;
                return (
                  <button
                    key={`${preset.duration}-${preset.resolution}-${preset.aspectRatio}`}
                    type="button"
                    onClick={() => {
                      setDuration(preset.duration === 10 ? 10 : 5);
                      setResolution(preset.resolution);
                      setAspectRatio(preset.aspectRatio);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition",
                      active
                        ? "border-[#00AFCA] bg-[#e8f8fb] text-[#006b82]"
                        : "border-border bg-background text-foreground",
                    )}
                  >
                    {preset.duration}s · {preset.resolution} · {preset.aspectRatio}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="v-motion" className="text-[#0C2D38]">
            Стиль движения
          </Label>
          <select
            id="v-motion"
            className="border-input bg-background w-full max-w-md rounded-xl border-[#B8DCE6] px-3 py-2 text-sm"
            value={motion}
            onChange={(e) => setMotion(e.target.value as ProductVideoMotionStyle)}
          >
            {motions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {motion === "none" && (
            <p className="text-xs text-[#4a6e7a]">
              Без пресета камеры: в промпт уйдут только ваши пожелания и базовые правила качества.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="v-notes" className="text-[#0C2D38]">
            Пожелания к видео
          </Label>
          <Textarea
            id="v-notes"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Например: премиум-свет, мягкий фон, акцент на упаковке"
            className="rounded-xl border-[#B8DCE6]"
          />
        </div>

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

        <Button type="button" onClick={() => void onSubmit()} disabled={!canSubmit || generating}>
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Создаём видео…
            </>
          ) : (
            "Создать видео"
          )}
        </Button>
        {!canUseBackend && <p className="text-xs text-[#4a6e7a]">Сначала привяжите фото к проекту.</p>}

        {genError && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertTitle>Генерация</AlertTitle>
            <AlertDescription>{genError}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-3 rounded-2xl border border-[#B8DCE6] bg-white/90 p-4 shadow-sm">
            <p className="text-sm font-medium text-[#0C2D38]">
              {result.status === "COMPLETED" && result.outputUrl ? "Видео готово" : "Видео создаётся"}
            </p>
            <p className="font-mono text-xs text-[#4a6e7a]">
              {result.generationId} · {result.status}
            </p>
            {result.status === "COMPLETED" && result.outputUrl && (
              <div className="space-y-2">
                <div className="max-h-80 overflow-hidden rounded-xl border border-[#B8DCE6] bg-[#F4FBFD]">
                  <video
                    src={result.outputUrl}
                    className="max-h-80 w-full object-contain"
                    controls
                    playsInline
                  />
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
