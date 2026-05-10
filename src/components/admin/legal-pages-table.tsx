"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Rocket } from "lucide-react";
import { toast } from "sonner";

import { adminTerm } from "@/lib/admin-terms";
import {
  LEGAL_PAGE_PUBLIC_PATH,
  type LegalPageSlug,
} from "@/lib/legal-page-config";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/enums";
import { hasPermission } from "@/lib/permissions";

export type LegalPageRow = {
  slug: string;
  title: string;
  status: string;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
};

type Props = {
  rows: LegalPageRow[];
  role: UserRole;
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function LegalPagesTable({ rows, role }: Props) {
  const router = useRouter();
  const canMutate = hasPermission(role, "legal.manage");

  async function onPublishRow(slug: string) {
    if (!canMutate) return;
    try {
      const res = await fetch(`/api/admin/legal/${encodeURIComponent(slug)}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "request_failed");
      }
      toast.success("Опубликовано / Published");
      router.refresh();
    } catch {
      toast.error("Не удалось опубликовать");
    }
  }

  return (
    <div className="border-border overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{adminTerm("lpColPage")}</TableHead>
            <TableHead>{adminTerm("lpColSlug")}</TableHead>
            <TableHead>{adminTerm("lpColStatus")}</TableHead>
            <TableHead>{adminTerm("lpColVersion")}</TableHead>
            <TableHead>{adminTerm("lpColPublished")}</TableHead>
            <TableHead>{adminTerm("lpColUpdated")}</TableHead>
            <TableHead className="text-right">{adminTerm("lpColActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const publicPath = LEGAL_PAGE_PUBLIC_PATH[r.slug as LegalPageSlug];
            const canLinkPublic = publicPath != null;
            return (
              <TableRow key={r.slug}>
                <TableCell className="max-w-[200px] font-medium">{r.title}</TableCell>
                <TableCell>
                  <code className="text-xs">{r.slug}</code>
                </TableCell>
                <TableCell>
                  {r.status === "PUBLISHED" ? adminTerm("lpStatusPublished") : adminTerm("lpStatusDraft")}
                </TableCell>
                <TableCell>{r.version}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                  {fmt(r.publishedAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                  {fmt(r.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    {canLinkPublic ? (
                      <Link
                        href={publicPath}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="size-3.5" />
                        {adminTerm("lpView")}
                      </Link>
                    ) : null}
                    {canMutate ? (
                      <Link
                        href={`/admin/legal/${encodeURIComponent(r.slug)}/edit`}
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1")}
                      >
                        <Pencil className="size-3.5" />
                        {adminTerm("lpEdit")}
                      </Link>
                    ) : (
                      <Link
                        href={`/admin/legal/${encodeURIComponent(r.slug)}/edit`}
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1")}
                      >
                        {adminTerm("lpViewAdmin")}
                      </Link>
                    )}
                    {canMutate ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        type="button"
                        onClick={() => void onPublishRow(r.slug)}
                      >
                        <Rocket className="size-3.5" />
                        {adminTerm("lpPublish")}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
