"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminTerm } from "@/lib/admin-terms";
import { normalizeSeoFormState, type SeoFormState } from "@/lib/seo-form-types";
import { cn } from "@/lib/utils";

type ChecklistRow = {
  id: string;
  label: string;
  status: "ok" | "warning" | "info";
  detail?: string;
};

type Props = {
  initial: Record<string, unknown>;
  checklist: ChecklistRow[];
  canEdit: boolean;
};

function keywordsToText(v: unknown): string {
  try {
    if (v == null) return "[]";
    return JSON.stringify(v, null, 2);
  } catch {
    return "[]";
  }
}

export function SeoManagerForm({ initial, checklist, canEdit }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SeoFormState>(() => normalizeSeoFormState(initial));
  const [kwText, setKwText] = useState(() => keywordsToText(initial.SEO_DEFAULT_KEYWORDS));
  const indexing = form.ROBOTS_INDEXING_ENABLED === true;

  async function onSave() {
    if (!canEdit) return;
    let parsedKeywords: unknown;
    try {
      parsedKeywords = JSON.parse(kwText || "[]");
    } catch {
      toast.error("Keywords: невалидный JSON");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/seo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          SEO_DEFAULT_KEYWORDS: parsedKeywords,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: Record<string, unknown>;
      };
      if (!res.ok) {
        throw new Error(j.error ?? "request_failed");
      }
      toast.success("SEO / Сохранено");
      if (j.settings && typeof j.settings === "object") {
        const next = j.settings as Record<string, unknown>;
        setForm(normalizeSeoFormState(next));
        setKwText(keywordsToText(next.SEO_DEFAULT_KEYWORDS));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {canEdit && !indexing ? (
        <Alert variant="destructive">
          <AlertTitle>{adminTerm("seoIndexingOffTitle")}</AlertTitle>
          <AlertDescription>{adminTerm("seoIndexingOffDesc")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-foreground text-lg font-semibold">
          {adminTerm("seoSectionLandingLinks")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {adminTerm("seoLandingCtaHint")}
        </p>
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          <div>
            <Label htmlFor="seo-LANDING_URL">{adminTerm("seoLabelLanding")}</Label>
            <Input
              id="seo-LANDING_URL"
              className="mt-1.5"
              value={String(form.LANDING_URL ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, LANDING_URL: e.target.value }))}
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="seo-APP_URL">{adminTerm("seoLabelApp")}</Label>
            <Input
              id="seo-APP_URL"
              className="mt-1.5"
              value={String(form.APP_URL ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, APP_URL: e.target.value }))}
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-foreground text-lg font-semibold">
          {adminTerm("seoSectionMetadata")}
        </h2>
        <div className="space-y-4 max-w-3xl">
          <div>
            <Label htmlFor="seo-t">{adminTerm("seoLabelTitle")}</Label>
            <Input
              id="seo-t"
              className="mt-1.5"
              value={String(form.SEO_DEFAULT_TITLE ?? "")}
              onChange={(e) =>
                setForm((f) => ({ ...f, SEO_DEFAULT_TITLE: e.target.value }))
              }
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="seo-d">{adminTerm("seoLabelDescription")}</Label>
            <Textarea
              id="seo-d"
              className="mt-1.5 min-h-[90px]"
              value={String(form.SEO_DEFAULT_DESCRIPTION ?? "")}
              onChange={(e) =>
                setForm((f) => ({ ...f, SEO_DEFAULT_DESCRIPTION: e.target.value }))
              }
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="seo-kw">{adminTerm("seoLabelKeywords")}</Label>
            <Textarea
              id="seo-kw"
              className="mt-1.5 min-h-[120px] font-mono text-sm"
              value={kwText}
              onChange={(e) => setKwText(e.target.value)}
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="seo-can">{adminTerm("seoLabelCanonical")}</Label>
            <Input
              id="seo-can"
              className="mt-1.5"
              value={String(form.SEO_CANONICAL_URL ?? "")}
              onChange={(e) =>
                setForm((f) => ({ ...f, SEO_CANONICAL_URL: e.target.value }))
              }
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="seo-og">{adminTerm("seoLabelOg")}</Label>
            <Input
              id="seo-og"
              className="mt-1.5"
              value={String(form.OG_IMAGE_URL ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, OG_IMAGE_URL: e.target.value }))}
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-foreground text-lg font-semibold">
          {adminTerm("seoSectionSearch")}
        </h2>
        <div className="grid max-w-3xl gap-4 sm:grid-cols-1 md:grid-cols-2">
          <div>
            <Label htmlFor="seo-g">{adminTerm("seoLabelGoogle")}</Label>
            <Input
              id="seo-g"
              className="mt-1.5"
              value={String(form.GOOGLE_SITE_VERIFICATION ?? "")}
              onChange={(e) =>
                setForm((f) => ({ ...f, GOOGLE_SITE_VERIFICATION: e.target.value }))
              }
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="seo-y">{adminTerm("seoLabelYandex")}</Label>
            <Input
              id="seo-y"
              className="mt-1.5"
              value={String(form.YANDEX_VERIFICATION ?? "")}
              onChange={(e) =>
                setForm((f) => ({ ...f, YANDEX_VERIFICATION: e.target.value }))
              }
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-foreground text-lg font-semibold">
          {adminTerm("seoSectionRobots")}
        </h2>
        <div className="max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <input
              id="seo-rob"
              type="checkbox"
              className="size-4 rounded border"
              checked={form.ROBOTS_INDEXING_ENABLED === true}
              onChange={(e) =>
                setForm((f) => ({ ...f, ROBOTS_INDEXING_ENABLED: e.target.checked }))
              }
              disabled={!canEdit}
            />
            <Label htmlFor="seo-rob" className="text-sm font-medium">
              {adminTerm("seoLabelRobotsIndexing")}
            </Label>
          </div>
          <div>
            <Label htmlFor="seo-sm">{adminTerm("seoLabelSitemap")}</Label>
            <Input
              id="seo-sm"
              className="mt-1.5"
              value={String(form.SITEMAP_URL ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, SITEMAP_URL: e.target.value }))}
              readOnly={!canEdit}
              disabled={!canEdit}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/robots.txt"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3.5" />
              {adminTerm("seoOpenRobots")}
            </Link>
            <Link
              href="/sitemap.xml"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3.5" />
              {adminTerm("seoOpenSitemap")}
            </Link>
          </div>
        </div>
      </div>

      {canEdit ? (
        <Button type="button" onClick={() => void onSave()} disabled={saving}>
          {adminTerm("seoSave")}
        </Button>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{adminTerm("seoChecklistTitle")}</CardTitle>
          <CardDescription>
            {adminTerm("seoChecklistDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {checklist.map((c) => (
              <li
                key={c.id}
                className="border-border flex flex-col gap-0.5 rounded border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      c.status === "ok" && "bg-green-500",
                      c.status === "warning" && "bg-amber-500",
                      c.status === "info" && "bg-sky-500",
                    )}
                    aria-hidden
                  />
                  <span className="font-medium">{c.label}</span>
                </div>
                {c.detail ? (
                  <span className="text-muted-foreground pl-4 text-xs">{c.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
