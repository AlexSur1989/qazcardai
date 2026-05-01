"use client";

import { useFormStatus } from "react-dom";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKzt } from "@/lib/format-kzt";
import {
  createTokenPackageAction,
  updateTokenPackageAction,
  deleteTokenPackageAction,
  adminGrantTokenPackageAction,
} from "@/server/actions/token-packages";
import { Badge } from "@/components/ui/badge";
import type { TokenPackage } from "@/generated/prisma/client";

type UserOption = { id: string; email: string };

function SubmitButton({ children, variant }: { children: React.ReactNode; variant?: "default" | "outline" | "destructive" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant ?? "default"} disabled={pending}>
      {children}
    </Button>
  );
}

function CreateForm() {
  const [state, formAction] = useActionState(createTokenPackageAction, null);
  return (
    <form action={formAction} className="mb-8 space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Новый пакет</h2>
      {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state?.ok ? <p className="text-muted-foreground text-sm">Создано</p> : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor="np-name">Название</Label>
          <Input id="np-name" name="name" required className="text-xs" />
        </div>
        <div>
          <Label htmlFor="np-slug">slug</Label>
          <Input id="np-slug" name="slug" required className="font-mono text-xs" />
        </div>
        <div>
          <Label htmlFor="np-price">Цена, ₸</Label>
          <Input id="np-price" name="priceKzt" type="number" min={1} required className="text-xs" />
        </div>
        <div>
          <Label htmlFor="np-base">База токенов</Label>
          <Input id="np-base" name="baseTokens" type="number" min={1} required className="text-xs" />
        </div>
        <div>
          <Label htmlFor="np-bonus">Бонус токенов</Label>
          <Input id="np-bonus" name="bonusTokens" type="number" min={0} defaultValue={0} className="text-xs" />
        </div>
        <div>
          <Label htmlFor="np-sort">sortOrder</Label>
          <Input id="np-sort" name="sortOrder" type="number" defaultValue={0} className="text-xs" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="np-desc">Описание</Label>
          <Input id="np-desc" name="description" className="text-xs" />
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

function EditRow({ p }: { p: TokenPackage }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updateTokenPackageAction, null);
  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Изменить
        </Button>
        <DeletePackageForm id={p.id} />
      </div>
    );
  }
  return (
    <form action={formAction} className="bg-muted/40 space-y-2 rounded-md border p-3">
      <input type="hidden" name="id" value={p.id} />
      {state?.error ? <p className="text-destructive text-xs">{state.error}</p> : null}
      {state?.ok ? <p className="text-muted-foreground text-xs">Сохранено</p> : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>Название</Label>
          <Input name="name" defaultValue={p.name} className="text-xs" required />
        </div>
        <div>
          <Label>slug</Label>
          <Input name="slug" defaultValue={p.slug} className="font-mono text-xs" required />
        </div>
        <div>
          <Label>Цена, ₸</Label>
          <Input name="priceKzt" type="number" min={1} defaultValue={p.priceKzt} className="text-xs" required />
        </div>
        <div>
          <Label>База</Label>
          <Input name="baseTokens" type="number" min={1} defaultValue={p.baseTokens} className="text-xs" required />
        </div>
        <div>
          <Label>Бонус</Label>
          <Input name="bonusTokens" type="number" min={0} defaultValue={p.bonusTokens} className="text-xs" required />
        </div>
        <div>
          <Label>sortOrder</Label>
          <Input name="sortOrder" type="number" defaultValue={p.sortOrder} className="text-xs" required />
        </div>
        <div className="sm:col-span-2">
          <Label>Описание</Label>
          <Input name="description" defaultValue={p.description ?? ""} className="text-xs" />
        </div>
        <div className="flex items-end">
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
      <p className="text-muted-foreground text-xs">
        В БД: итог токенов = база + бонус (пересчитывается при сохранении).
      </p>
      <div className="flex gap-2">
        <SubmitButton>Сохранить</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="outline"
      className="text-destructive"
      disabled={pending}
    >
      Удалить
    </Button>
  );
}

function DeletePackageForm({ id }: { id: string }) {
  const [state, formAction] = useActionState(deleteTokenPackageAction, null);
  return (
    <form action={formAction} className="inline flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      {state?.error ? <p className="text-destructive max-w-xs text-xs">{state.error}</p> : null}
      {state?.ok ? <p className="text-muted-foreground text-xs">Удалено</p> : null}
      <DeleteSubmit />
    </form>
  );
}

function GrantForm({ users, packages }: { users: UserOption[]; packages: TokenPackage[] }) {
  const [state, formAction] = useActionState(adminGrantTokenPackageAction, null);
  const activePackages = packages.filter((p) => p.isActive);
  return (
    <form action={formAction} className="mb-4 space-y-3 rounded-lg border border-dashed p-4">
      <h2 className="text-sm font-medium">Ручное начисление (тест / без оплаты)</h2>
      {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state?.ok ? <p className="text-muted-foreground text-sm">Начислено</p> : null}
      <p className="text-muted-foreground text-xs">
        Только для активных пакетов. Создаётся PURCHASE в истории (без paymentId).
      </p>
      <div className="grid gap-2 sm:grid-cols-2 sm:max-w-xl">
        <div>
          <Label htmlFor="g-user">Пользователь</Label>
          <select
            id="g-user"
            name="userId"
            required
            className="border-border bg-background h-9 w-full rounded-md border px-2 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              выберите…
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="g-pkg">Пакет</Label>
          <select
            id="g-pkg"
            name="tokenPackageId"
            required
            className="border-border bg-background h-9 w-full rounded-md border px-2 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              выберите…
            </option>
            {activePackages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.baseTokens + p.bonusTokens} ток. ({p.slug})
              </option>
            ))}
          </select>
        </div>
      </div>
      <SubmitButton>Начислить пакет</SubmitButton>
    </form>
  );
}

type Props = {
  packages: TokenPackage[];
  users: UserOption[];
};

export function TokenPackagesAdmin({ packages, users }: Props) {
  return (
    <div>
      <CreateForm />
      <GrantForm users={users} packages={packages} />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b text-left text-xs">
              <th className="p-2">Название / slug</th>
              <th className="p-2">Цена</th>
              <th className="p-2">База</th>
              <th className="p-2">Бонус</th>
              <th className="p-2">Итого</th>
              <th className="p-2">Активен</th>
              <th className="p-2">order</th>
              <th className="p-2 w-[220px]">Действия</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id} className="border-b align-top last:border-0">
                <td className="p-2">
                  <span className="font-medium">{p.name}</span>
                  <br />
                  <code className="text-muted-foreground text-xs">{p.slug}</code>
                  {p.description ? (
                    <p className="text-muted-foreground mt-1 max-w-md text-xs">{p.description}</p>
                  ) : null}
                </td>
                <td className="p-2 tabular-nums whitespace-nowrap">{formatKzt(p.priceKzt)}</td>
                <td className="p-2 tabular-nums">{p.baseTokens}</td>
                <td className="p-2 tabular-nums">{p.bonusTokens}</td>
                <td className="p-2 tabular-nums font-medium">{p.totalTokens}</td>
                <td className="p-2">
                  <Badge variant={p.isActive ? "secondary" : "outline"}>
                    {p.isActive ? "да" : "нет"}
                  </Badge>
                </td>
                <td className="p-2 tabular-nums text-muted-foreground">{p.sortOrder}</td>
                <td className="p-2">
                  <EditRow p={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {packages.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">Пакетов нет. Создайте или выполните seed.</p>
      ) : null}
    </div>
  );
}
