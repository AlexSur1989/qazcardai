import Link from "next/link";
import { Download, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generationStatusLabel, generationTypeLabel } from "@/lib/generation-labels";
import type { UserHistoryListItem } from "@/lib/generation-history-data";
import type { GenerationStatus } from "@/generated/prisma/enums";

function statusBadgeClass(status: GenerationStatus): string {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
    case "FAILED":
    case "BLOCKED":
    case "CANCELLED":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "PROCESSING":
    case "QUEUED":
    case "CREATED":
      return "border-primary/30 bg-primary/10";
    default:
      return "";
  }
}

type Props = {
  items: UserHistoryListItem[];
};

function repeatHref(item: UserHistoryListItem): string {
  const path =
    item.type === "IMAGE" ? "/dashboard/create/image" : "/dashboard/create/video";
  const p = new URLSearchParams();
  p.set("modelId", item.model.id);
  if (item.prompt.length < 2000) {
    p.set("prompt", item.prompt);
  }
  return `${path}?${p.toString()}`;
}

export function HistoryGenerationList({ items }: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((g) => (
        <li
          key={g.id}
          className="border-border bg-card/40 flex flex-col gap-2 rounded-lg border p-3 sm:flex-row"
        >
          <div className="flex min-w-0 flex-1 gap-3">
            <div
              className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-md border"
              aria-hidden
            >
              {g.type === "IMAGE" && g.previewUrl ? (
                <img
                  src={g.previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : g.type === "VIDEO" && g.previewUrl ? (
                <video
                  src={g.previewUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  aria-label=""
                />
              ) : (
                <div className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px] text-center p-0.5">
                  —
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/dashboard/history/${g.id}`}
                className="text-foreground hover:underline line-clamp-2 text-sm font-medium"
              >
                {g.prompt}
              </Link>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="truncate">{g.model.name}</span>
                <span>
                  {g.createdAt.toLocaleString("ru-RU", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <span className="tabular-nums">{g.costCredits} кр.</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-xs">
                  {generationTypeLabel(g.type)}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("text-xs", statusBadgeClass(g.status))}
                >
                  {generationStatusLabel(g.status)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5 sm:flex-col sm:items-stretch sm:pt-0">
            <Link
              href={repeatHref(g)}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "inline-flex items-center justify-center gap-1",
              )}
            >
              <RotateCcw className="size-3.5" />
              Повторить
            </Link>
            {g.canDownload ? (
              <a
                href={`/api/generations/${g.id}/download?index=0`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "inline-flex items-center justify-center gap-1",
                )}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="size-3.5" />
                Скачать
              </a>
            ) : null}
            <Link
              href={`/dashboard/history/${g.id}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "inline-flex items-center justify-center",
              )}
            >
              Подробнее
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
