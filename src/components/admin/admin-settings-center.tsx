"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SettingRow = {
  key: string;
  group: string;
  label: string;
  description: string;
  type: string;
  value: unknown;
  defaultValue: unknown;
  inDatabase: boolean;
  editable: boolean;
  sensitive: boolean;
};

type Group = {
  group: string;
  label: string;
  settings: SettingRow[];
};

function jsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return "";
  }
}

function canChangeRow(
  row: SettingRow,
  hasManage: boolean,
  hasCritical: boolean,
): boolean {
  if (!hasManage || !row.editable) return false;
  const needsCritical = row.sensitive || row.group === "maintenance";
  if (needsCritical && !hasCritical) return false;
  return true;
}

export function AdminSettingsCenter({
  initialGroups,
  canEdit,
  canEditCritical,
}: {
  initialGroups: Group[];
  canEdit: boolean;
  canEditCritical: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const o: Record<string, unknown> = {};
    for (const g of initialGroups) {
      for (const s of g.settings) {
        o[s.key] = s.value;
      }
    }
    return o;
  });

  const [jsonText, setJsonText] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const g of initialGroups) {
      for (const s of g.settings) {
        if (s.type === "json") {
          o[s.key] = jsonStringify(s.value);
        }
      }
    }
    return o;
  });

  const firstGroup = initialGroups[0]?.group ?? "general";

  const byKey = useMemo(() => {
    const m = new Map<string, SettingRow>();
    for (const g of initialGroups) {
      for (const s of g.settings) m.set(s.key, s);
    }
    return m;
  }, [initialGroups]);

  async function patchKey(key: string, value: unknown) {
    setMessage(null);
    const res = await fetch(
      `/api/admin/settings/${encodeURIComponent(key)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      },
    );
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setMessage({ type: "err", text: j.error ?? `HTTP ${res.status}` });
      return false;
    }
    setMessage({ type: "ok", text: "Сохранено" });
    startTransition(() => {
      router.refresh();
    });
    return true;
  }

  async function saveKey(key: string) {
    const row = byKey.get(key);
    if (!row || !canChangeRow(row, canEdit, canEditCritical)) return;
    if (row.type === "json") {
      const raw = jsonText[key] ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setMessage({ type: "err", text: "Некорректный JSON" });
        return;
      }
      const ok = await patchKey(key, parsed);
      if (ok) {
        setValues((m) => ({ ...m, [key]: parsed }));
        setJsonText((m) => ({ ...m, [key]: jsonStringify(parsed) }));
      }
      return;
    }
    await patchKey(key, values[key]);
  }

  async function seedDefaults() {
    if (!canEditCritical) return;
    setSeeding(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings/seed-defaults", {
      method: "POST",
    });
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      created?: number;
    };
    setSeeding(false);
    if (!res.ok) {
      setMessage({ type: "err", text: j.error ?? "Ошибка seed" });
      return;
    }
    setMessage({
      type: "ok",
      text: `Создано отсутствующих: ${j.created ?? 0}`,
    });
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {canEdit ? null : (
        <Alert>
          <AlertTitle>Только просмотр</AlertTitle>
          <AlertDescription>
            Нет права settings.manage — доступно только чтение.
          </AlertDescription>
        </Alert>
      )}

      {canEdit && !canEditCritical ? (
        <Alert>
          <AlertTitle>Часть настроек только для SUPER_ADMIN</AlertTitle>
          <AlertDescription>
            Критичные и технические параметры (maintenance, секреты) недоступны для
            редактирования.
          </AlertDescription>
        </Alert>
      ) : null}

      {message ? (
        <Alert variant={message.type === "err" ? "destructive" : "default"}>
          <AlertTitle>{message.type === "ok" ? "Готово" : "Ошибка"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Settings from database + registry defaults / Настройки в БД и значения
          по умолчанию из реестра.
        </p>
        {canEditCritical ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={seeding || pending}
            onClick={() => void seedDefaults()}
            className="shrink-0"
          >
            Создать настройки по умолчанию / Seed defaults
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue={firstGroup} className="w-full">
        <div className="mb-4 overflow-x-auto">
          <TabsList className="inline-flex h-auto w-max min-w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
            {initialGroups.map((g) => (
              <TabsTrigger
                key={g.group}
                value={g.group}
                className="whitespace-nowrap text-xs sm:text-sm"
              >
                {g.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {initialGroups.map((g) => (
          <TabsContent key={g.group} value={g.group} className="mt-0 space-y-4">
            {g.settings.map((s) => {
              const val = values[s.key];
              const rowWritable = canChangeRow(s, canEdit, canEditCritical);
              return (
                <div
                  key={s.key}
                  className={cn(
                    "space-y-2 rounded-2xl border border-[#b8dce6] bg-white p-4 shadow-sm",
                    !s.inDatabase && "ring-1 ring-amber-200/60",
                  )}
                >
                  <div>
                    <p className="text-foreground text-sm font-medium leading-snug">
                      {s.label}
                    </p>
                    <p className="text-muted-foreground text-xs">{s.description}</p>
                    {!s.inDatabase ? (
                      <p className="text-amber-900/80 mt-1 text-xs">
                        Пока показано значение по умолчанию; запись в БД появится
                        после «Сохранить» или Seed defaults.
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:max-w-2xl">
                    {s.type === "string" ? (
                      <Input
                        value={typeof val === "string" ? val : String(val ?? "")}
                        onChange={(e) =>
                          setValues((m) => ({ ...m, [s.key]: e.target.value }))
                        }
                        readOnly={!rowWritable}
                        className="font-mono text-sm"
                      />
                    ) : null}
                    {s.type === "number" ? (
                      <Input
                        type="number"
                        value={
                          typeof val === "number" && Number.isFinite(val)
                            ? val
                            : ""
                        }
                        onChange={(e) => {
                          const n = parseFloat(e.target.value);
                          setValues((m) => ({
                            ...m,
                            [s.key]: Number.isFinite(n) ? n : 0,
                          }));
                        }}
                        readOnly={!rowWritable}
                        className="font-mono text-sm"
                      />
                    ) : null}
                    {s.type === "boolean" ? (
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 rounded border"
                          checked={val === true}
                          disabled={!rowWritable}
                          onChange={(e) =>
                            setValues((m) => ({ ...m, [s.key]: e.target.checked }))
                          }
                        />
                        {val === true ? "true" : "false"}
                      </label>
                    ) : null}
                    {s.type === "json" ? (
                      <Textarea
                        value={jsonText[s.key] ?? ""}
                        onChange={(e) =>
                          setJsonText((m) => ({
                            ...m,
                            [s.key]: e.target.value,
                          }))
                        }
                        readOnly={!rowWritable}
                        rows={6}
                        className="font-mono text-xs"
                      />
                    ) : null}
                  </div>
                  {s.type === "json" && rowWritable ? (
                    <p className="text-muted-foreground text-xs">
                      Сохранение: валидный JSON (массив или объект).
                    </p>
                  ) : null}
                  {rowWritable ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => void saveKey(s.key)}
                    >
                      Сохранить
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
