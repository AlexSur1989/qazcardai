"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { compressProductCardImage } from "@/lib/compress-product-card-image";

export type SourceImageValue = {
  url: string;
  fileName: string;
  size: number;
  fileId?: string;
  isLocalPreview?: boolean;
} | null;

/** П.7: состояния блока загрузки */
export type UploadFlowState = "idle" | "uploading" | "uploaded" | "error";

type UploadPhase = "idle" | "preparing" | "uploading";

const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidImage(file: File): boolean {
  const t = file.type.toLowerCase();
  if (
    t === "image/jpeg" ||
    t === "image/jpg" ||
    t === "image/png" ||
    t === "image/webp" ||
    t === "image/pjpeg"
  )
    return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function revokeBlobUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
}

type Props = {
  value: SourceImageValue;
  onChange: (v: SourceImageValue) => void;
  disabled?: boolean;
  /** Сообщает родителю о этапе: idle / uploading / uploaded / error */
  onUploadFlowChange?: (state: UploadFlowState) => void;
  /** purpose для POST /api/uploads */
  uploadPurpose?: "product_card_source_image";
  title?: string;
  description?: string;
  /** Сохранение URL/fileId в проект после upload */
  projectSaving?: boolean;
  /** Отдельный статус распознавания (Vision) — не смешивать с upload */
  recognitionLoading?: boolean;
};

/**
 * Исходное фото: POST /api/uploads, purpose `product_card_source_image`.
 * Перед отправкой — сжатие на клиенте; превью показывается сразу из blob.
 */
export function SourceImageUpload({
  value,
  onChange,
  disabled = false,
  onUploadFlowChange,
  uploadPurpose = "product_card_source_image",
  title = "Загрузите фото товара",
  description = "Это фото будет использоваться для определения категории и как основа для генерации.",
  projectSaving = false,
  recognitionLoading = false,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewBlobRef = useRef<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [localPreview, setLocalPreview] = useState<SourceImageValue>(null);
  const [err, setErr] = useState<string | null>(null);
  const [compressionHint, setCompressionHint] = useState<string | null>(null);

  const uploading = uploadPhase !== "idle";

  const emitFlow = useCallback(
    (s: UploadFlowState) => {
      onUploadFlowChange?.(s);
    },
    [onUploadFlowChange],
  );

  useEffect(() => {
    if (value?.fileId && !value.isLocalPreview) {
      emitFlow("uploaded");
    }
  }, [value?.fileId, value?.isLocalPreview, value?.url, emitFlow]);

  useEffect(() => {
    return () => {
      revokeBlobUrl(previewBlobRef.current);
    };
  }, []);

  const clearLocalPreview = useCallback(() => {
    revokeBlobUrl(previewBlobRef.current);
    previewBlobRef.current = null;
    setLocalPreview(null);
  }, []);

  const run = useCallback(
    async (file: File) => {
      setErr(null);
      setCompressionHint(null);
      if (!isValidImage(file)) {
        const msg = "Нужен файл PNG, JPG, JPEG или WebP.";
        setErr(msg);
        emitFlow("error");
        return;
      }
      if (file.size > MAX_BYTES) {
        setErr(`Файл больше ${MAX_MB} МБ.`);
        emitFlow("error");
        return;
      }

      clearLocalPreview();
      const blobUrl = URL.createObjectURL(file);
      previewBlobRef.current = blobUrl;
      setLocalPreview({
        url: blobUrl,
        fileName: file.name,
        size: file.size,
        isLocalPreview: true,
      });

      setUploadPhase("preparing");
      emitFlow("uploading");
      try {
        const compressed = await compressProductCardImage(file);
        if (compressed.wasCompressed) {
          setCompressionHint(
            `Сжали ${formatBytes(compressed.originalSize)} → ${formatBytes(compressed.compressedSize)} перед отправкой`,
          );
          setLocalPreview((prev) =>
            prev
              ? {
                  ...prev,
                  size: compressed.compressedSize,
                  fileName: compressed.file.name,
                }
              : prev,
          );
        }

        setUploadPhase("uploading");
        const form = new FormData();
        form.set("file", compressed.file);
        form.set("purpose", uploadPurpose);
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const data = (await res.json()) as {
          url?: string;
          error?: string;
          size?: number;
          fileId?: string;
        };
        if (res.ok && typeof data.url === "string" && data.url) {
          const size =
            typeof data.size === "number" && Number.isFinite(data.size)
              ? data.size
              : compressed.compressedSize;
          clearLocalPreview();
          onChange({
            url: data.url,
            fileName: compressed.file.name,
            size,
            fileId: typeof data.fileId === "string" ? data.fileId : undefined,
            isLocalPreview: false,
          });
          emitFlow("uploaded");
          return;
        }
        const serverMsg =
          data.error ||
          (res.status === 503 ? "Storage is not configured" : "Не удалось загрузить файл");
        setErr(serverMsg);
        emitFlow("error");
      } catch {
        setErr("Нет сети или сервер недоступен. Повторите попытку.");
        emitFlow("error");
      } finally {
        setUploadPhase("idle");
      }
    },
    [clearLocalPreview, emitFlow, onChange, uploadPurpose],
  );

  const onPick = () => {
    if (!disabled && !uploading) inputRef.current?.click();
  };

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void run(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void run(file);
  };

  const remove = () => {
    clearLocalPreview();
    onChange(null);
    setErr(null);
    setCompressionHint(null);
    emitFlow("idle");
  };

  const displayValue = localPreview ?? value;
  const has = displayValue != null && displayValue.url;
  const isServerUploaded = Boolean(value?.fileId && !value.isLocalPreview && !uploading);

  const statusLine = (() => {
    if (uploadPhase === "preparing") return "Подготавливаем фото…";
    if (uploadPhase === "uploading") return "Загружаем на сервер…";
    if (projectSaving) return "Сохраняем фото в проект…";
    if (recognitionLoading && isServerUploaded) return "Фото на сервере · распознаём товар…";
    if (isServerUploaded) return "Фото загружено на сервер";
    if (displayValue?.isLocalPreview && !uploading) return "Превью в браузере";
    if (!has && !uploading) return "Ожидание файла";
    return null;
  })();

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-foreground text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>

      {statusLine ? (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {statusLine}
        </p>
      ) : null}
      {compressionHint && !err ? (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {compressionHint}
        </p>
      ) : null}

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDrag(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={onDrop}
        className={cn(
          "focus-visible:ring-ring relative flex min-h-[240px] flex-col rounded-2xl border-2 border-dashed border-primary/30 bg-card p-5 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          drag
            ? "border-primary bg-primary/8 shadow-[0_4px_24px_rgba(0,80,100,0.1)]"
            : "hover:border-primary hover:bg-white hover:shadow-sm",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPT}
          disabled={disabled || uploading}
          onChange={onInput}
        />
        {uploading && (
          <div className="bg-background/85 absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[calc(1rem-2px)] backdrop-blur-[1px]">
            <Loader2 className="text-primary h-9 w-9 animate-spin" />
            <p className="text-sm font-medium">
              {uploadPhase === "preparing" ? "Подготавливаем…" : "Загружаем…"}
            </p>
          </div>
        )}

        {!has && !uploading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
            <div
              className={cn(
                "bg-background/90 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed shadow-sm",
                drag ? "border-primary text-primary" : "text-muted-foreground border-muted-foreground/40",
              )}
            >
              <div className="relative">
                <ImageIcon className="h-9 w-9" strokeWidth={1.2} />
                <Upload
                  className="text-primary absolute -right-2 -bottom-2 h-5 w-5"
                  strokeWidth={2.5}
                />
              </div>
            </div>
            <Button type="button" onClick={onPick} size="lg">
              Выбрать фото
            </Button>
            <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">
              PNG, JPG, JPEG или WebP до 10MB. Большие фото автоматически сжимаются перед
              отправкой.
            </p>
          </div>
        )}

        {has && !uploading && (
          <div className="flex min-h-0 flex-col gap-4">
            <div className="bg-background/60 relative max-h-72 min-h-[140px] overflow-hidden rounded-xl border">
              {/* eslint-disable-next-line @next/next/no-img-element -- user preview blob or S3 url */}
              <img
                src={displayValue.url}
                alt={displayValue.fileName}
                className="max-h-72 w-full object-contain"
              />
              {recognitionLoading && isServerUploaded ? (
                <div className="bg-background/75 absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 py-2 text-xs">
                  <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />
                  <span>Распознаём товар…</span>
                </div>
              ) : null}
            </div>
            <div>
              <p className="text-foreground truncate text-sm font-medium" title={displayValue.fileName}>
                {displayValue.fileName}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatBytes(displayValue.size)}
                {displayValue.isLocalPreview ? " · превью" : " · на сервере"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={onPick} size="default" disabled={projectSaving}>
                Заменить фото
              </Button>
              <Button type="button" variant="outline" onClick={remove} size="default">
                Удалить
              </Button>
            </div>
          </div>
        )}
      </div>
      {err && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
