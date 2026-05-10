"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserRole } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { MODERATION_APP_SETTING_KEYS } from "@/lib/moderation-app-settings";

type Props = {
  initialRole: UserRole | string;
  initialSettings: Record<string, unknown>;
  /** Только таблица логов (отдельная страница для модераторов). */
  logsOnly?: boolean;
};

type SettingsState = Record<string, unknown>;

function jsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "[]";
  }
}

type LogRow = {
  id: string;
  createdAt: string;
  userEmail: string | null;
  generationId: string | null;
  modelName: string | null;
  flow: string | null;
  reason: string;
  rule: string | null;
  matchedText: string | null;
  severity: string | null;
  promptPreview: string | null;
};

export function AdminModerationCenter({
  initialRole,
  initialSettings,
  logsOnly = false,
}: Props) {
  const canSave = initialRole === "SUPER_ADMIN";
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [bannedJson, setBannedJson] = useState(() =>
    jsonStringify(initialSettings.MODERATION_BANNED_WORDS),
  );
  const [patternsJson, setPatternsJson] = useState(() =>
    jsonStringify(initialSettings.MODERATION_BLOCKED_PATTERNS),
  );
  const [testPrompt, setTestPrompt] = useState("");
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testing, setTesting] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(true);
  const [info, setInfo] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const pageSize = 20;

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const u = new URL("/api/admin/moderation/logs", window.location.origin);
      u.searchParams.set("page", String(logPage));
      u.searchParams.set("pageSize", String(pageSize));
      const res = await fetch(u.toString());
      const data = (await res.json()) as {
        items: LogRow[];
        total: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "logs_failed");
      }
      setLogs(data.items);
      setLogTotal(data.total);
    } catch (e) {
      setInfo({
        type: "err",
        text: e instanceof Error ? e.message : "Ошибка загрузки логов",
      });
    } finally {
      setLogsLoading(false);
    }
  }, [logPage]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadLogs();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadLogs]);

  const onSave = async () => {
    let parsedBanned: unknown;
    let parsedPatterns: unknown;
    try {
      parsedBanned = JSON.parse(bannedJson) as unknown;
      parsedPatterns = JSON.parse(patternsJson) as unknown;
    } catch {
      setInfo({ type: "err", text: "Некорректный JSON в списках" });
      return;
    }
    setSaving(true);
    setInfo(null);
    try {
      const body: Record<string, unknown> = {};
      for (const key of MODERATION_APP_SETTING_KEYS) {
        if (key === "MODERATION_BANNED_WORDS") {
          body[key] = parsedBanned;
        } else if (key === "MODERATION_BLOCKED_PATTERNS") {
          body[key] = parsedPatterns;
        } else {
          body[key] = settings[key];
        }
      }
      const res = await fetch("/api/admin/moderation/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean; after?: SettingsState };
      if (!res.ok) {
        throw new Error(data.error ?? "save_failed");
      }
      if (data.after) {
        setSettings(data.after);
        setBannedJson(jsonStringify(data.after.MODERATION_BANNED_WORDS));
        setPatternsJson(jsonStringify(data.after.MODERATION_BLOCKED_PATTERNS));
      }
      setInfo({ type: "ok", text: "Сохранено" });
    } catch (e) {
      setInfo({
        type: "err",
        text: e instanceof Error ? e.message : "Ошибка сохранения",
      });
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    setInfo(null);
    try {
      const res = await fetch("/api/admin/moderation/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: testPrompt }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(String(data.error ?? "test_failed"));
      }
      setTestResult(data);
    } catch (e) {
      setInfo({
        type: "err",
        text: e instanceof Error ? e.message : "Ошибка проверки",
      });
    } finally {
      setTesting(false);
    }
  };

  const setBool = (k: string, v: boolean) => {
    setSettings((s) => ({ ...s, [k]: v }));
  };

  const setNum = (k: string, v: string) => {
    const n = Number(v);
    if (Number.isFinite(n)) {
      setSettings((s) => ({ ...s, [k]: n }));
    }
  };

  return (
    <div className="space-y-10">
      {info && (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            info.type === "ok"
              ? "border-green-500/50 text-green-700"
              : "border-destructive/50 text-destructive",
          )}
        >
          {info.text}
        </p>
      )}

      {!logsOnly && (
        <>
          <section className="space-y-4">
        <h2 className="text-lg font-semibold">Settings / Настройки</h2>
        <div className="grid max-w-2xl gap-6">
          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Moderation on / Модерация</p>
              <p className="text-muted-foreground text-xs">MODERATION_ENABLED</p>
            </div>
            <input
              type="checkbox"
              className="size-4"
              checked={settings.MODERATION_ENABLED === true}
              onChange={(e) => setBool("MODERATION_ENABLED", e.target.checked)}
              disabled={!canSave}
            />
          </label>
          <div className="space-y-2">
            <Label>Prompt length / Длина prompt (MODERATION_MAX_PROMPT_LENGTH)</Label>
            <Input
              type="number"
              min={1}
              value={String(settings.MODERATION_MAX_PROMPT_LENGTH ?? 2000)}
              onChange={(e) => setNum("MODERATION_MAX_PROMPT_LENGTH", e.target.value)}
              disabled={!canSave}
            />
          </div>
          <div className="space-y-2">
            <Label>Banned words / Запрещённые слова (JSON array)</Label>
            <Textarea
              className="font-mono text-xs"
              rows={5}
              value={bannedJson}
              onChange={(e) => setBannedJson(e.target.value)}
              disabled={!canSave}
            />
          </div>
          <div className="space-y-2">
            <Label>Blocked patterns / Заблокированные шаблоны (JSON array, regex)</Label>
            <Textarea
              className="font-mono text-xs"
              rows={4}
              value={patternsJson}
              onChange={(e) => setPatternsJson(e.target.value)}
              disabled={!canSave}
            />
          </div>
          {(
            [
              ["MODERATION_BLOCK_NSFW", "NSFW block / Блокировка NSFW"],
              ["MODERATION_BLOCK_DEEPFAKE", "Deepfake block / Блокировка deepfake"],
              ["MODERATION_BLOCK_MINORS", "Minors / Несовершеннолетние"],
              ["MODERATION_BLOCK_ILLEGAL", "Illegal content / Незаконный контент"],
              ["MODERATION_REVIEW_MODE", "Manual review / Ручная проверка"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">{label}</p>
              <input
                type="checkbox"
                className="size-4"
                checked={settings[key] === true}
                onChange={(e) => setBool(key, e.target.checked)}
                disabled={!canSave}
              />
            </label>
          ))}
        </div>
        {canSave ? (
          <Button onClick={() => void onSave()} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить / Save"}
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">
            Only SUPER_ADMIN can save / Только SUPER_ADMIN может менять.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Test prompt / Проверить prompt</h2>
        <Textarea
          value={testPrompt}
          onChange={(e) => setTestPrompt(e.target.value)}
          rows={3}
          placeholder="Введите prompt для проверки"
        />
        <Button type="button" onClick={() => void onTest()} disabled={testing}>
          {testing ? "…" : "Проверить / Test"}
        </Button>
        {testResult && (
          <div
            className={cn(
              "rounded-md border p-3 text-sm",
              testResult.allowed
                ? "border-green-500/50 bg-green-500/5"
                : "border-amber-500/50 bg-amber-500/5",
            )}
          >
            <p>
              <span className="font-medium">Allowed / Разрешено: </span>
              {String(testResult.allowed)}
            </p>
            {!testResult.allowed && (
              <>
                <p>
                  <span className="font-medium">Reason / Причина: </span>
                  {String(testResult.reason ?? "")}
                </p>
                <p>
                  <span className="font-medium">Rule: </span>
                  {String(testResult.rule ?? "")}
                </p>
                <p>
                  <span className="font-medium">Matched text / Совпадение: </span>
                  {String(testResult.matchedText ?? "")}
                </p>
              </>
            )}
          </div>
        )}
      </section>

        </>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Moderation logs / Логи модерации</h2>
        {logsLoading ? (
          <p className="text-muted-foreground text-sm">Загрузка…</p>
        ) : (
          <>
            <div className="text-muted-foreground text-xs">Всего: {logTotal}</div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date / Дата</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Generation</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Flow</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Matched</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(row.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell
                        className="max-w-[140px] truncate text-xs"
                        title={row.userEmail ?? ""}
                      >
                        {row.userEmail ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[100px] truncate font-mono text-xs">
                        {row.generationId ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{row.modelName ?? "—"}</TableCell>
                      <TableCell className="text-xs">{row.flow ?? "—"}</TableCell>
                      <TableCell
                        className="max-w-[160px] truncate text-xs"
                        title={row.reason}
                      >
                        {row.reason}
                      </TableCell>
                      <TableCell className="text-xs">{row.rule ?? "—"}</TableCell>
                      <TableCell
                        className="max-w-[120px] truncate text-xs"
                        title={row.matchedText ?? ""}
                      >
                        {row.matchedText ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{row.severity ?? "—"}</TableCell>
                      <TableCell
                        className="max-w-[200px] truncate text-xs"
                        title={row.promptPreview ?? ""}
                      >
                        {row.promptPreview ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {logTotal > pageSize && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logPage <= 1}
                  onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                >
                  Назад
                </Button>
                <span className="text-muted-foreground text-sm">
                  Стр. {logPage} / {Math.max(1, Math.ceil(logTotal / pageSize))}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logPage * pageSize >= logTotal}
                  onClick={() => setLogPage((p) => p + 1)}
                >
                  Вперёд
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
