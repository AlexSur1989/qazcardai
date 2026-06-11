"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SourceImageRole = "main" | "side" | "back" | "detail";

export type ProductSourceImageValue = {
  url: string;
  fileName: string;
  size: number;
  fileId?: string;
  role: SourceImageRole;
  order: number;
  isLocalPreview?: boolean;
};

export type SourceImagesValue = ProductSourceImageValue[];

export type UploadFlowState = "idle" | "uploading" | "uploaded" | "error";

const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";

const SLOTS: Array<{
  role: SourceImageRole;
  order: number;
  title: string;
  hint: string;
}> = [
  { role: "main", order: 0, title: "Главное фото", hint: "Обязательно" },
  { role: "side", order: 1, title: "Вид сбоку", hint: "Опционально" },
  { role: "back", order: 2, title: "Вид сзади", hint: "Опционально" },
  { role: "detail", order: 3, title: "Детали", hint: "Опционально" },
];

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
  ) {
    return true;
  }
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

type SlotInputProps = {
  slot: (typeof SLOTS)[number];
  value: ProductSourceImageValue | null;
  disabled: boolean;
  uploading: boolean;
  canRemove: boolean;
  onPick: (slot: (typeof SLOTS)[number], file: File) => void;
  onRemove: (slot: (typeof SLOTS)[number]) => void;
};

function SourceImageSlot({
  slot,
  value,
  disabled,
  uploading,
  canRemove,
  onPick,
  onRemove,
}: SlotInputProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const choose = () => {
    if (!disabled && !uploading) inputRef.current?.click();
  };

  const handleFile = (file: File | undefined) => {
    if (file) onPick(slot, file);
  };

  return (
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
        handleFile(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        "relative w-full min-w-0 max-w-full rounded-xl border border-dashed bg-card p-2.5 transition-all sm:p-3",
        drag
          ? "border-primary bg-primary/8"
          : "border-primary/25 hover:border-primary/60 hover:bg-white",
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
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          handleFile(file);
        }}
      />

      {uploading && (
        <div className="bg-background/85 absolute inset-0 z-10 flex items-center justify-center rounded-[calc(0.75rem-1px)] backdrop-blur-[1px]">
          <Loader2 className="text-primary h-5 w-5 animate-spin" />
        </div>
      )}

      <div className="flex min-w-0 flex-col items-stretch gap-2.5">
        <button
          type="button"
          onClick={choose}
          disabled={disabled || uploading}
          className="bg-background relative mx-auto flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-muted-foreground sm:h-[72px] sm:w-[72px]"
        >
          {value?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded product source preview
            <img src={value.url} alt={slot.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-0.5">
              <ImageIcon className="h-5 w-5" strokeWidth={1.3} />
              <Upload className="text-primary h-3.5 w-3.5" />
            </div>
          )}
        </button>
        <div className="min-w-0 space-y-1 text-center">
          <div>
            <p className="text-foreground text-xs leading-snug font-semibold">{slot.title}</p>
            <p className="text-muted-foreground text-[11px] leading-snug">{slot.hint}</p>
          </div>
          {value ? (
            <p className="text-muted-foreground truncate text-[10px]">
              {value.fileName} · {formatBytes(value.size)}
            </p>
          ) : (
            <p className="text-muted-foreground text-[10px] leading-snug">PNG/JPG/WebP · {MAX_MB}MB</p>
          )}
          <div className="flex flex-wrap justify-center gap-1 pt-0.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={choose}
            >
              {value ? "Заменить" : "Загрузить"}
            </Button>
            {value ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!canRemove}
                onClick={() => onRemove(slot)}
                title={!canRemove ? "Главное фото обязательно" : undefined}
              >
                <Trash2 className="mr-0.5 h-3 w-3" />
                Удалить
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = {
  value: SourceImagesValue;
  onChange: (v: SourceImagesValue) => void | Promise<void>;
  disabled?: boolean;
  onUploadFlowChange?: (state: UploadFlowState) => void;
};

export function SourceImagesUpload({
  value,
  onChange,
  disabled = false,
  onUploadFlowChange,
}: Props) {
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const byRole = new Map(value.map((img) => [img.role, img]));
  const uploadedCount = value.filter((img) => img.url).length;

  const emitFlow = useCallback(
    (state: UploadFlowState) => {
      onUploadFlowChange?.(state);
    },
    [onUploadFlowChange],
  );

  const runUpload = useCallback(
    async (slot: (typeof SLOTS)[number], file: File) => {
      setErr(null);
      if (!isValidImage(file)) {
        const msg = "Нужен файл PNG, JPG, JPEG или WebP.";
        setErr(msg);
        emitFlow("error");
        return;
      }
      if (file.size > MAX_BYTES) {
        const msg = `Файл больше ${MAX_MB} МБ.`;
        setErr(msg);
        emitFlow("error");
        return;
      }
      setUploadingSlot(slot.order);
      emitFlow("uploading");
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("purpose", "product_card_source_image");
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const data = (await res.json()) as {
          url?: string;
          error?: string;
          size?: number;
          fileId?: string;
        };
        if (!res.ok || typeof data.url !== "string" || !data.url) {
          throw new Error(data.error ?? "Не удалось загрузить файл");
        }
        const nextImage: ProductSourceImageValue = {
          url: data.url,
          fileName: file.name,
          size:
            typeof data.size === "number" && Number.isFinite(data.size)
              ? data.size
              : file.size,
          fileId: typeof data.fileId === "string" ? data.fileId : undefined,
          role: slot.role,
          order: slot.order,
          isLocalPreview: false,
        };
        const next = [
          ...value.filter((img) => img.role !== slot.role),
          nextImage,
        ].sort((a, b) => a.order - b.order);
        await onChange(next);
        emitFlow("uploaded");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Нет сети или сервер недоступен.";
        setErr(msg);
        emitFlow("error");
      } finally {
        setUploadingSlot(null);
      }
    },
    [emitFlow, onChange, value],
  );

  const removeSlot = useCallback(
    async (slot: (typeof SLOTS)[number]) => {
      if (slot.role === "main" && value.length > 1) {
        setErr("Главное фото обязательно. Сначала удалите дополнительные фото или замените главное.");
        return;
      }
      const next = value.filter((img) => img.role !== slot.role);
      await onChange(next);
      emitFlow(next.length > 0 ? "uploaded" : "idle");
    },
    [emitFlow, onChange, value],
  );

  return (
    <div className="min-w-0 max-w-full space-y-3">
      <div>
        <h2 className="text-foreground text-base font-semibold tracking-tight sm:text-lg">
          Загрузите фото товара
        </h2>
        <p className="text-muted-foreground mt-1 text-xs leading-snug sm:text-sm">
          До 4 ракурсов. Главное фото — основа для всех сценариев; дополнительные помогают AI
          точнее сохранить форму и детали.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">Загружено {uploadedCount} из 4</p>
        {uploadedCount === 0 ? (
          <p className="text-destructive text-xs">Главное фото обязательно</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SLOTS.map((slot) => (
          <SourceImageSlot
            key={slot.role}
            slot={slot}
            value={byRole.get(slot.role) ?? null}
            disabled={disabled}
            uploading={uploadingSlot === slot.order}
            canRemove={slot.role !== "main" || value.length <= 1}
            onPick={(s, file) => void runUpload(s, file)}
            onRemove={(s) => void removeSlot(s)}
          />
        ))}
      </div>

      {err ? (
        <p className="text-destructive text-sm" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
