"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, ImageIcon, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getConceptsForCategory,
  type ProductCategoryId,
} from "@/config/product-card-categories";
import { buildConceptPreviewCandidates } from "@/lib/product-card-concept-preview";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import {
  IMAGE_GENERATION_POLL_INTERVAL_MS,
  IMAGE_GENERATION_POLL_MAX_ITERATIONS,
} from "@/lib/generation-client-polling";
import { getFirstOutputUrlFromJson } from "@/lib/product-card-output";
import {
  getUserFacingGenerationStatusFromRaw,
  mapGenerationErrorToUserMessage,
} from "@/lib/generation-display";
import { cn } from "@/lib/utils";

type Props = {
  selectedCategory: ProductCategoryId | null;
  hasImage: boolean;
  canUseBackend: boolean;
  projectId: string | null;
  balanceCredits: number;
  sizePresets: { id: string; label: string; aspectRatio: string }[];
};

type GenPollRow = {
  status: string;
  outputFiles: unknown;
  errorMessage?: string | null;
};

function ConceptPreviewImage({
  previewSrc,
  conceptId,
  label,
}: {
  previewSrc: string;
  conceptId: string;
  label: string;
}) {
  const candidates = buildConceptPreviewCandidates(previewSrc, conceptId);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const imageSrc = candidates[Math.min(candidateIndex, candidates.length - 1)];

  return (
    // eslint-disable-next-line @next/next/no-img-element -- статика из /public; перебираем jpg/jpeg/png/webp до fallback
    <img
      src={imageSrc}
      alt={label}
      decoding="async"
      loading="lazy"
      onError={() => {
        setCandidateIndex((prev) =>
          prev < candidates.length - 1 ? prev + 1 : prev,
        );
      }}
      className="h-full w-full bg-[#e8f5f9] object-cover"
    />
  );
}

export function ConceptPhotoTab({
  selectedCategory,
  hasImage,
  canUseBackend,
  projectId,
  balanceCredits,
  sizePresets,
}: Props) {
  const router = useRouter();
  const [conceptId, setConceptId] = useState<string | null>(null);
  const [size, setSize] = useState(sizePresets[0]?.id ?? "1x1");
  const [userAdd, setUserAdd] = useState("");
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
    errorMessage?: string | null;
  } | null>(null);

  const concepts = selectedCategory ? getConceptsForCategory(selectedCategory) : [];
  const showEstimate = Boolean(
    projectId && selectedCategory && conceptId && canUseBackend,
  );

  useEffect(() => {
    if (!showEstimate) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setEstimating(true);
      setEstErr(null);
      const res = await fetch(
        `/api/product-card-projects/${projectId}/estimate/concept-photo`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ size }) },
      );
      const parsed = await readJsonSafe<{ credits?: number; modelName?: string; error?: string }>(
        res,
      );
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
  }, [showEstimate, projectId, selectedCategory, conceptId, canUseBackend, size]);

  const pollOnce = useCallback(async (id: string) => {
    const res = await fetch(`/api/generations/${id}`);
    const parsed = await readJsonSafe<GenPollRow>(res);
    if (!parsed.ok || !res.ok) return null;
    return parsed.data;
  }, []);

  const onGenerate = async () => {
    if (!projectId || !selectedCategory || !conceptId || !canUseBackend) return;
    setGenError(null);
    setResult(null);
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/product-card-projects/${projectId}/generate/concept-photo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: selectedCategory,
            conceptId,
            userPrompt: userAdd.trim(),
            size,
            clientEstimateCredits:
              typeof estimateCredits === "number" ? estimateCredits : null,
          }),
        },
      );
      const parsed = await readJsonSafe<{
        generationId?: string;
        status?: string;
        costCredits?: number;
        error?: string;
        reason?: string;
        code?: string;
      }>(res);
      if (!parsed.ok) {
        setGenError(parsed.message);
        return;
      }
      const data = parsed.data;
      if (res.status === 402) {
        setGenError(data.error ?? "Недостаточно кредитов");
        return;
      }
      if (!res.ok) {
        const detail =
          typeof data.reason === "string" && data.reason.trim() !== ""
            ? ` — ${data.reason}`
            : "";
        setGenError((data.error ?? "Ошибка генерации") + detail);
        if (res.status === 409 && data.code === "PRICE_CHANGED") {
          setEstimateCredits(null);
        }
        return;
      }
      const genId = data.generationId;
      if (!genId) {
        setGenError("Сервер не вернул generationId");
        return;
      }
      let st = data.status ?? "QUEUED";
      let outputUrl: string | null = null;
      let errMsg: string | null = null;
      const terminal = new Set(["COMPLETED", "FAILED", "REFUNDED", "CANCELLED", "BLOCKED"]);
      for (let i = 0; i < IMAGE_GENERATION_POLL_MAX_ITERATIONS; i++) {
        const g = await pollOnce(genId);
        if (g) {
          st = g.status;
          outputUrl = getFirstOutputUrlFromJson(g.outputFiles) ?? outputUrl;
          if (typeof g.errorMessage === "string" && g.errorMessage.trim()) {
            errMsg = g.errorMessage.trim();
          }
        }
        if (terminal.has(st) && (st !== "COMPLETED" || outputUrl)) break;
        if (i < IMAGE_GENERATION_POLL_MAX_ITERATIONS - 1) {
          await new Promise((r) => setTimeout(r, IMAGE_GENERATION_POLL_INTERVAL_MS));
        }
      }
      setResult({
        generationId: genId,
        status: st,
        costCredits: typeof data.costCredits === "number" ? data.costCredits : 0,
        outputUrl,
        errorMessage: errMsg,
      });
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

  if (!selectedCategory) {
    return (
      <Alert>
        <AlertTitle>Выберите категорию</AlertTitle>
        <AlertDescription>
          Сначала укажите категорию товара выше, чтобы отобрать концепции съёмки.
        </AlertDescription>
      </Alert>
    );
  }

  const creditsToShow = showEstimate ? estimateCredits : null;
  const errToShow = showEstimate ? estErr : null;
  const notEnough =
    creditsToShow != null && balanceCredits < creditsToShow;
  const canRun =
    Boolean(conceptId) &&
    canUseBackend &&
    !notEnough &&
    !estimating &&
    creditsToShow != null;

  return (
    <Card className="border-primary/15">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ImageIcon className="size-5" />
          Фото с концепциями
        </CardTitle>
        <CardDescription>
          Выберите концепцию и при необходимости опишите пожелания. Текст для генерации собирается на
          сервере автоматически.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Выберите визуальное направление. Превью показывает пример стиля, а итоговое изображение
          будет создано по вашему товару.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {concepts.map((c) => {
            const selected = conceptId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setConceptId(c.id)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition duration-200",
                  "shadow-[0_4px_24px_rgba(0,80,100,0.08)]",
                  "hover:-translate-y-0.5 hover:border-[#00afca] hover:shadow-md",
                  selected
                    ? "border-[#00afca] bg-[#f2fafc] ring-1 ring-[#00afca]"
                    : "border-[#b8dce6] bg-white",
                )}
              >
                <div
                  className={cn(
                    "relative size-20 shrink-0 overflow-hidden rounded-xl bg-[#e8f5f9] sm:size-24",
                  )}
                >
                  <ConceptPreviewImage
                    key={c.id}
                    previewSrc={c.previewImage}
                    conceptId={c.id}
                    label={c.label}
                  />
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1",
                    selected && "pr-14",
                  )}
                >
                  <div className="font-semibold text-[#0c2d38]">{c.label}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-[#4a6e7a]">{c.description}</div>
                  <p className="mt-1 text-xs text-[#006b82]">Пример стиля</p>
                </div>
                {selected && (
                  <Badge
                    variant="qazBlue"
                    className="pointer-events-none absolute top-2 right-2 font-normal shadow-sm"
                  >
                    Выбрано
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {sizePresets.length > 0 && (
          <div className="space-y-2">
            <Label>Размер / aspect ratio</Label>
            <div className="flex flex-wrap gap-2">
              {sizePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSize(preset.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    size === preset.id
                      ? "border-[#00afca] bg-[#e8f8fb] text-[#006b82]"
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
          <Label>Что добавить или изменить</Label>
          <Textarea
            value={userAdd}
            onChange={(e) => setUserAdd(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Например: добавить мягкий свет, сделать фон светлее…"
            className="resize-y"
          />
        </div>

        {canUseBackend && conceptId && (
          <div className="text-muted-foreground space-y-1 text-sm">
            {showEstimate && estimating && <p>Рассчитываем стоимость…</p>}
            {errToShow && (
              <p className="text-destructive text-sm" role="alert">
                {errToShow}
              </p>
            )}
            {showEstimate && !estimating && creditsToShow != null && !errToShow && (
              <p>
                Стоимость:{" "}
                <span className="text-foreground font-medium tabular-nums">
                  {creditsToShow}
                </span>{" "}
                ток. · баланс:{" "}
                <span className="text-foreground font-medium tabular-nums">
                  {balanceCredits}
                </span>
              </p>
            )}
            {notEnough && (
              <p>
                Недостаточно токенов.{" "}
                <Link href="/dashboard/billing" className="text-primary underline">
                  Пополнить баланс
                </Link>
              </p>
            )}
          </div>
        )}

        <Button
          type="button"
          onClick={() => void onGenerate()}
          disabled={!canRun || generating}
        >
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Генерируем фото…
            </>
          ) : (
            "Сгенерировать фото"
          )}
        </Button>
        {!canUseBackend && (
          <p className="text-muted-foreground text-xs">
            Сначала дождитесь загрузки фото на сервер и привязки к проекту.
          </p>
        )}

        {genError && (
          <Alert variant="destructive">
            <AlertTitle>Генерация</AlertTitle>
            <AlertDescription>{genError}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="bg-muted/30 space-y-3 rounded-xl border p-4">
            <p className="text-foreground text-sm font-medium">
              {result.status === "COMPLETED" && result.outputUrl
                ? "Готово"
                : "Генерация запущена"}
            </p>
            <p className="text-muted-foreground text-xs">
              Фото с концепциями ·{" "}
              {getUserFacingGenerationStatusFromRaw(result.status)}
              {result.costCredits > 0 ? ` · ${result.costCredits} ток.` : null}
            </p>
            {result.status === "COMPLETED" && result.outputUrl && (
              <div className="space-y-2">
                <div className="bg-background relative max-h-80 overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote URL from generation */}
                  <img
                    src={result.outputUrl}
                    alt="Результат"
                    className="max-h-80 w-full object-contain"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    className="bg-primary text-primary-foreground inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium"
                    href={`/api/generations/${result.generationId}/download`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Скачать
                  </a>
                </div>
                <p className="text-muted-foreground text-xs">
                  Кнопки «Карточка товара» и «Видео» появятся, когда эти сценарии будут готовы.
                </p>
              </div>
            )}
            {(result.status === "QUEUED" ||
              result.status === "PROCESSING" ||
              (result.status === "COMPLETED" && !result.outputUrl)) && (
              <Link
                className="bg-secondary text-secondary-foreground inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium"
                href={`/dashboard/history/${result.generationId}`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Открыть в истории
              </Link>
            )}
            {result.status === "FAILED" && (
              <div className="text-destructive space-y-2 text-sm">
                <p className="font-medium leading-relaxed">
                  {result.errorMessage
                    ? mapGenerationErrorToUserMessage(result.errorMessage) ??
                      "Ошибка генерации. Токены обычно возвращаются — проверьте историю."
                    : "Ошибка генерации. Токены обычно возвращаются — проверьте историю."}
                </p>
                <Link
                  className="text-primary inline-flex font-normal underline-offset-4 hover:underline"
                  href={`/dashboard/history/${result.generationId}`}
                >
                  Открыть в истории
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
