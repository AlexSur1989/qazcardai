"use client";

import Link from "next/link";
import { Download, ExternalLink, Film, RefreshCw, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getProductCardTemplatePreset } from "@/config/product-card-overlay-presets";
import { mapGenerationErrorToUserMessage } from "@/lib/generation-display";

export type ProductCardVariantGalleryItem = {
  generationId: string;
  status: string;
  costCredits: number;
  outputUrl: string | null;
  errorMessage?: string | null;
  templatePreset?: string;
  templateLayoutKey?: string;
  typographyPreset?: string;
  variantIndex: number;
};

export function ProductCardVariantGallery({
  items,
  onEditText,
  onCreateSimilar,
}: {
  items: ProductCardVariantGalleryItem[];
  onEditText?: (item: ProductCardVariantGalleryItem) => void;
  onCreateSimilar?: (item: ProductCardVariantGalleryItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[#0C2D38]">Витрина вариантов</h3>
        <p className="text-xs text-[#4a6e7a]">Выберите лучший вариант, скачайте или используйте как основу для видео.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => {
          const template = getProductCardTemplatePreset(item.templatePreset);
          const isDone = item.status === "COMPLETED" && item.outputUrl;
          const isFailed = item.status === "FAILED" || item.status === "REFUNDED" || item.status === "CANCELLED" || item.status === "BLOCKED";
          const hasRealGeneration = Boolean(item.generationId) && !item.generationId.startsWith("failed-");
          return (
            <div key={item.generationId} className="space-y-3 rounded-2xl border border-[#B8DCE6] bg-white/90 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#0C2D38]">{template.label}</p>
                  <p className="font-mono text-[11px] text-[#4a6e7a]">
                    #{item.variantIndex + 1} · {item.status} · {item.costCredits} ток.
                  </p>
                </div>
                <span className="rounded-full bg-[#e8f8fb] px-2 py-1 text-[11px] text-[#006b82]">
                  {isDone ? "Готово" : isFailed ? "Ошибка" : "В работе"}
                </span>
              </div>
              {isDone ? (
                <div className="max-h-96 overflow-hidden rounded-xl border border-[#B8DCE6] bg-[#F4FBFD]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- generated media URL */}
                  <img src={item.outputUrl!} alt="Карточка товара" className="max-h-96 w-full object-contain" />
                </div>
              ) : (
                <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed border-[#B8DCE6] bg-[#F4FBFD] text-sm text-[#4a6e7a]">
                  {isFailed
                    ? mapGenerationErrorToUserMessage(item.errorMessage) ??
                      "Вариант не создан"
                    : hasRealGeneration
                      ? "Ожидаем результат генерации…"
                      : "Ещё не запущено"}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <a
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  href={hasRealGeneration ? `/api/generations/${item.generationId}/download` : "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!isDone || !hasRealGeneration}
                  onClick={(e) => {
                    if (!isDone || !hasRealGeneration) e.preventDefault();
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Скачать
                </a>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-[#B8DCE6]"
                  disabled={!hasRealGeneration}
                  onClick={() => onEditText?.(item)}
                >
                  <Type className="mr-1 h-3.5 w-3.5" />
                  Редактировать текст
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-[#B8DCE6]"
                  disabled={!hasRealGeneration}
                  onClick={() => onCreateSimilar?.(item)}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  Создать похожую
                </Button>
                <Link
                  className={
                    hasRealGeneration
                      ? "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#B8DCE6] bg-white px-3 text-sm font-medium text-[#0C2D38]"
                      : "pointer-events-none inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#B8DCE6]/50 bg-[#f4f8fa] px-3 text-sm font-medium text-[#4a6e7a]"
                  }
                  href={hasRealGeneration ? `/dashboard/create/product-card?videoSource=${encodeURIComponent(item.generationId)}` : "#"}
                  aria-disabled={!hasRealGeneration}
                  onClick={(e) => {
                    if (!hasRealGeneration) e.preventDefault();
                  }}
                >
                  <Film className="h-3.5 w-3.5" />
                  Для видео
                </Link>
                <Link
                  className={
                    hasRealGeneration
                      ? "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#B8DCE6] bg-white px-3 text-sm font-medium text-[#0C2D38]"
                      : "pointer-events-none inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#B8DCE6]/50 bg-[#f4f8fa] px-3 text-sm font-medium text-[#4a6e7a]"
                  }
                  href={hasRealGeneration ? `/dashboard/history/${item.generationId}` : "#"}
                  aria-disabled={!hasRealGeneration}
                  onClick={(e) => {
                    if (!hasRealGeneration) e.preventDefault();
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  История
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
