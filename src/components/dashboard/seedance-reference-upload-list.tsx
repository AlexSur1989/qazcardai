"use client";

import { useId, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
type Variant = "image" | "video" | "audio";

const UPLOAD_PURPOSE: Record<Variant, string> = {
  image: "seedance_reference_image",
  video: "seedance_reference_video",
  audio: "seedance_reference_audio",
};

const ACCEPT: Record<Variant, string> = {
  image: "image/png,image/jpeg,image/webp,image/gif",
  video: "video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm",
  audio: "audio/mpeg,audio/mp3,audio/wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a",
};

const DEFAULT_MAX: Record<Variant, number> = {
  image: 9,
  video: 3,
  audio: 3,
};

function shortFileLabel(url: string, index: number): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last.length > 0) {
      return decodeURIComponent(last.length > 48 ? `…${last.slice(-40)}` : last);
    }
  } catch {
    /* ignore */
  }
  return `Файл ${index + 1}`;
}

type Props = {
  fieldName: string;
  label: string;
  variant: Variant;
  value: string[];
  onChange: (urls: string[]) => void;
  maxItems?: number;
  disabled?: boolean;
};

/**
 * Список публичных URL для Kie (reference_*_urls), заполняется загрузкой файлов на /api/uploads.
 */
export function SeedanceReferenceUploadList({
  fieldName,
  label,
  variant,
  value,
  onChange,
  maxItems: maxItemsProp,
  disabled = false,
}: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxItems = maxItemsProp ?? DEFAULT_MAX[variant];
  const urls = Array.isArray(value) ? value : [];
  const atLimit = urls.length >= maxItems;

  async function runUpload(file: File) {
    if (disabled || atLimit) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("purpose", UPLOAD_PURPOSE[variant]);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : "Не удалось загрузить файл",
        );
        return;
      }
      if (typeof data.url === "string" && data.url) {
        onChange([...urls, data.url].slice(0, maxItems));
      } else {
        setError("Не удалось получить URL файла");
      }
    } catch {
      setError("Сеть: не удалось загрузить файл");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <span className="text-muted-foreground text-xs">
          {urls.length} / {maxItems}
        </span>
      </div>
      <p className="text-muted-foreground text-xs">
        Файлы загружаются на сервер, в Kie уходит публичная ссылка (как требует API).
      </p>

      <input
        ref={inputRef}
        id={id}
        name={fieldName}
        type="file"
        className="sr-only"
        accept={ACCEPT[variant]}
        disabled={disabled || uploading || atLimit}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void runUpload(f);
        }}
      />

      {urls.length > 0 && (
        <ul className="space-y-1.5 rounded-md border border-border/80 bg-muted/20 p-2">
          {urls.map((url, i) => (
            <li
              key={`${url}-${i}`}
              className="flex min-w-0 items-center justify-between gap-2 text-xs"
            >
              <span
                className="text-foreground min-w-0 flex-1 truncate font-mono"
                title={url}
              >
                {shortFileLabel(url, i)}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
                disabled={disabled || uploading}
                onClick={() => onChange(urls.filter((_, j) => j !== i))}
                aria-label="Удалить"
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={disabled || uploading || atLimit}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Upload className="size-4" aria-hidden />
        )}
        {atLimit ? "Достигнут лимит файлов" : "Добавить файл с компьютера"}
      </Button>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function isSeedanceUploadListField(type: string | undefined): type is
  | "image-upload-list"
  | "video-upload-list"
  | "audio-upload-list" {
  return (
    type === "image-upload-list" ||
    type === "video-upload-list" ||
    type === "audio-upload-list"
  );
}

export function uploadListFieldVariant(
  type: "image-upload-list" | "video-upload-list" | "audio-upload-list",
): Variant {
  if (type === "image-upload-list") return "image";
  if (type === "video-upload-list") return "video";
  return "audio";
}
