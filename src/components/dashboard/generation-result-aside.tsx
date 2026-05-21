"use client";

import Link from "next/link";
import { ExternalLink, ImageIcon, Loader2, Video } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserFacingGenerationStatusFromRaw } from "@/lib/generation-display";
import { parseOutputFilesList } from "@/lib/generation-output-utils";
import { cn } from "@/lib/utils";

type ModelKind = "VIDEO" | "IMAGE";

function statusLabel(s: string | null): string {
  if (!s) return "—";
  return getUserFacingGenerationStatusFromRaw(s);
}

function previewMode(
  kind: ModelKind,
  files: ReturnType<typeof parseOutputFilesList>,
): "video" | "image" | "none" {
  const f = files[0];
  if (!f?.url?.trim()) return "none";
  const u = f.url.toLowerCase();
  const ct = f.contentType?.toLowerCase() ?? "";
  if (ct.startsWith("video/")) return "video";
  if (ct.startsWith("image/")) return "image";
  if (/\.(mp4|webm|mov|m3u8)(\?|#|$)/i.test(u)) return "video";
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(u)) return "image";
  return kind === "VIDEO" ? "video" : "image";
}

type Props = {
  modelKind: ModelKind;
  generationId: string | null;
  status: string | null;
  errorMessage: string | null;
  outputFiles: unknown;
  providerTaskId?: string | null;
  submitting?: boolean;
  className?: string;
};

/**
 * Превью результата генерации в боковой колонке (создание видео/изображения).
 */
export function GenerationResultAside({
  modelKind,
  generationId,
  status,
  errorMessage,
  outputFiles,
  providerTaskId,
  submitting = false,
  className,
}: Props) {
  const files = parseOutputFilesList(outputFiles);
  const firstUrl = files[0]?.url?.trim() ?? null;
  const mode = previewMode(modelKind, files);
  const inProgress =
    !(
      status === "COMPLETED" ||
      status === "FAILED" ||
      status === "REFUNDED" ||
      status === "CANCELLED" ||
      status === "BLOCKED"
    ) &&
    generationId &&
    (status === "CREATED" ||
      status === "QUEUED" ||
      status === "PROCESSING" ||
      !status);

  return (
    <Card className={cn("border-border/80", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Результат</CardTitle>
        <CardDescription className="text-xs">
          Здесь появляется статус и превью после отправки задачи.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {submitting && (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            Отправка запроса…
          </div>
        )}

        {!generationId && !submitting && (
          <div className="text-muted-foreground flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-xs">
            {modelKind === "VIDEO" ? (
              <Video className="size-8 opacity-40" strokeWidth={1.25} />
            ) : (
              <ImageIcon className="size-8 opacity-40" strokeWidth={1.25} />
            )}
            <p>Заполните форму и нажмите «Сгенерировать» — превью появится здесь.</p>
          </div>
        )}

        {generationId && (
          <>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Статус</p>
              <p className="font-medium">{statusLabel(status)}</p>
              {errorMessage ? (
                <p className="text-destructive text-xs leading-snug">{errorMessage}</p>
              ) : null}
            </div>

            {providerTaskId ? (
              <p className="text-muted-foreground text-xs break-all">
                task: <span className="font-mono">{providerTaskId}</span>
              </p>
            ) : null}

            {inProgress && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                Ожидаем файл результата (обновление каждые 3 с)…
              </div>
            )}

            {firstUrl && status === "COMPLETED" && (
              <div className="bg-muted/30 overflow-hidden rounded-lg border">
                {mode === "video" ? (
                  <video
                    src={firstUrl}
                    className="aspect-video w-full object-contain"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- URL результата генерации
                  <img
                    src={firstUrl}
                    alt="Результат"
                    className="max-h-64 w-full object-contain"
                  />
                )}
              </div>
            )}

            {status === "COMPLETED" && files.length > 1 && (
              <p className="text-muted-foreground text-xs">
                + ещё {files.length - 1}{" "}
                {modelKind === "VIDEO" ? "файл(а)" : "изображ."}
              </p>
            )}

            {status === "COMPLETED" && files.length > 0 && (
              <div className="flex flex-col gap-2">
                {files.map((f, i) => (
                  <div
                    key={`${f.url ?? i}-${i}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    {f.url ? (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "text-xs",
                        )}
                      >
                        <ExternalLink className="size-3.5" />
                        Открыть {files.length > 1 ? `#${i + 1}` : "результат"}
                      </a>
                    ) : null}
                    {generationId && f.url && (
                      <a
                        href={`/api/generations/${generationId}/download?index=${i}`}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonVariants({ variant: "secondary", size: "sm" }),
                          "text-xs",
                        )}
                      >
                        Скачать
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="border-border flex flex-col gap-1 border-t pt-3 text-xs">
              <Link
                href={`/dashboard/history/${generationId}`}
                className="text-primary font-medium underline"
              >
                Открыть в истории
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
