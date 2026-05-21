"use client";

import { useId, useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PURPOSE = "seedance_reference_image";
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,.jpg,.jpeg,.png,.webp";

type Props = {
  fieldName: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  disabled?: boolean;
};

function fileLabel(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return decodeURIComponent(last.length > 40 ? `…${last.slice(-36)}` : last);
  } catch {
    /* ignore */
  }
  return "Загружено";
}

/**
 * Один кадр: загрузка файла для генерации.
 */
export function SeedanceSingleImageUpload({
  fieldName,
  label,
  value,
  onChange,
  hint = "JPEG, PNG или WebP до 10 МБ",
  disabled = false,
}: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const hasUrl = typeof value === "string" && value.trim().length > 0;

  async function runUpload(file: File) {
    if (disabled) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("purpose", PURPOSE);
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
        onChange(data.url);
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
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {hint ? (
        <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
      ) : null}

      <input
        ref={inputRef}
        id={id}
        name={fieldName}
        type="file"
        className="sr-only"
        accept={ACCEPT}
        disabled={disabled || uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void runUpload(f);
        }}
      />

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
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (disabled || uploading) return;
          const f = e.dataTransfer.files?.[0];
          if (f) void runUpload(f);
        }}
        className={cn(
          "relative flex min-h-[140px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors",
          drag ? "border-primary bg-primary/5" : "border-primary/30 bg-muted/20",
          (disabled || uploading) && "pointer-events-none opacity-60",
        )}
      >
        {uploading && (
          <div className="bg-background/70 absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[calc(0.75rem-2px)] backdrop-blur-[2px]">
            <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
            <p className="text-sm font-medium">Загрузка…</p>
          </div>
        )}

        {!hasUrl && !uploading ? (
          <>
            <div className="text-muted-foreground flex flex-col items-center gap-1">
              <ImageIcon className="size-10 stroke-[1.25]" />
              <p className="text-center text-sm">
                Перетащите изображение сюда или нажмите кнопку
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-2 size-4" aria-hidden />
              Выберите файл
            </Button>
          </>
        ) : (
          !uploading && (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <div className="bg-background/80 relative max-h-28 min-h-[100px] min-w-0 flex-1 overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element -- превью загрузки */}
                <img
                  src={value}
                  alt="Превью кадра"
                  className="mx-auto max-h-28 w-full object-contain"
                />
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <p className="text-foreground max-w-[220px] truncate text-xs font-medium">
                  {fileLabel(value)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => inputRef.current?.click()}
                  >
                    Заменить
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => onChange("")}
                    aria-label="Удалить"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
