"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";

import { createPromoCodeAction, updatePromoCodeAction } from "@/server/actions/promo-codes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PromoRow = {
  id: string;
  code: string;
  type: string;
  value: { toString: () => string };
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: Date | null;
};

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {children}
    </Button>
  );
}

function CreateForm() {
  const [state, formAction] = useFormState(createPromoCodeAction, null);
  return (
    <form action={formAction} className="mb-8 space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Новый промокод</h2>
      {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state?.ok ? <p className="text-muted-foreground text-sm">Создано</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="p-code">Код</Label>
          <Input id="p-code" name="code" required className="font-mono text-xs" />
        </div>
        <div>
          <Label htmlFor="p-type">type</Label>
          <Input
            id="p-type"
            name="type"
            placeholder="FIXED_CREDITS"
            className="text-xs"
            required
          />
        </div>
        <div>
          <Label htmlFor="p-val">value (decimal)</Label>
          <Input id="p-val" name="value" className="text-xs" required />
        </div>
        <div>
          <Label htmlFor="p-max">max uses (пусто = без лимита)</Label>
          <Input id="p-max" name="maxUses" type="number" min={0} className="text-xs" />
        </div>
        <div>
          <Label htmlFor="p-exp">истекает (дата, опц.)</Label>
          <Input id="p-exp" name="expiresAt" type="datetime-local" className="text-xs" />
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked className="rounded border" />
            Активен
          </label>
        </div>
      </div>
      <SubmitButton>Создать</SubmitButton>
    </form>
  );
}

function EditRow({ p }: { p: PromoRow }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(updatePromoCodeAction, null);
  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Изменить
      </Button>
    );
  }
  const exp =
    p.expiresAt != null
      ? new Date(p.expiresAt).toISOString().slice(0, 16)
      : "";
  return (
    <form action={formAction} className="bg-muted/40 space-y-2 rounded-md border p-3">
      <input type="hidden" name="id" value={p.id} />
      {state?.error ? <p className="text-destructive text-xs">{state.error}</p> : null}
      {state?.ok ? <p className="text-muted-foreground text-xs">Сохранено</p> : null}
      <p className="text-muted-foreground font-mono text-xs">код: {p.code} (id не меняется)</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label>type</Label>
          <Input name="type" defaultValue={p.type} className="text-xs" required />
        </div>
        <div>
          <Label>value</Label>
          <Input name="value" defaultValue={p.value.toString()} className="text-xs" required />
        </div>
        <div>
          <Label>max uses</Label>
          <Input
            name="maxUses"
            type="number"
            min={0}
            className="text-xs"
            defaultValue={p.maxUses ?? ""}
          />
        </div>
        <div>
          <Label>истекает</Label>
          <Input name="expiresAt" type="datetime-local" className="text-xs" defaultValue={exp} />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={p.isActive}
              className="rounded border"
            />
            Активен
          </label>
        </div>
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

export function PromoCodesClientTable({ rows }: { rows: PromoRow[] }) {
  return (
    <div>
      <CreateForm />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b text-left text-xs">
              <th className="p-2">Код</th>
              <th className="p-2">Тип</th>
              <th className="p-2">Знач.</th>
              <th className="p-2">Исп.</th>
              <th className="p-2">Акт.</th>
              <th className="p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b align-top">
                <td className="p-2 font-mono text-xs">{p.code}</td>
                <td className="p-2 text-xs">{p.type}</td>
                <td className="p-2 text-xs">{p.value.toString()}</td>
                <td className="p-2 text-xs">
                  {p.usedCount}
                  {p.maxUses != null ? ` / ${p.maxUses}` : ""}
                </td>
                <td className="p-2 text-xs">{p.isActive ? "да" : "нет"}</td>
                <td className="p-2">
                  <EditRow p={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
