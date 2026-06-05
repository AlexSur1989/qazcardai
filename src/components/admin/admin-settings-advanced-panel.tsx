"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GoogleOAuthEnvStatusCard } from "@/components/admin/google-oauth-env-status";
import type { GoogleOAuthEnvStatus } from "@/lib/google-auth-config";
import type { AppSettingGroupId } from "@/config/app-settings-registry";
import {
  getAppSettingBadges,
  getAppSettingUiMeta,
  isLegacyAppSettingKey,
  requiresDangerousConfirm,
} from "@/lib/app-settings-ui-meta";
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

type FilterState = {
  group: string;
  risk: string;
  legacy: boolean;
  developer: boolean;
  canonical: boolean;
  search: string;
};

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

function badgeVariant(
  badge: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (badge === "Dangerous") return "destructive";
  if (badge === "Legacy" || badge === "Deprecated") return "outline";
  return "secondary";
}

type Props = {
  initialGroups: Group[];
  canEdit: boolean;
  canEditCritical: boolean;
  values: Record<string, unknown>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  jsonText: Record<string, string>;
  setJsonText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSaveKey: (key: string) => void;
  pending: boolean;
  message: { type: "ok" | "err"; text: string } | null;
  onHideAdvanced: () => void;
  onSeedDefaults: () => void;
  seeding: boolean;
  googleOAuthEnvStatus: GoogleOAuthEnvStatus;
};

export function AdminSettingsAdvancedPanel({
  initialGroups,
  canEdit,
  canEditCritical,
  values,
  setValues,
  jsonText,
  setJsonText,
  onSaveKey,
  pending,
  message,
  onHideAdvanced,
  onSeedDefaults,
  seeding,
  googleOAuthEnvStatus,
}: Props) {
  const [filters, setFilters] = useState<FilterState>({
    group: "all",
    risk: "all",
    legacy: false,
    developer: false,
    canonical: false,
    search: "",
  });
  const [confirmSave, setConfirmSave] = useState<{
    key: string;
    message: string;
  } | null>(null);

  const selectClassName =
    "border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none";

  const filteredGroups = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return initialGroups
      .map((g) => ({
        ...g,
        settings: g.settings.filter((s) => {
          const meta = getAppSettingUiMeta(s.key, s.group as AppSettingGroupId);
          if (filters.group !== "all" && s.group !== filters.group) return false;
          if (filters.risk !== "all" && meta.risk !== filters.risk) return false;
          if (filters.legacy && !meta.legacy && !isLegacyAppSettingKey(s.key))
            return false;
          if (filters.developer && meta.audience !== "developer") return false;
          if (filters.canonical && !meta.canonicalHref) return false;
          if (q) {
            const hay = `${s.key} ${s.label} ${s.description} ${meta.helpText ?? ""}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        }),
      }))
      .filter((g) => g.settings.length > 0);
  }, [initialGroups, filters]);

  const firstVisibleGroup = filteredGroups[0]?.group ?? initialGroups[0]?.group ?? "general";
  const totalCount = initialGroups.reduce((n, g) => n + g.settings.length, 0);
  const filteredCount = filteredGroups.reduce((n, g) => n + g.settings.length, 0);

  function handleSave(key: string, row: SettingRow) {
    const group = row.group as AppSettingGroupId;
    if (requiresDangerousConfirm(key, group)) {
      const meta = getAppSettingUiMeta(key, group);
      const msg =
        meta.helpText ??
        `Настройка «${key}» может повлиять на работу сайта или генераций. Продолжить?`;
      setConfirmSave({ key, message: msg });
      return;
    }
    onSaveKey(key);
  }

  return (
    <div className="space-y-6">
      <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
        <AlertTitle>Расширенные настройки</AlertTitle>
        <AlertDescription>
          Расширенные настройки могут повлиять на генерации, оплату, модели и доступность
          сайта. Меняйте их только если понимаете последствия.
        </AlertDescription>
      </Alert>

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
            Критичные параметры (maintenance, секреты) недоступны для редактирования без
            settings.critical.manage.
          </AlertDescription>
        </Alert>
      ) : null}

      {message ? (
        <Alert variant={message.type === "err" ? "destructive" : "default"}>
          <AlertTitle>{message.type === "ok" ? "Готово" : "Ошибка"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <GoogleOAuthEnvStatusCard status={googleOAuthEnvStatus} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Все AppSettings ({filteredCount} из {totalCount} после фильтров).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onHideAdvanced}>
            Базовый режим
          </Button>
          {canEditCritical ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={seeding || pending}
              onClick={onSeedDefaults}
            >
              Создать настройки по умолчанию
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/80 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1 sm:col-span-2 lg:col-span-3">
          <label className="text-muted-foreground text-xs">Поиск по ключу / названию</label>
          <Input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="APP_NAME, MODEL_SLUG, Kaspi…"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs">Группа</label>
          <select
            className={selectClassName}
            value={filters.group}
            onChange={(e) => setFilters((f) => ({ ...f, group: e.target.value }))}
          >
            <option value="all">Все группы</option>
            {initialGroups.map((g) => (
              <option key={g.group} value={g.group}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs">Риск</label>
          <select
            className={selectClassName}
            value={filters.risk}
            onChange={(e) => setFilters((f) => ({ ...f, risk: e.target.value }))}
          >
            <option value="all">Любой</option>
            <option value="safe">Safe</option>
            <option value="caution">Caution</option>
            <option value="dangerous">Dangerous</option>
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="size-3.5 rounded border"
              checked={filters.legacy}
              onChange={(e) => setFilters((f) => ({ ...f, legacy: e.target.checked }))}
            />
            Legacy
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="size-3.5 rounded border"
              checked={filters.developer}
              onChange={(e) => setFilters((f) => ({ ...f, developer: e.target.checked }))}
            />
            Developer
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="size-3.5 rounded border"
              checked={filters.canonical}
              onChange={(e) => setFilters((f) => ({ ...f, canonical: e.target.checked }))}
            />
            Canonical elsewhere
          </label>
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <Alert>
          <AlertTitle>Ничего не найдено</AlertTitle>
          <AlertDescription>Измените фильтры или поисковый запрос.</AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue={firstVisibleGroup} className="w-full">
          <div className="mb-4 overflow-x-auto">
            <TabsList className="inline-flex h-auto w-max min-w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
              {filteredGroups.map((g) => (
                <TabsTrigger
                  key={g.group}
                  value={g.group}
                  className="whitespace-nowrap text-xs sm:text-sm"
                >
                  {g.label} ({g.settings.length})
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {filteredGroups.map((g) => (
            <TabsContent key={g.group} value={g.group} className="mt-0 space-y-4">
              {g.settings.map((s) => {
                const val = values[s.key];
                const rowWritable = canChangeRow(s, canEdit, canEditCritical);
                const groupId = s.group as AppSettingGroupId;
                const uiMeta = getAppSettingUiMeta(s.key, groupId);
                const badges = getAppSettingBadges(s.key, groupId);
                const isLegacy = isLegacyAppSettingKey(s.key);
                const isDangerous = uiMeta.risk === "dangerous";

                return (
                  <div
                    key={s.key}
                    className={cn(
                      "space-y-2 rounded-2xl border border-[#b8dce6] bg-white p-4 shadow-sm",
                      !s.inDatabase && "ring-1 ring-amber-200/60",
                      isLegacy && "border-dashed border-amber-300/80 bg-amber-50/30",
                      isDangerous && "border-destructive/30",
                    )}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-foreground text-sm font-medium leading-snug">
                          {s.label}
                        </p>
                        {badges.map((b) => (
                          <Badge key={b} variant={badgeVariant(b)} className="text-[10px]">
                            {b}
                          </Badge>
                        ))}
                      </div>
                      <code className="text-muted-foreground mt-1 block text-[10px]">
                        {s.key}
                      </code>
                      <p className="text-muted-foreground text-xs">{s.description}</p>
                      {uiMeta.helpText ? (
                        <p className="text-muted-foreground mt-1 text-xs">{uiMeta.helpText}</p>
                      ) : null}
                      {uiMeta.canonicalHref ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {uiMeta.canonicalHint ?? "Рекомендуемый раздел:"}{" "}
                          <Link href={uiMeta.canonicalHref} className="text-primary underline">
                            {uiMeta.canonicalHref}
                          </Link>
                        </p>
                      ) : null}
                      {isDangerous ? (
                        <p className="text-destructive mt-1 text-xs font-medium">
                          Осторожно: изменение может повлиять на production.
                        </p>
                      ) : null}
                      {!s.inDatabase ? (
                        <p className="text-amber-900/80 mt-1 text-xs">
                          Пока показано значение по умолчанию; запись в БД появится после
                          «Сохранить» или Seed defaults.
                        </p>
                      ) : null}
                    </div>

                    {s.key === "KASPI_MANUAL_SETTINGS" ? (
                      <Alert variant="default" className="border-amber-200/80 bg-amber-50/50">
                        <AlertTitle className="text-sm">Бухгалтерия и фискализация</AlertTitle>
                        <AlertDescription className="text-xs">
                          Ручной перевод требует корректного бухгалтерского и фiscalного
                          оформления. Проверьте порядок выдачи фiscalного чека с бухгалтером.
                        </AlertDescription>
                      </Alert>
                    ) : null}

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
                            typeof val === "number" && Number.isFinite(val) ? val : ""
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
                        variant={isDangerous ? "destructive" : "default"}
                        disabled={pending}
                        onClick={() => handleSave(s.key, s)}
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
      )}

      <ConfirmDialog
        open={confirmSave != null}
        onOpenChange={(open) => {
          if (!open) setConfirmSave(null);
        }}
        title="Подтвердите изменение"
        description={confirmSave?.message}
        confirmLabel="Сохранить"
        cancelLabel="Отмена"
        variant="destructive"
        onConfirm={() => {
          if (confirmSave) onSaveKey(confirmSave.key);
        }}
      />
    </div>
  );
}
