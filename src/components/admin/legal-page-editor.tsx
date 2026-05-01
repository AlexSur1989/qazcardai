"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminTerm } from "@/lib/admin-terms";
import type { LegalPageSlug } from "@/lib/legal-page-config";
import { LEGAL_PAGE_PUBLIC_PATH, LEGAL_PAGE_STATUS } from "@/lib/legal-page-config";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [LEGAL_PAGE_STATUS.DRAFT, LEGAL_PAGE_STATUS.PUBLISHED] as const;

export type LegalPageEditorInitial = {
  slug: string;
  title: string;
  content: string;
  status: string;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
};

type Props = {
  initial: LegalPageEditorInitial;
  canEdit: boolean;
};

export function LegalPageEditor({ initial, canEdit }: Props) {
  const router = useRouter();
  const publicPath = LEGAL_PAGE_PUBLIC_PATH[initial.slug as LegalPageSlug] ?? "/";
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [status, setStatus] = useState(initial.status);
  const [saving, setSaving] = useState(false);

  async function patch(
    body: { title: string; content: string; status: string },
    msgOk: string,
  ) {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/legal/${encodeURIComponent(initial.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "request_failed");
      }
      toast.success(msgOk);
      router.refresh();
    } catch {
      toast.error("Сохранение не удалось / Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTitle>{adminTerm("lpEditorWarning")}</AlertTitle>
        <AlertDescription>{adminTerm("lpEditorWarningDesc")}</AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <Label htmlFor="lp-title">{adminTerm("lpTitle")}</Label>
            <Input
              id="lp-title"
              className="mt-1.5"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="lp-slug">Slug (URL)</Label>
            <Input id="lp-slug" className="mt-1.5" value={initial.slug} readOnly disabled />
          </div>
          <div>
            <Label htmlFor="lp-content">Content / Текст</Label>
            <Textarea
              id="lp-content"
              className="mt-1.5 min-h-[220px] font-mono text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              readOnly={!canEdit}
              disabled={!canEdit}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              {adminTerm("lpVersion")}: {initial.version} · {adminTerm("lpUpdated")}:{" "}
              {new Date(initial.updatedAt).toLocaleString("ru-RU")}
            </p>
          </div>
          <div>
            <Label htmlFor="lp-status">{adminTerm("lpColStatus")}</Label>
            <select
              id="lp-status"
              className={cn(
                "border-border bg-card focus-visible:ring-ring mt-1.5 w-full max-w-xs rounded-md border px-2 py-1.5 text-sm",
                "focus-visible:ring-2 focus-visible:outline-none",
                !canEdit && "cursor-not-allowed opacity-60",
              )}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={!canEdit}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "PUBLISHED"
                    ? adminTerm("lpStatusPublished")
                    : adminTerm("lpStatusDraft")}
                </option>
              ))}
            </select>
            {!canEdit ? (
              <p className="text-muted-foreground mt-1 text-xs">{adminTerm("lpViewOnly")}</p>
            ) : null}
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={saving}
                variant="secondary"
                onClick={() =>
                  void patch(
                    { title, content, status: LEGAL_PAGE_STATUS.DRAFT },
                    adminTerm("lpToastDraftSaved"),
                  )
                }
              >
                {adminTerm("lpSaveDraft")}
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() =>
                  void patch(
                    { title, content, status: LEGAL_PAGE_STATUS.PUBLISHED },
                    adminTerm("lpToastPublished"),
                  )
                }
              >
                {adminTerm("lpPublish")}
              </Button>
            </div>
          ) : null}
          <div>
            <Link
              href={publicPath}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "inline-flex gap-1")}
            >
              <ExternalLink className="size-4" />
              {adminTerm("lpViewPublic")}
            </Link>
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-2 text-sm font-medium">
            {adminTerm("lpPreview")}
          </p>
          <div
            className={cn(
              "bg-muted/40 border-border max-h-[min(70vh,560px)] overflow-auto rounded-md border p-4",
            )}
          >
            <h2 className="text-foreground text-lg font-semibold">{title || "—"}</h2>
            <p className="text-muted-foreground mt-1 text-xs">{initial.slug}</p>
            <div className="text-muted-foreground mt-4 whitespace-pre-wrap text-sm leading-relaxed">
              {content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
