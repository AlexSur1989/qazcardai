"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Upload, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type KlingUploadPurpose =
  | "kling_motion_reference_image"
  | "kling_motion_video";

export type FileUploadPurpose =
  | KlingUploadPurpose
  | "product_card_source"
  | "product_card_source_image";

export type FileUploadCardValue = {
  url: string;
  fileName: string;
  size: number;
} | null;

type Props = {
  title: string;
  description: string;
  buttonLabel: string;
  hint: string;
  accept: string;
  maxSizeMb: number;
  purpose: FileUploadPurpose;
  fileType: "image" | "video";
  value: FileUploadCardValue;
  onUploaded: (payload: {
    url: string;
    fileName: string;
    size: number;
    fileId?: string;
    durationSeconds?: number;
  }) => void;
  onRemove: () => void;
  error?: string | null;
  disabled?: boolean;
};

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/pjpeg",
]);
const IMAGE_EXT = /\.(jpe?g|png)$/i;

const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);
const VIDEO_EXT = /\.(mp4|mov|qt)$/i;

function isValidImageFile(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t && IMAGE_TYPES.has(t)) return true;
  return IMAGE_EXT.test(file.name);
}

function isValidVideoFile(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t && VIDEO_TYPES.has(t)) return true;
  return VIDEO_EXT.test(file.name);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function probeVideoDurationFromFile(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const finish = (sec: number | null) => {
      URL.revokeObjectURL(url);
      resolve(sec);
    };
    v.onloadedmetadata = () => {
      const d = v.duration;
      if (Number.isFinite(d) && d > 0) finish(d);
      else finish(null);
    };
    v.onerror = () => finish(null);
    v.src = url;
  });
}

/**
 * Крупная зона drag-and-drop для файлов (Kling Motion и др.).
 */
export function FileUploadCard({
  title,
  description,
  buttonLabel,
  hint,
  accept,
  maxSizeMb,
  purpose,
  fileType,
  value,
  onUploaded,
  onRemove,
  error: externalError,
  disabled = false,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const maxBytes = maxSizeMb * 1024 * 1024;
  const combinedError = uploadError || externalError || null;

  const validateLocal = useCallback(
    (file: File): string | null => {
      if (fileType === "image") {
        if (!isValidImageFile(file)) {
          return "Фото должно быть PNG, JPG или JPEG.";
        }
        if (file.size > maxBytes) {
          return `Фото должно быть не больше ${maxSizeMb}MB.`;
        }
        return null;
      }
      if (!isValidVideoFile(file)) {
        return "Видео должно быть MP4 или MOV.";
      }
      if (file.size > maxBytes) {
        return `Видео должно быть не больше ${maxSizeMb}MB.`;
      }
      return null;
    },
    [fileType, maxBytes, maxSizeMb],
  );

  const runUpload = useCallback(
    async (file: File) => {
      if (disabled) return;
      setUploadError(null);
      const localErr = validateLocal(file);
      if (localErr) {
        setUploadError(localErr);
        return;
      }
      setUploading(true);
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("purpose", purpose);
        if (purpose === "kling_motion_video") {
          const dur = await probeVideoDurationFromFile(file);
          if (dur == null) {
            setUploadError(
              "Не удалось определить длительность видео. Загрузите другой файл.",
            );
            setUploading(false);
            return;
          }
          form.set("durationSeconds", String(dur));
        }
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const data = (await res.json()) as {
          url?: string;
          error?: string;
          size?: number;
          fileId?: string;
          durationSeconds?: number;
        };
        if (!res.ok) {
          setUploadError(
            typeof data.error === "string" && data.error.trim()
              ? data.error
              : "Не удалось загрузить файл. Попробуйте еще раз.",
          );
          return;
        }
        if (typeof data.url === "string" && data.url) {
          const size =
            typeof data.size === "number" && Number.isFinite(data.size)
              ? data.size
              : file.size;
          onUploaded({
            url: data.url,
            fileName: file.name,
            size,
            fileId: typeof data.fileId === "string" ? data.fileId : undefined,
            durationSeconds:
              typeof data.durationSeconds === "number" && Number.isFinite(data.durationSeconds)
                ? data.durationSeconds
                : undefined,
          });
        } else {
          setUploadError("Не удалось загрузить файл. Попробуйте еще раз.");
        }
      } catch {
        setUploadError("Не удалось загрузить файл. Попробуйте еще раз.");
      } finally {
        setUploading(false);
      }
    },
    [disabled, purpose, onUploaded, validateLocal],
  );

  const onPickClick = useCallback(() => {
    if (!disabled && !uploading) inputRef.current?.click();
  }, [disabled, uploading]);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) void runUpload(file);
    },
    [runUpload],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled || uploading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) void runUpload(file);
    },
    [disabled, uploading, runUpload],
  );

  const hasValue = value != null && value.url;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="space-y-1">
        <h3 className="text-foreground text-base font-semibold leading-tight">
          {title}
        </h3>
        <p className="text-muted-foreground text-sm leading-snug">{description}</p>
      </div>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={onDrop}
        className={cn(
          "focus-visible:ring-ring relative flex min-h-[220px] flex-col rounded-2xl border-2 border-dashed border-primary/30 bg-card p-4 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          isDragging
            ? "border-primary bg-primary/8 shadow-[0_4px_24px_rgba(0,80,100,0.12)]"
            : "hover:border-primary hover:shadow-sm",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={accept}
          disabled={disabled || uploading}
          onChange={onInputChange}
        />

        {uploading && (
          <div className="bg-background/80 absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[calc(1rem-2px)] backdrop-blur-[2px]">
            <Loader2 className="text-primary h-8 w-8 animate-spin" aria-hidden />
            <p className="text-foreground text-sm font-medium">Загружаем…</p>
          </div>
        )}

        {!hasValue && !uploading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
            <div
              className={cn(
                "bg-background/90 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed shadow-sm transition-colors",
                isDragging
                  ? "border-primary text-primary"
                  : "text-muted-foreground border-muted-foreground/40",
              )}
            >
              {fileType === "image" ? (
                <div className="relative">
                  <ImageIcon className="h-9 w-9" strokeWidth={1.2} />
                  <Upload
                    className="text-primary absolute -right-2 -bottom-2 h-5 w-5"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </div>
              ) : (
                <div className="relative">
                  <Video className="h-9 w-9" strokeWidth={1.2} />
                  <Upload
                    className="text-primary absolute -right-2 -bottom-2 h-5 w-5"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </div>
              )}
            </div>
            <div className="max-w-[280px] space-y-2">
              <Button type="button" onClick={onPickClick} disabled={disabled} size="default">
                {buttonLabel}
              </Button>
              <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
            </div>
          </div>
        )}

        {hasValue && !uploading && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {fileType === "image" ? (
              <div className="bg-background/60 relative flex max-h-52 min-h-[120px] flex-1 items-center justify-center overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded preview URL */}
                <img
                  src={value.url}
                  alt={value.fileName}
                  className="max-h-52 w-full object-contain"
                />
              </div>
            ) : (
              <div className="bg-background/60 overflow-hidden rounded-xl border">
                <video
                  src={value.url}
                  className="max-h-48 w-full object-contain"
                  controls
                  playsInline
                  preload="metadata"
                />
              </div>
            )}

            <div className="text-left">
              <p className="text-foreground truncate text-sm font-medium" title={value.fileName}>
                {value.fileName}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatBytes(value.size)} · <span className="text-primary">Загружено</span>
              </p>
            </div>

            <div className="mt-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onPickClick}
                disabled={disabled}
              >
                {fileType === "image" ? "Заменить фото" : "Заменить видео"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setUploadError(null);
                  onRemove();
                }}
                disabled={disabled}
              >
                Удалить
              </Button>
            </div>
          </div>
        )}
      </div>

      {combinedError && (
        <p className="text-destructive text-sm" role="alert">
          {combinedError}
        </p>
      )}
    </div>
  );
}
