"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";

import {
  createAppSettingAction,
  deleteAppSettingAction,
  type AppSettingActionState,
  seedExampleAppSettingsAction,
  updateAppSettingAction,
} from "@/server/actions/app-settings";
import { canDeleteAppSettingKey } from "@/lib/app-setting-protected";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Row = {
  id: string;
  key: string;
  type: string;
  value: unknown;
  description: string | null;
  /** ISO, для сериализации RSC → client */
  updatedAt: string;
  editor: { id: string; email: string } | null;
};

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {children}
    </Button>
  );
}

function valueToInput(value: unknown, type: string): string {
  if (type === "json") {
    return JSON.stringify(value, null, 2);
  }
  if (type === "boolean") {
    return value === true ? "true" : "false";
  }
  if (value === null || value === undefined) return "";
  return String(value);
}

function CreateForm() {
  const [state, formAction] = useFormState(createAppSettingAction, null);
  return (
    <form action={formAction} className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Создать настройку</h2>
      {state?.error ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}
      {state?.ok && state?.message ? (
        <p className="text-muted-foreground text-sm">{state.message}</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="new-key">Ключ (латиница, _)</Label>
          <Input id="new-key" name="key" required className="font-mono text-xs" />
        </div>
        <div>
          <Label htmlFor="new-type">Тип</Label>
          <select
            id="new-type"
            name="type"
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            required
          >
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="json">json</option>
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="new-val">Значение</Label>
        <Textarea id="new-val" name="value" rows={3} className="font-mono text-xs" required />
      </div>
      <div>
        <Label htmlFor="new-desc">Описание</Label>
        <Textarea id="new-desc" name="description" rows={2} className="text-sm" />
      </div>
      <SubmitButton>Создать</SubmitButton>
    </form>
  );
}

function SeedForm() {
  const [state, formAction] = useFormState(seedExampleAppSettingsAction, null);
  return (
    <form action={formAction} className="inline">
      {state?.message ? (
        <p className="text-muted-foreground mb-2 text-sm">{state.message}</p>
      ) : null}
      {state?.error ? <p className="text-destructive mb-2 text-sm">{state.error}</p> : null}
      <SubmitButton>Добавить отсутствующие примеры из списка</SubmitButton>
    </form>
  );
}

function DeleteForm({ id, settingKey }: { id: string; settingKey: string }) {
  const deletable = canDeleteAppSettingKey(settingKey);
  const [state, formAction] = useFormState(deleteAppSettingAction, null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formId = `app-setting-del-${id}`;
  if (!deletable) {
    return (
      <span className="text-muted-foreground text-xs" title="Системный ключ">
        нельзя удалить
      </span>
    );
  }
  return (
    <div className="inline-block space-y-1">
      {state?.error ? <p className="text-destructive text-xs">{state.error}</p> : null}
      <form id={formId} action={formAction} className="hidden" aria-hidden>
        <input type="hidden" name="id" value={id} />
      </form>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setConfirmOpen(true)}
      >
        Удалить
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Удалить настройку?"
        description={
          <>
            Ключ: <code className="font-mono text-xs">{settingKey}</code>. Действие
            нельзя откатить.
          </>
        }
        confirmLabel="Удалить"
        variant="destructive"
        onConfirm={() => {
          const f = document.getElementById(formId) as HTMLFormElement | null;
          f?.requestSubmit();
        }}
      />
    </div>
  );
}

function EditBlock({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(updateAppSettingAction, null);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Изменить
      </Button>
    );
  }

  return (
    <form action={formAction} className="bg-muted/40 space-y-2 rounded-md border p-3">
      <input type="hidden" name="id" value={row.id} />
      {state?.error ? <p className="text-destructive text-xs">{state.error}</p> : null}
      {state?.ok ? (
        <p className="text-muted-foreground text-xs">Сохранено</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label>Тип</Label>
          <select
            name="type"
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-xs"
            defaultValue={row.type}
            required
          >
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="json">json</option>
          </select>
        </div>
        <p className="self-end text-xs text-muted-foreground">Ключ: {row.key}</p>
      </div>
      <div>
        <Label>Значение</Label>
        <Textarea
          name="value"
          rows={4}
          className="font-mono text-xs"
          key={row.updatedAt}
          defaultValue={valueToInput(row.value, row.type)}
          required
        />
      </div>
      <div>
        <Label>Описание</Label>
        <Textarea
          name="description"
          rows={2}
          className="text-sm"
          defaultValue={row.description ?? ""}
        />
      </div>
      <div className="flex gap-2">
        <SubmitButton>Сохранить</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

export function AppSettingsClientSection({
  rows,
}: {
  rows: Row[];
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Пакет примеров (без дублей)</h2>
        <SeedForm />
      </div>
      <CreateForm />
      <div className="border-border/80 overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b text-left text-xs">
              <th className="p-2">Ключ</th>
              <th className="p-2">Тип</th>
              <th className="p-2">Кратко</th>
              <th className="p-2">updatedBy</th>
              <th className="p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b align-top">
                <td className="p-2 font-mono text-xs">{r.key}</td>
                <td className="p-2 text-xs">{r.type}</td>
                <td className="text-muted-foreground max-w-xs p-2 text-xs">
                  {typeof r.value === "object" ? JSON.stringify(r.value).slice(0, 80) : String(r.value)}
                </td>
                <td className="p-2 text-xs">{r.editor?.email ?? "—"}</td>
                <td className="p-2 space-y-2">
                  <EditBlock row={r} />
                  <DeleteForm id={r.id} settingKey={r.key} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
