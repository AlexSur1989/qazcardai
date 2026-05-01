"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { Loader2, RefreshCw } from "lucide-react";

import type {
  LaunchChecklistItem,
  LaunchCheckSeverity,
} from "@/lib/launch-checklist-types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type LaunchChecklistInitial = {
  items: LaunchChecklistItem[];
  summary: { ok: number; warning: number; required: number };
};

function SeverityBadge({ severity }: { severity: LaunchCheckSeverity }) {
  const label =
    severity === "ok" ? "OK" : severity === "warning" ? "Warning" : "Required";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        severity === "ok" &&
          "border-emerald-300 bg-emerald-500/15 text-emerald-900 dark:border-emerald-700 dark:text-emerald-100",
        severity === "warning" &&
          "border-amber-400 bg-amber-500/15 text-amber-950 dark:border-amber-600 dark:text-amber-50",
        severity === "required" &&
          "border-red-300 bg-red-500/15 text-red-900 dark:border-red-700 dark:text-red-100",
      )}
    >
      {label}
    </span>
  );
}

export function LaunchChecklistClient({ initial }: { initial: LaunchChecklistInitial }) {
  const [data, setData] = useState<LaunchChecklistInitial>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/launch-checklist", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) {
        setError("Не удалось обновить список.");
        return;
      }
      const json = (await res.json()) as LaunchChecklistInitial;
      setData(json);
    } catch {
      setError("Ошибка сети.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Статусы</CardTitle>
          <CardDescription>
            OK — готово · Warning — желательно исправить · Required — блокирует запуск
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">
            OK {data.summary.ok} · Warning {data.summary.warning} · Required{" "}
            {data.summary.required}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b text-left">
                <th className="px-3 py-2 font-medium">Статус</th>
                <th className="px-3 py-2 font-medium">Пункт</th>
                <th className="px-3 py-2 font-medium">Комментарий</th>
                <th className="px-3 py-2 font-medium">Исправить</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-2 align-top">
                    <SeverityBadge severity={row.severity} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">{row.labelRu}</div>
                    <div className="text-muted-foreground text-xs">{row.labelEn}</div>
                  </td>
                  <td className="text-muted-foreground max-w-md px-3 py-2 align-top">
                    {row.detail ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.fixHref ? (
                      <Link
                        className="text-primary underline-offset-4 hover:underline"
                        href={row.fixHref}
                      >
                        {row.fixHref}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
