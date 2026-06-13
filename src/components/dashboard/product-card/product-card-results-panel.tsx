"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Film, ImageIcon, Loader2, Video } from "lucide-react";

import { LabelWithInfoTooltip } from "@/components/ui/info-tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readJsonSafe } from "@/lib/fetch-json-safe";
import { getFirstOutputPreviewUrl } from "@/lib/generation-output-utils";
import { getUserFacingGenerationStatusFromRaw } from "@/lib/generation-display";
import {
  formatProjectResultDate,
  parseProjectResultRefs,
  PROJECT_RESULT_KIND_LABEL,
  type ProjectResultKind,
  type ProjectResultRef,
} from "@/lib/product-card-project-results";
import { cn } from "@/lib/utils";

export type VideoSourcePick = {
  sourceType: "concept_generation" | "marketplace_card_generation";
  sourceGenerationId: string;
};

type GenRow = {
  status: string;
  outputUrl: string | null;
  isVideo: boolean;
};

type Props = {
  projectId: string | null;
  refreshKey?: number;
  onUseForVideo?: (pick: VideoSourcePick) => void;
};

function isVideoOutput(contentType: unknown, url: string | null): boolean {
  if (typeof contentType === "string" && contentType.startsWith("video/")) return true;
  if (url && /\.(mp4|webm|mov)(\?|$)/i.test(url)) return true;
  return false;
}

async function fetchGenerationPreview(id: string): Promise<GenRow | null> {
  const res = await fetch(`/api/generations/${id}`);
  const parsed = await readJsonSafe<{ status: string; outputFiles: unknown }>(res);
  if (!parsed.ok || !res.ok) return null;
  const outputUrl = getFirstOutputPreviewUrl(parsed.data.outputFiles);
  let contentType: unknown;
  if (Array.isArray(parsed.data.outputFiles) && parsed.data.outputFiles[0]) {
    const first = parsed.data.outputFiles[0];
    if (first && typeof first === "object" && "contentType" in first) {
      contentType = (first as { contentType: unknown }).contentType;
    }
  }
  return {
    status: parsed.data.status,
    outputUrl,
    isVideo: isVideoOutput(contentType, outputUrl),
  };
}

function ResultItemCard({
  refItem,
  preview,
  loading,
  onUseForVideo,
}: {
  refItem: ProjectResultRef;
  preview: GenRow | null | undefined;
  loading: boolean;
  onUseForVideo?: (pick: VideoSourcePick) => void;
}) {
  const label = PROJECT_RESULT_KIND_LABEL[refItem.kind];
  const dateLabel = formatProjectResultDate(refItem.createdAt);
  const status = preview?.status ?? "…";
  const statusLabel = getUserFacingGenerationStatusFromRaw(status);
  const outputUrl = preview?.outputUrl ?? null;
  const isComplete = status === "COMPLETED" && Boolean(outputUrl);
  const isProcessing = status === "QUEUED" || status === "PROCESSING";
  const canUseForVideo =
    Boolean(onUseForVideo) &&
    refItem.videoSourceType &&
    refItem.kind !== "video" &&
    isComplete;

  return (
    <article
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-[#B8DCE6] bg-white shadow-sm",
        isProcessing && "opacity-90",
      )}
    >
      <div className="relative flex aspect-[4/3] items-center justify-center bg-[#F4FBFD]">
        {loading ? (
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        ) : isComplete && outputUrl ? (
          refItem.kind === "video" || preview?.isVideo ? (
            <video
              src={outputUrl}
              className="max-h-full max-w-full object-contain"
              controls
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- generation preview
            <img src={outputUrl} alt="" className="max-h-full max-w-full object-contain" />
          )
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-1 px-2 text-center text-xs">
            {refItem.kind === "video" ? (
              <Film className="size-8 opacity-40" />
            ) : (
              <ImageIcon className="size-8 opacity-40" />
            )}
            <span>{statusLabel}</span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#0C2D38]">{label}</p>
          <p className="text-muted-foreground text-xs">
            {dateLabel ? dateLabel : "—"}
            {refItem.kind === "video" && refItem.duration ? ` · ${refItem.duration} сек` : null}
            {!isComplete ? ` · ${statusLabel}` : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={`/dashboard/history/${refItem.generationId}`}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[#B8DCE6] px-2.5 text-xs font-medium text-[#0C2D38] hover:bg-[#F4FBFD]"
          >
            <ExternalLink className="size-3.5" />
            Открыть
          </Link>
          {isComplete && outputUrl ? (
            <a
              href={`/api/generations/${refItem.generationId}/download`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-[#B8DCE6] px-2.5 text-xs font-medium text-[#0C2D38] hover:bg-[#F4FBFD]"
            >
              <Download className="size-3.5" />
              Скачать
            </a>
          ) : null}
          {canUseForVideo && refItem.videoSourceType ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 px-2.5 text-xs"
              onClick={() =>
                onUseForVideo?.({
                  sourceType: refItem.videoSourceType!,
                  sourceGenerationId: refItem.generationId,
                })
              }
            >
              <Video className="mr-1 size-3.5" />
              Для видео
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ResultSection({
  title,
  items,
  previews,
  loadingIds,
  onUseForVideo,
  kind,
}: {
  title: string;
  items: ProjectResultRef[];
  previews: Record<string, GenRow | null | undefined>;
  loadingIds: Set<string>;
  onUseForVideo?: (pick: VideoSourcePick) => void;
  kind: ProjectResultKind;
}) {
  if (items.length === 0) return null;
  return (
    <section className="min-w-0 space-y-2">
      <h4 className="text-sm font-semibold text-[#0C2D38]">{title}</h4>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <ResultItemCard
            key={item.key}
            refItem={item}
            preview={previews[item.generationId]}
            loading={loadingIds.has(item.generationId)}
            onUseForVideo={kind === "video" ? undefined : onUseForVideo}
          />
        ))}
      </div>
    </section>
  );
}

export function ProductCardResultsPanel({ projectId, refreshKey = 0, onUseForVideo }: Props) {
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [previews, setPreviews] = useState<Record<string, GenRow | null>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [metaLoading, setMetaLoading] = useState(false);

  const grouped = useMemo(() => parseProjectResultRefs(metadata), [metadata]);

  const allRefs = useMemo(
    () => [...grouped.cards, ...grouped.concepts, ...grouped.videos],
    [grouped],
  );

  const loadMetadata = useCallback(async () => {
    if (!projectId) {
      setMetadata({});
      return;
    }
    setMetaLoading(true);
    const res = await fetch(`/api/product-card-projects/${projectId}`);
    const parsed = await readJsonSafe<{ project?: { metadata?: unknown } }>(res);
    if (parsed.ok && res.ok) {
      const raw = parsed.data.project?.metadata;
      setMetadata(
        raw && typeof raw === "object" && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {},
      );
    }
    setMetaLoading(false);
  }, [projectId]);

  const loadPreviews = useCallback(async (refs: ProjectResultRef[]) => {
    if (refs.length === 0) {
      setPreviews({});
      setLoadingIds(new Set());
      return;
    }
    const ids = refs.map((r) => r.generationId);
    setLoadingIds(new Set(ids));
    const next: Record<string, GenRow | null> = {};
    await Promise.all(
      ids.map(async (id) => {
        next[id] = await fetchGenerationPreview(id);
      }),
    );
    setPreviews(next);
    setLoadingIds(new Set());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadMetadata();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMetadata, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadPreviews(allRefs);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [allRefs, loadPreviews, refreshKey]);

  const hasResults = allRefs.length > 0;

  return (
    <Card className="min-w-0 max-w-full border-primary/15">
      <CardHeader className="grid-rows-none flex flex-col gap-1.5 pb-3">
        <CardTitle className="text-base">
          <LabelWithInfoTooltip
            label="Результаты товара"
            tooltip="Здесь собраны созданные изображения и видео по текущему товару. Вы можете открыть результат, скачать его или использовать изображение как источник для видео."
          />
        </CardTitle>
        <p className="text-muted-foreground text-xs">Созданные карточки, концепции и видео.</p>
      </CardHeader>
      <CardContent className="min-w-0 space-y-5">
        {metaLoading && !hasResults ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Загружаем результаты…
          </div>
        ) : null}

        {!metaLoading && !hasResults ? (
          <div className="rounded-xl border border-dashed border-[#B8DCE6] bg-[#F4FBFD]/50 p-4 text-center">
            <p className="text-sm font-medium text-[#0C2D38]">Пока нет результатов</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Загрузите фото товара и создайте карточку, концепцию или видео — результаты появятся
              здесь.
            </p>
          </div>
        ) : null}

        {hasResults ? (
          <div className="min-w-0 space-y-5">
            <ResultSection
              title="Карточки товара"
              items={grouped.cards}
              previews={previews}
              loadingIds={loadingIds}
              onUseForVideo={onUseForVideo}
              kind="marketplace_card"
            />
            <ResultSection
              title="Фото с концепциями"
              items={grouped.concepts}
              previews={previews}
              loadingIds={loadingIds}
              onUseForVideo={onUseForVideo}
              kind="concept"
            />
            <ResultSection
              title="Видео"
              items={grouped.videos}
              previews={previews}
              loadingIds={loadingIds}
              kind="video"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
