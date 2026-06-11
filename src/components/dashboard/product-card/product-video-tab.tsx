"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, Download, ExternalLink, Loader2 } from "lucide-react";

import { SeedanceSingleImageUpload } from "@/components/dashboard/seedance-single-image-upload";
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
import { getUserFacingGenerationStatusFromRaw } from "@/lib/generation-display";
import { cn } from "@/lib/utils";

import type { SourceImagesValue } from "./source-images-upload";

const motions = getPublicProductVideoMotionStyles();

type SourceTab = "original" | "concept_generation" | "marketplace_card_generation";

type GeneratedSourceOption = {
  generationId: string;
  sourceType: "concept_generation" | "marketplace_card_generation";
  label: string;
};

type GenPreview = { id: string; status: string; outputUrl: string | null };

type Props = {
  hasImage: boolean;
  canUseBackend: boolean;
  projectId: string | null;
  balanceCredits: number;
  videoPresets: { duration: number; resolution: string; aspectRatio: string }[];
  sourceImages: SourceImagesValue;
};

function presetForDuration(
  duration: 5 | 10,
  presets: Props["videoPresets"],
): { resolution: string; aspectRatio: string } {
  const match =
    presets.find((p) => p.duration === duration) ??
    presets.find((p) => p.duration === 5) ??
    presets[0];
  return {
    resolution: match?.resolution ?? "720p",
    aspectRatio: match?.aspectRatio ?? "16:9",
  };
}

function originalPreviewUrl(sourceImages: SourceImagesValue): string | null {
  const main = sourceImages.find((img) => img.role === "main" && img.url.trim());
  const first = sourceImages.find((img) => img.url.trim());
  const url = (main ?? first)?.url?.trim();
  return url || null;
}

export function ProductVideoTab({
  hasImage,
  canUseBackend,
  projectId,
  balanceCredits,
  videoPresets,
  sourceImages,
}: Props) {
  const router = useRouter();
  const loopFieldId = useId();
  const lastFrameToggleId = useId();

  const [sourceType, setSourceType] = useState<SourceTab>("original");
  const [sourceGenerationId, setSourceGenerationId] = useState<string | null>(null);
  const [generatedOptions, setGeneratedOptions] = useState<GeneratedSourceOption[]>([]);
  const [genPreviews, setGenPreviews] = useState<Record<string, GenPreview | undefined>>({});

  const [duration, setDuration] = useState<5 | 10>(5);
  const [motion, setMotion] = useState<ProductVideoMotionStyle>("none");
  const [userPrompt, setUserPrompt] = useState("");
  const [loopVideo, setLoopVideo] = useState(false);
  const [useLastFrame, setUseLastFrame] = useState(false);
  const [lastFrameUrl, setLastFrameUrl] = useState("");

  const { resolution, aspectRatio } = useMemo(
    () => presetForDuration(duration, videoPresets),
    [duration, videoPresets],
  );

  const originalUrl = useMemo(() => originalPreviewUrl(sourceImages), [sourceImages]);

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

  const loadProjectMeta = useCallback(async () => {
    if (!projectId) {
      setGeneratedOptions([]);
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
    if (!parsed.ok || !res.ok) return;

    const options: GeneratedSourceOption[] = [];
    const cList = parsed.data.project?.metadata?.conceptGenerations;
    if (Array.isArray(cList)) {
      for (const x of cList) {
        if (x && typeof x === "object" && "generationId" in x) {
          const g = (x as { generationId: unknown }).generationId;
          if (typeof g === "string" && g.trim()) {
            options.push({
              generationId: g.trim(),
              sourceType: "concept_generation",
              label: "AI-фото",
            });
          }
        }
      }
    }
    const mList = parsed.data.project?.metadata?.marketplaceCardGenerations;
    if (Array.isArray(mList)) {
      for (const x of mList) {
        if (x && typeof x === "object" && "generationId" in x) {
          const g = (x as { generationId: unknown }).generationId;
          if (typeof g === "string" && g.trim()) {
            options.push({
              generationId: g.trim(),
              sourceType: "marketplace_card_generation",
              label: "Карточка",
            });
          }
        }
      }
    }
    setGeneratedOptions(options);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !canUseBackend) return;
    void loadProjectMeta();
  }, [projectId, canUseBackend, loadProjectMeta]);

  useEffect(() => {
    if (sourceType === "original") return;
    const stillExists = generatedOptions.some((o) => o.generationId === sourceGenerationId);
    if (!stillExists) {
      setSourceType("original");
      setSourceGenerationId(null);
    }
  }, [generatedOptions, sourceGenerationId, sourceType]);

  const previewIdsKey = generatedOptions.map((o) => o.generationId).join(",");

  useEffect(() => {
    const ids = previewIdsKey ? previewIdsKey.split(",").filter(Boolean) : [];
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
  }, [previewIdsKey]);

  const effectiveLastFrameUrl = useLastFrame && lastFrameUrl.trim() ? lastFrameUrl.trim() : null;

  const canEstimate = useMemo(
    () =>
      Boolean(
        projectId &&
          canUseBackend &&
          (sourceType === "original" ||
            (sourceGenerationId && generatedOptions.some((o) => o.generationId === sourceGenerationId))),
      ),
    [projectId, canUseBackend, sourceType, sourceGenerationId, generatedOptions],
  );

  useEffect(() => {
    if (!canEstimate) return;
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
          lastFrameUrl: effectiveLastFrameUrl,
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
  }, [
    canEstimate,
    projectId,
    sourceType,
    sourceGenerationId,
    duration,
    resolution,
    aspectRatio,
    motion,
    effectiveLastFrameUrl,
  ]);

  const showEstimate = canEstimate;
  const creditsToShow = showEstimate ? estimateCredits : null;
  const errToShow = showEstimate ? estErr : null;
  const notEnough = creditsToShow != null && balanceCredits < creditsToShow;
  const canSubmit = showEstimate && !estimating && creditsToShow != null && !errToShow && !notEnough;

  const pickOriginal = () => {
    setSourceType("original");
    setSourceGenerationId(null);
  };

  const pickGenerated = (opt: GeneratedSourceOption) => {
    setSourceType(opt.sourceType);
    setSourceGenerationId(opt.generationId);
  };

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
        loopVideo,
        lastFrameUrl: effectiveLastFrameUrl,
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
          Короткий ролик из фото товара или сгенерированного кадра. Укажите пожелания, стиль движения
          и длительность — остальное настроим автоматически.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {canUseBackend && (
          <div className="space-y-3">
            <Label className="text-[#0C2D38]">Источник изображения</Label>
            <div className="flex flex-wrap items-start gap-3">
              <button
                type="button"
                onClick={pickOriginal}
                className={cn(
                  "w-[120px] shrink-0 overflow-hidden rounded-2xl border-2 text-left transition-colors",
                  sourceType === "original"
                    ? "border-[#00AFCA] bg-[#F4FBFD] ring-2 ring-[#00AFCA]/25"
                    : "border-[#B8DCE6] bg-white hover:border-[#00AFCA]/45",
                )}
              >
                <div className="flex h-24 items-center justify-center bg-[#F4FBFD]">
                  {originalUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- product source preview
                    <img src={originalUrl} alt="" className="max-h-24 w-full object-contain" />
                  ) : (
                    <span className="text-muted-foreground px-2 text-center text-xs">Нет превью</span>
                  )}
                </div>
                <p className="px-2 py-2 text-xs font-medium text-[#0C2D38]">Исходное фото</p>
              </button>

              {generatedOptions.map((opt) => {
                const pr = genPreviews[opt.generationId];
                const active =
                  sourceType === opt.sourceType && sourceGenerationId === opt.generationId;
                return (
                  <button
                    key={`${opt.sourceType}-${opt.generationId}`}
                    type="button"
                    onClick={() => pickGenerated(opt)}
                    className={cn(
                      "w-[120px] shrink-0 overflow-hidden rounded-2xl border-2 text-left transition-colors",
                      active
                        ? "border-[#00AFCA] bg-[#F4FBFD] ring-2 ring-[#00AFCA]/25"
                        : "border-[#B8DCE6] bg-white hover:border-[#00AFCA]/45",
                    )}
                  >
                    <div className="flex h-24 items-center justify-center bg-[#F4FBFD]">
                      {pr?.outputUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- generation preview
                        <img src={pr.outputUrl} alt="" className="max-h-24 w-full object-contain" />
                      ) : (
                        <span className="text-muted-foreground px-2 text-center text-xs">
                          {pr ? getUserFacingGenerationStatusFromRaw(pr.status) : "…"}
                        </span>
                      )}
                    </div>
                    <p className="px-2 py-2 text-xs font-medium text-[#0C2D38]">{opt.label}</p>
                  </button>
                );
              })}
            </div>
            {generatedOptions.length === 0 && (
              <p className="text-xs text-[#4a6e7a]">
                Сгенерированные фото появятся здесь после вкладок «Фото с концепциями» или «Карточка
                товара».
              </p>
            )}
          </div>
        )}

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
        </div>

        <div className="space-y-2">
          <Label className="text-[#0C2D38]">Длительность</Label>
          <div className="flex flex-wrap gap-2">
            {([5, 10] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
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

        <div className="flex items-center gap-3">
          <button
            type="button"
            id={loopFieldId}
            role="switch"
            aria-checked={loopVideo}
            onClick={() => setLoopVideo((v) => !v)}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors",
              loopVideo ? "border-[#00AFCA] bg-[#00AFCA]" : "border-[#B8DCE6] bg-[#e8eef0]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform",
                loopVideo ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </button>
          <Label htmlFor={loopFieldId} className="cursor-pointer text-[#0C2D38]">
            Цикличное видео
          </Label>
        </div>

        <div className="space-y-3 rounded-2xl border border-[#B8DCE6] bg-[#F4FBFD]/40 p-4">
          <div className="flex items-center gap-2">
            <input
              id={lastFrameToggleId}
              type="checkbox"
              checked={useLastFrame}
              onChange={(e) => {
                const on = e.target.checked;
                setUseLastFrame(on);
                if (!on) setLastFrameUrl("");
              }}
              className="border-input accent-primary size-4 rounded border"
            />
            <Label htmlFor={lastFrameToggleId} className="text-[#0C2D38]">
              Добавить последний кадр <span className="text-muted-foreground font-normal">(необязательно)</span>
            </Label>
          </div>
          {useLastFrame ? (
            <SeedanceSingleImageUpload
              fieldName="productVideoLastFrame"
              label="Последний кадр"
              value={lastFrameUrl}
              onChange={setLastFrameUrl}
              hint="JPEG, PNG или WebP до 10 МБ. Видео будет стремиться к этому кадру в конце."
              disabled={!canUseBackend}
            />
          ) : null}
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
            <p className="text-xs text-[#4a6e7a]">
              Видео товара · {getUserFacingGenerationStatusFromRaw(result.status)}
              {result.costCredits > 0 ? ` · ${result.costCredits} ток.` : null}
            </p>
            {result.status === "COMPLETED" && result.outputUrl && (
              <div className="space-y-2">
                <div className="max-h-80 overflow-hidden rounded-xl border border-[#B8DCE6] bg-[#F4FBFD]">
                  <video
                    src={result.outputUrl}
                    className="max-h-80 w-full object-contain"
                    controls
                    playsInline
                    loop={loopVideo}
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
