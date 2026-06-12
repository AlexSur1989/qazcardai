"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, Download, ExternalLink, Loader2 } from "lucide-react";

import { SeedanceSingleImageUpload } from "@/components/dashboard/seedance-single-image-upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoTooltip, LabelWithInfoTooltip } from "@/components/ui/info-tooltip";
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

import type { SourceImagesValue, SourceImageRole } from "./source-images-upload";

const motions = getPublicProductVideoMotionStyles();

const SOURCE_ROLE_LABELS: Record<SourceImageRole, string> = {
  main: "Главное",
  side: "Сбоку",
  back: "Сзади",
  detail: "Детали",
};

const VIDEO_SOURCE_TYPE_OPTIONS = [
  {
    id: "original" as const,
    title: "Фото товара",
    subtitle: "Обычное загруженное фото",
    tooltip:
      "Подходит для чистого рекламного видео товара. Можно использовать движение камеры, свет, фон и коммерческую подачу.",
    emptyHint: null as string | null,
  },
  {
    id: "concept_generation" as const,
    title: "Фото с концепциями",
    subtitle: "Готовая визуальная сцена",
    tooltip:
      "Подходит, если вы уже создали красивую визуальную сцену и хотите оживить её в видео.",
    emptyHint: "Пока нет фото с концепциями",
  },
  {
    id: "marketplace_card_generation" as const,
    title: "Карточка товара",
    subtitle: "Изображение с текстом и инфографикой",
    tooltip:
      "Подходит для готовых карточек с текстом и инфографикой. Включите «Режим карточки товара», чтобы AI старался сохранить текст и расположение блоков.",
    emptyHint: "Пока нет готовых карточек",
  },
] as const;

const VIDEO_SECTION_TOOLTIPS = {
  source:
    "Выберите изображение, из которого будет создан ролик: обычное фото товара, фото с концепциями или готовая карточка товара.",
  motion:
    "Плавный наезд подходит для карточек и спокойной рекламы. Облет и wow-эффект лучше использовать для обычных фото товара без текста. Если включён режим карточки товара, движение автоматически смягчается.",
  cardMode:
    "Включите, если выбранное изображение уже является готовой карточкой товара с заголовками, преимуществами, характеристиками, бейджами или инфографикой. В этом режиме AI будет стараться не менять текст, расположение блоков и дизайн, а движение камеры станет мягче.",
  duration:
    "Короткие ролики дешевле и лучше подходят для быстрых промо. Более длинные дают модели больше времени на движение и раскрытие товара.",
  loop: "Видео будет стараться вернуться к начальному кадру, чтобы его можно было воспроизводить по кругу без заметной склейки.",
  lastFrame:
    "Используется, если нужно задать, чем должен закончиться ролик. Не используйте вместе с бесшовным циклом, если финальный кадр сильно отличается от первого.",
  notes:
    "Опишите желаемую сцену или движение. Например: «мягкий свет, премиальный фон, медленный наезд камеры». Не указывайте новые характеристики товара, если их нет на изображении.",
} as const;

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

function defaultOriginalSourceUrl(sourceImages: SourceImagesValue): string | null {
  const main = sourceImages.find((img) => img.role === "main" && img.url.trim());
  const first = sourceImages.find((img) => img.url.trim());
  const url = (main ?? first)?.url?.trim();
  return url || null;
}

function originalSourceOptions(sourceImages: SourceImagesValue): Array<{ url: string; label: string }> {
  return sourceImages
    .filter((img) => img.url.trim())
    .sort((a, b) => a.order - b.order)
    .map((img) => ({
      url: img.url.trim(),
      label: SOURCE_ROLE_LABELS[img.role] ?? "Фото",
    }));
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
  const productCardModeFieldId = useId();
  const productCardModeTouchedRef = useRef(false);
  const videoSettingsRef = useRef<Record<string, unknown>>({});

  const [sourceType, setSourceType] = useState<SourceTab>("original");
  const [sourceGenerationId, setSourceGenerationId] = useState<string | null>(null);
  const [selectedSourceImageUrl, setSelectedSourceImageUrl] = useState<string | null>(null);
  const [generatedOptions, setGeneratedOptions] = useState<GeneratedSourceOption[]>([]);
  const [genPreviews, setGenPreviews] = useState<Record<string, GenPreview | undefined>>({});

  const [duration, setDuration] = useState<5 | 10>(5);
  const [motion, setMotion] = useState<ProductVideoMotionStyle>("none");
  const [userPrompt, setUserPrompt] = useState("");
  const [loopVideo, setLoopVideo] = useState(false);
  const [productCardMode, setProductCardMode] = useState(false);
  const [useLastFrame, setUseLastFrame] = useState(false);
  const [lastFrameUrl, setLastFrameUrl] = useState("");

  const { resolution, aspectRatio } = useMemo(
    () => presetForDuration(duration, videoPresets),
    [duration, videoPresets],
  );

  const originalSources = useMemo(() => originalSourceOptions(sourceImages), [sourceImages]);

  const conceptOptions = useMemo(
    () => generatedOptions.filter((o) => o.sourceType === "concept_generation"),
    [generatedOptions],
  );
  const marketplaceOptions = useMemo(
    () => generatedOptions.filter((o) => o.sourceType === "marketplace_card_generation"),
    [generatedOptions],
  );

  const isSourceTypeDisabled = useCallback(
    (type: SourceTab) => {
      if (type === "original") return originalSources.length === 0;
      if (type === "concept_generation") return conceptOptions.length === 0;
      return marketplaceOptions.length === 0;
    },
    [originalSources.length, conceptOptions.length, marketplaceOptions.length],
  );

  useEffect(() => {
    if (originalSources.length === 0) {
      setSelectedSourceImageUrl(null);
      return;
    }
    setSelectedSourceImageUrl((prev) => {
      if (prev && originalSources.some((o) => o.url === prev)) return prev;
      return defaultOriginalSourceUrl(sourceImages);
    });
  }, [originalSources, sourceImages]);

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
          videoSettings?: unknown;
        };
      };
    }>(res);
    if (!parsed.ok || !res.ok) return;

    const rawVideoSettings = parsed.data.project?.metadata?.videoSettings;
    if (rawVideoSettings && typeof rawVideoSettings === "object" && rawVideoSettings !== null) {
      videoSettingsRef.current = rawVideoSettings as Record<string, unknown>;
      const savedMode = (rawVideoSettings as { productCardMode?: unknown }).productCardMode;
      if (typeof savedMode === "boolean") {
        setProductCardMode(savedMode);
        productCardModeTouchedRef.current = true;
      }
    }

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

  const applyAutoProductCardMode = useCallback((nextSource: SourceTab) => {
    if (productCardModeTouchedRef.current) return;
    setProductCardMode(nextSource === "marketplace_card_generation");
  }, []);

  const persistProductCardMode = useCallback(
    async (value: boolean) => {
      if (!projectId) return;
      const nextVideoSettings = {
        ...videoSettingsRef.current,
        productCardMode: value,
      };
      videoSettingsRef.current = nextVideoSettings;
      await fetch(`/api/product-card-projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: {
            videoSettings: nextVideoSettings,
          },
        }),
      });
    },
    [projectId],
  );

  const onProductCardModeChange = useCallback(
    (checked: boolean) => {
      productCardModeTouchedRef.current = true;
      setProductCardMode(checked);
      void persistProductCardMode(checked);
    },
    [persistProductCardMode],
  );

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

  useEffect(() => {
    if (!loopVideo) return;
    setUseLastFrame(false);
    setLastFrameUrl("");
  }, [loopVideo]);

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

  const effectiveLastFrameUrl =
    !loopVideo && useLastFrame && lastFrameUrl.trim() ? lastFrameUrl.trim() : null;

  const canEstimate = useMemo(
    () =>
      Boolean(
        projectId &&
          canUseBackend &&
          (sourceType !== "original" ||
            (selectedSourceImageUrl &&
              originalSources.some((o) => o.url === selectedSourceImageUrl))) &&
          (sourceType === "original" ||
            (sourceGenerationId && generatedOptions.some((o) => o.generationId === sourceGenerationId))),
      ),
    [
      projectId,
      canUseBackend,
      sourceType,
      sourceGenerationId,
      generatedOptions,
      selectedSourceImageUrl,
      originalSources,
    ],
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
          sourceImageUrl: sourceType === "original" ? selectedSourceImageUrl : null,
          duration,
          resolution,
          aspectRatio,
          motionStyle: motion,
          lastFrameUrl: effectiveLastFrameUrl,
          productCardMode,
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
    selectedSourceImageUrl,
    duration,
    resolution,
    aspectRatio,
    motion,
    effectiveLastFrameUrl,
    productCardMode,
  ]);

  const showEstimate = canEstimate;
  const creditsToShow = showEstimate ? estimateCredits : null;
  const errToShow = showEstimate ? estErr : null;
  const notEnough = creditsToShow != null && balanceCredits < creditsToShow;
  const canSubmit = showEstimate && !estimating && creditsToShow != null && !errToShow && !notEnough;

  const pickOriginal = (url: string) => {
    setSourceType("original");
    setSourceGenerationId(null);
    setSelectedSourceImageUrl(url);
    applyAutoProductCardMode("original");
  };

  const pickGenerated = (opt: GeneratedSourceOption) => {
    setSourceType(opt.sourceType);
    setSourceGenerationId(opt.generationId);
    applyAutoProductCardMode(opt.sourceType);
  };

  const selectSourceType = useCallback(
    (type: SourceTab) => {
      if (isSourceTypeDisabled(type)) return;
      if (type === "original") {
        const url =
          sourceType === "original" &&
          selectedSourceImageUrl &&
          originalSources.some((o) => o.url === selectedSourceImageUrl)
            ? selectedSourceImageUrl
            : defaultOriginalSourceUrl(sourceImages);
        setSourceType("original");
        setSourceGenerationId(null);
        if (url) setSelectedSourceImageUrl(url);
        applyAutoProductCardMode("original");
        return;
      }
      const opts = type === "concept_generation" ? conceptOptions : marketplaceOptions;
      const existing =
        sourceType === type && sourceGenerationId
          ? opts.find((o) => o.generationId === sourceGenerationId)
          : null;
      const target = existing ?? opts[0]!;
      setSourceType(target.sourceType);
      setSourceGenerationId(target.generationId);
      applyAutoProductCardMode(target.sourceType);
    },
    [
      isSourceTypeDisabled,
      sourceType,
      selectedSourceImageUrl,
      originalSources,
      sourceImages,
      conceptOptions,
      marketplaceOptions,
      sourceGenerationId,
      applyAutoProductCardMode,
    ],
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
        sourceImageUrl: sourceType === "original" ? selectedSourceImageUrl : null,
        duration,
        resolution,
        aspectRatio,
        motionStyle: motion,
        userPrompt: userPrompt.trim(),
        loopVideo,
        productCardMode,
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
    <Card className="min-w-0 max-w-full border-primary/15">
      <CardHeader className="grid-rows-none flex min-w-0 flex-col gap-1.5">
        <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg">
          <Clapperboard className="size-5 shrink-0" />
          <span className="min-w-0">Видео товара</span>
        </CardTitle>
        <CardDescription className="min-w-0 text-pretty">
          Короткий ролик из выбранного изображения.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {canUseBackend && (
          <div className="min-w-0 max-w-full space-y-4">
            <LabelWithInfoTooltip
              label="Источник для видео"
              tooltip={VIDEO_SECTION_TOOLTIPS.source}
            />

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
              {VIDEO_SOURCE_TYPE_OPTIONS.map((opt) => {
                const disabled = isSourceTypeDisabled(opt.id);
                const selected = sourceType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectSourceType(opt.id)}
                    className={cn(
                      "min-w-0 rounded-2xl border-2 p-4 text-left transition-colors",
                      selected && !disabled
                        ? "border-[#00AFCA] bg-[#F4FBFD] ring-2 ring-[#00AFCA]/25"
                        : "border-[#B8DCE6] bg-white",
                      disabled
                        ? "cursor-not-allowed opacity-55"
                        : !selected && "hover:border-[#00AFCA]/45",
                    )}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-[#0C2D38]">{opt.title}</span>
                      <InfoTooltip content={opt.tooltip} side="top" align="end" />
                    </div>
                    <p className="mt-1 text-pretty text-xs text-[#4a6e7a]">{opt.subtitle}</p>
                    {disabled && opt.emptyHint ? (
                      <p className="mt-2 text-pretty text-xs text-[#4a6e7a]">{opt.emptyHint}</p>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="min-w-0 space-y-2">
              <p className="text-xs font-medium text-[#0C2D38]">Выберите конкретное изображение</p>
              <div className="flex min-w-0 max-w-full flex-wrap items-start gap-3">
                {sourceType === "original" &&
                  originalSources.map((opt) => {
                    const active =
                      sourceType === "original" && selectedSourceImageUrl === opt.url;
                    return (
                      <button
                        key={`original-${opt.url}`}
                        type="button"
                        onClick={() => pickOriginal(opt.url)}
                        className={cn(
                          "w-[120px] shrink-0 overflow-hidden rounded-2xl border-2 text-left transition-colors",
                          active
                            ? "border-[#00AFCA] bg-[#F4FBFD] ring-2 ring-[#00AFCA]/25"
                            : "border-[#B8DCE6] bg-white hover:border-[#00AFCA]/45",
                        )}
                      >
                        <div className="flex h-24 items-center justify-center bg-[#F4FBFD]">
                          {/* eslint-disable-next-line @next/next/no-img-element -- product source preview */}
                          <img src={opt.url} alt="" className="max-h-24 w-full object-contain" />
                        </div>
                        <p className="px-2 py-2 text-xs font-medium text-[#0C2D38]">{opt.label}</p>
                      </button>
                    );
                  })}

                {sourceType === "concept_generation" &&
                  conceptOptions.map((opt) => {
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

                {sourceType === "marketplace_card_generation" &&
                  marketplaceOptions.map((opt) => {
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
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="v-notes" className="inline-flex items-center gap-1 text-[#0C2D38]">
            Дополнительные пожелания
            <InfoTooltip content={VIDEO_SECTION_TOOLTIPS.notes} />
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
          <Label htmlFor="v-motion" className="inline-flex items-center gap-1 text-[#0C2D38]">
            Движение камеры
            <InfoTooltip content={VIDEO_SECTION_TOOLTIPS.motion} />
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

        <div className="space-y-2 rounded-2xl border border-[#B8DCE6] bg-[#F4FBFD]/40 p-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              id={productCardModeFieldId}
              role="switch"
              aria-checked={productCardMode}
              onClick={() => onProductCardModeChange(!productCardMode)}
              className={cn(
                "relative mt-0.5 inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors",
                productCardMode
                  ? "border-[#00AFCA] bg-[#00AFCA]"
                  : "border-[#B8DCE6] bg-[#e8eef0]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform",
                  productCardMode ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </button>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={productCardModeFieldId} className="inline-flex cursor-pointer items-center gap-1 text-[#0C2D38]">
                Режим карточки товара
                <InfoTooltip content={VIDEO_SECTION_TOOLTIPS.cardMode} />
              </Label>
              <p className="text-xs text-[#4a6e7a]">Сохраняет текст и инфографику.</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="inline-flex items-center gap-1 text-[#0C2D38]">
            Длительность
            <InfoTooltip content={VIDEO_SECTION_TOOLTIPS.duration} />
          </Label>
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
          <Label htmlFor={loopFieldId} className="inline-flex cursor-pointer items-center gap-1 text-[#0C2D38]">
            Зациклить видео
            <InfoTooltip content={VIDEO_SECTION_TOOLTIPS.loop} />
          </Label>
        </div>

        <div
          className={cn(
            "space-y-3 rounded-2xl border border-[#B8DCE6] bg-[#F4FBFD]/40 p-4",
            loopVideo && "opacity-60",
          )}
        >
          <div className="flex items-center gap-2">
            <input
              id={lastFrameToggleId}
              type="checkbox"
              checked={useLastFrame}
              disabled={loopVideo}
              onChange={(e) => {
                if (loopVideo) return;
                const on = e.target.checked;
                setUseLastFrame(on);
                if (!on) setLastFrameUrl("");
              }}
              className="border-input accent-primary size-4 rounded border disabled:cursor-not-allowed"
            />
            <Label
              htmlFor={lastFrameToggleId}
              className={cn(
                "inline-flex items-center gap-1 text-[#0C2D38]",
                loopVideo ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              Последний кадр
              <InfoTooltip content={VIDEO_SECTION_TOOLTIPS.lastFrame} />
              <span className="text-muted-foreground font-normal">(необязательно)</span>
            </Label>
          </div>
          {loopVideo ? (
            <p className="text-xs text-[#4a6e7a]">
              При цикличном видео последний кадр недоступен — ролик должен плавно замыкаться.
            </p>
          ) : null}
          {useLastFrame && !loopVideo ? (
            <SeedanceSingleImageUpload
              fieldName="productVideoLastFrame"
              label="Последний кадр"
              value={lastFrameUrl}
              onChange={setLastFrameUrl}
              hint="JPEG, PNG или WebP до 10 МБ."
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
