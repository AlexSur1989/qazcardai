import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { GenerationListItem } from "@/lib/dashboard-data";
import {
  generationStatusLabel,
  generationTypeLabel,
} from "@/lib/generation-labels";
import type { GenerationStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

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
      return "border-primary/30 bg-primary/10 text-foreground";
    default:
      return "";
  }
}

type GenerationPreviewListProps = {
  items: GenerationListItem[];
  emptyMessage: string;
};

export function GenerationPreviewList({
  items,
  emptyMessage,
}: GenerationPreviewListProps) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">{emptyMessage}</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((g) => (
        <li
          key={g.id}
          className="border-border bg-card/50 flex flex-col gap-1.5 rounded-lg border px-3 py-2.5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground line-clamp-2 min-w-0 flex-1 text-sm">
              {g.prompt}
            </span>
            <Badge variant="outline" className="shrink-0 text-xs">
              {generationTypeLabel(g.type)}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-xs",
                statusBadgeClass(g.status),
              )}
            >
              {generationStatusLabel(g.status)}
            </Badge>
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <span>{g.model.name}</span>
            <span>
              {g.createdAt.toLocaleString("ru-RU", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
            <span>{g.costCredits} кр.</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

type FooterLinkProps = {
  href: string;
  children: ReactNode;
};

export function GenerationListFooter({ href, children }: FooterLinkProps) {
  return (
    <p className="pt-2 text-center text-xs">
      <Link
        href={href}
        className="text-primary font-medium underline-offset-4 hover:underline"
      >
        {children}
      </Link>
    </p>
  );
}
