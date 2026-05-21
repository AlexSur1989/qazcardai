import Link from "next/link";
import { Download, Film, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserFacingHistoryListItem } from "@/lib/generation-history-data";
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
    case "REFUNDED":
      return "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    default:
      return "";
  }
}

type Props = {
  items: UserFacingHistoryListItem[];
};

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
              {g.previewUrl ? (
                g.type === "VIDEO" ? (
                  <video
                    src={g.previewUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                    aria-label=""
                  />
                ) : (
                  <img
                    src={g.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )
              ) : (
                <div className="text-muted-foreground flex h-full w-full items-center justify-center p-0.5 text-center text-[10px]">
                  —
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <Link
                href={`/dashboard/history/${g.id}`}
                className="text-foreground hover:text-primary block text-sm font-medium"
              >
                <span className="line-clamp-2">{g.title}</span>
              </Link>
              {g.subtitle ? (
                <p className="text-muted-foreground line-clamp-2 text-xs leading-snug">
                  {g.subtitle}
                </p>
              ) : null}
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span>
                  {g.createdAt.toLocaleString("ru-RU", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <span className="text-muted-foreground/80">·</span>
                <span className="tabular-nums">{g.costCredits} ток.</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-xs">
                  {g.kindLabel}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("text-xs", statusBadgeClass(g.status))}
                >
                  {g.statusLabel}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5 sm:flex-col sm:items-stretch sm:pt-0">
            {g.repeatHref ? (
              <Link
                href={g.repeatHref}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "inline-flex items-center justify-center gap-1",
                )}
              >
                <RotateCcw className="size-3.5" />
                Повторить
              </Link>
            ) : null}
            {g.videoSourceHref ? (
              <Link
                href={g.videoSourceHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "inline-flex items-center justify-center gap-1",
                )}
              >
                <Film className="size-3.5" />
                Для видео
              </Link>
            ) : null}
            {g.canDownload && g.downloadUrl ? (
              <a
                href={g.downloadUrl}
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
              Открыть
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
