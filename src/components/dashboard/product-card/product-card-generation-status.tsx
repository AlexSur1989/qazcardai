"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserFacingGenerationPollSnapshot } from "@/lib/generation-display";
import type { GenerationStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const SUPPORT_MAILTO = "mailto:support@qazcardai.kz";

type Phase = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "OTHER";

function resolvePhase(status: string): Phase {
  const s = status.toUpperCase();
  if (s === "QUEUED" || s === "CREATED") return "QUEUED";
  if (s === "PROCESSING") return "PROCESSING";
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "FAILED" || s === "BLOCKED" || s === "CANCELLED" || s === "REFUNDED") return "FAILED";
  return "OTHER";
}

const PHASE_COPY: Record<
  Exclude<Phase, "OTHER">,
  { title: string; description: string }
> = {
  QUEUED: {
    title: "Карточка поставлена в очередь",
    description: "Мы начали подготовку. Обычно это занимает 1–3 минуты.",
  },
  PROCESSING: {
    title: "ИИ создаёт карточку",
    description: "Обрабатываем фото и собираем карточку товара.",
  },
  COMPLETED: {
    title: "Карточка готова",
    description: "Результат сохранён в истории. Можно скачать или создать новую карточку.",
  },
  FAILED: {
    title: "Не удалось создать карточку",
    description: "Токены будут возвращены, если генерация не завершилась.",
  },
};

export type ProductCardGenerationStatusProps = {
  snapshot: UserFacingGenerationPollSnapshot;
  pollStale?: boolean;
  onCreateAnother?: () => void;
  onRetry?: () => void;
  showAdminHints?: boolean;
  adminDebug?: Record<string, string | null | undefined>;
};

export function ProductCardGenerationStatusPanel({
  snapshot,
  pollStale = false,
  onCreateAnother,
  onRetry,
  showAdminHints = false,
  adminDebug,
}: ProductCardGenerationStatusProps) {
  const phase = resolvePhase(snapshot.status);
  const copy = phase !== "OTHER" ? PHASE_COPY[phase] : null;
  const [previewBroken, setPreviewBroken] = useState(false);

  const copyPublicLink = useCallback(async () => {
    const url = snapshot.previewUrl;
    if (!url?.trim()) {
      toast.error("Ссылка на файл пока недоступна");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  }, [snapshot.previewUrl]);

  return (
    <Card className="min-w-0 max-w-full border-primary/20 rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {phase === "QUEUED" || phase === "PROCESSING" ? (
            <Loader2 className="text-primary mt-0.5 size-5 shrink-0 animate-spin" aria-hidden />
          ) : null}
          {phase === "COMPLETED" ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          ) : null}
          {phase === "FAILED" ? (
            <AlertCircle className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden />
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-lg">{copy?.title ?? snapshot.statusLabel}</CardTitle>
            {copy?.description ? (
              <p className="text-muted-foreground text-sm">{copy.description}</p>
            ) : null}
            {snapshot.statusHint ? (
              <p className="text-muted-foreground text-xs">{snapshot.statusHint}</p>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {pollStale && (phase === "QUEUED" || phase === "PROCESSING") ? (
          <Alert>
            <AlertDescription>
              Статус временно не обновился. Обновите страницу через минуту.
            </AlertDescription>
          </Alert>
        ) : null}

        {phase === "FAILED" && snapshot.errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Что пошло не так</AlertTitle>
            <AlertDescription>{snapshot.errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {phase === "COMPLETED" ? (
          <div className="space-y-3">
            {snapshot.previewUrl && !previewBroken ? (
              <div className="bg-muted overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={snapshot.previewUrl}
                  alt="Готовая карточка товара"
                  className="mx-auto max-h-[min(70vh,640px)] w-full object-contain"
                  onError={() => setPreviewBroken(true)}
                />
              </div>
            ) : (
              <Alert>
                <AlertDescription>Файл временно недоступен. Попробуйте скачать или откройте историю позже.</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              {snapshot.canDownload && snapshot.downloadUrl ? (
                <a
                  href={snapshot.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ size: "sm" }), "inline-flex gap-2")}
                >
                  <Download className="size-4" />
                  Скачать PNG
                </a>
              ) : null}
              {snapshot.previewUrl ? (
                <Button type="button" variant="outline" size="sm" onClick={() => void copyPublicLink()}>
                  <Copy className="mr-2 size-4" />
                  Скопировать ссылку
                </Button>
              ) : null}
              {onCreateAnother ? (
                <Button type="button" variant="secondary" size="sm" onClick={onCreateAnother}>
                  <RotateCcw className="mr-2 size-4" />
                  Создать ещё одну
                </Button>
              ) : null}
              <Link
                href={`/dashboard/history/${snapshot.id}`}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-2")}
              >
                <ExternalLink className="size-4" />
                Открыть в истории
              </Link>
              <Link
                href="/dashboard/history"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Все генерации
              </Link>
            </div>
          </div>
        ) : null}

        {(phase === "QUEUED" || phase === "PROCESSING") && (
          <div className="space-y-2">
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className={cn(
                  "bg-primary h-full rounded-full transition-all duration-500",
                  phase === "QUEUED" ? "w-1/4 animate-pulse" : "w-2/3 animate-pulse",
                )}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Списано {snapshot.costCredits} токенов · {snapshot.statusLabel}
            </p>
            <Link
              href={`/dashboard/history/${snapshot.id}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2 text-xs")}
            >
              Открыть в истории
            </Link>
          </div>
        )}

        {phase === "FAILED" ? (
          <div className="flex flex-wrap gap-2">
            {onRetry ? (
              <Button type="button" size="sm" onClick={onRetry}>
                Попробовать ещё раз
              </Button>
            ) : null}
            <a
              href={SUPPORT_MAILTO}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Написать в поддержку
            </a>
            <Link
              href="/dashboard/history"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Все генерации
            </Link>
          </div>
        ) : null}

        {showAdminHints && adminDebug ? (
          <details className="border-border/60 border-t pt-3 md:hidden">
            <summary className="text-muted-foreground cursor-pointer text-xs">Admin debug</summary>
            <div className="text-muted-foreground mt-2 space-y-0.5 break-all font-mono text-[10px] leading-relaxed">
              {Object.entries(adminDebug).map(([k, v]) =>
                v ? (
                  <p key={k}>
                    {k}: {v}
                  </p>
                ) : null,
              )}
            </div>
          </details>
        ) : null}
        {showAdminHints && adminDebug ? (
          <div className="border-border/60 hidden space-y-0.5 border-t pt-3 font-mono text-[10px] leading-relaxed text-muted-foreground md:block">
            {Object.entries(adminDebug).map(([k, v]) =>
              v ? (
                <p key={k} className="break-all">
                  {k}: {v}
                </p>
              ) : null,
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Dev-only mock snapshots для проверки UI без Kie (см. ?pcGenMock=). */
export function buildProductCardGenerationMock(
  phase: "queued" | "processing" | "completed" | "failed",
): UserFacingGenerationPollSnapshot {
  const statusMap: Record<typeof phase, GenerationStatus> = {
    queued: "QUEUED",
    processing: "PROCESSING",
    completed: "COMPLETED",
    failed: "FAILED",
  };
  const status = statusMap[phase];
  const base: UserFacingGenerationPollSnapshot = {
    id: "mock-generation-id",
    type: "IMAGE",
    status,
    statusLabel:
      phase === "queued"
        ? "Ожидает"
        : phase === "processing"
          ? "Генерируется"
          : phase === "completed"
            ? "Готово"
            : "Ошибка",
    statusHint: phase === "failed" ? "Токены будут возвращены на баланс" : null,
    scenarioLabel: "Карточка товара",
    kindLabel: "Генерация карточки",
    costCredits: 25,
    previewUrl:
      phase === "completed"
        ? "https://placehold.co/800x800/png?text=Product+Card+Mock"
        : null,
    downloadUrl: phase === "completed" ? "/api/generations/mock/download?index=0" : null,
    canDownload: phase === "completed",
    createdAt: new Date().toISOString(),
    completedAt: phase === "completed" ? new Date().toISOString() : null,
    errorMessage: phase === "failed" ? "Не удалось создать результат. Попробуйте позже." : null,
  };
  return base;
}
