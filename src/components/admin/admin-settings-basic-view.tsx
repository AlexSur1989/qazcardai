"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BASIC_EDITABLE_SETTING_KEYS } from "@/lib/admin-settings-basic-config";
import type { SettingsBasicLinkCard } from "@/lib/admin-settings-basic-config";
import { SETTINGS_BASIC_LINK_CARDS } from "@/lib/admin-settings-basic-config";
import type { Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type SettingRow = {
  key: string;
  group: string;
  label: string;
  description: string;
  type: string;
  value: unknown;
  editable: boolean;
};

type Props = {
  basicSettings: SettingRow[];
  canEdit: boolean;
  canEditCritical: boolean;
  linkPermissions: Partial<Record<Permission, boolean>>;
  values: Record<string, unknown>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  onSaveKey: (key: string) => void;
  pending: boolean;
  message: { type: "ok" | "err"; text: string } | null;
  onShowAdvanced: () => void;
  advancedCount: number;
};

function humanLabel(row: SettingRow): string {
  const parts = row.label.split(" / ");
  return parts.length > 1 ? parts.slice(1).join(" / ") : row.label;
}

export function AdminSettingsBasicView({
  basicSettings,
  canEdit,
  canEditCritical,
  linkPermissions,
  values,
  setValues,
  onSaveKey,
  pending,
  message,
  onShowAdvanced,
  advancedCount,
}: Props) {
  const editableRows = basicSettings.filter((s) =>
    BASIC_EDITABLE_SETTING_KEYS.has(s.key),
  );

  function canEditRow(row: SettingRow): boolean {
    if (!canEdit || !row.editable) return false;
    if (row.group === "maintenance" && !canEditCritical) return false;
    return true;
  }

  function renderLinkCard(card: SettingsBasicLinkCard) {
    const allowed =
      card.permission == null || linkPermissions[card.permission] === true;

    return (
      <Card
        key={card.id}
        className={cn(
          "border-border/80 shadow-sm transition-colors",
          allowed ? "hover:border-primary/30" : "opacity-60",
        )}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{card.title}</CardTitle>
          <CardDescription className="text-sm">{card.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {allowed ? (
            <Link
              href={card.href}
              className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium shadow-xs transition-colors"
            >
              Открыть раздел
            </Link>
          ) : (
            <p className="text-muted-foreground text-xs">
              Нет доступа к этому разделу.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {canEdit ? null : (
        <Alert>
          <AlertTitle>Только просмотр</AlertTitle>
          <AlertDescription>
            Нет права settings.manage — доступно только чтение основных настроек.
          </AlertDescription>
        </Alert>
      )}

      {message ? (
        <Alert variant={message.type === "err" ? "destructive" : "default"}>
          <AlertTitle>{message.type === "ok" ? "Готово" : "Ошибка"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Безопасные настройки проекта. Технические параметры — в расширенном режиме.
        </p>
        {advancedCount > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={onShowAdvanced}>
            Показать расширенные настройки ({advancedCount})
          </Button>
        ) : null}
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Основные настройки</CardTitle>
          <CardDescription>
            Название сервиса, email поддержки и валюта по умолчанию.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editableRows.map((s) => {
            const val = values[s.key];
            const rowWritable = canEditRow(s);
            return (
              <div key={s.key} className="space-y-2">
                <div>
                  <p className="text-foreground text-sm font-medium">{humanLabel(s)}</p>
                  <p className="text-muted-foreground text-xs">{s.description}</p>
                </div>
                <Input
                  value={typeof val === "string" ? val : String(val ?? "")}
                  onChange={(e) =>
                    setValues((m) => ({ ...m, [s.key]: e.target.value }))
                  }
                  readOnly={!rowWritable}
                  className="max-w-md font-mono text-sm"
                />
                {rowWritable ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => onSaveKey(s.key)}
                  >
                    Сохранить
                  </Button>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {SETTINGS_BASIC_LINK_CARDS.map(renderLinkCard)}
      </div>
    </div>
  );
}
