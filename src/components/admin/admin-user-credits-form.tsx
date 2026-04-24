"use client";

import { useActionState, useEffect } from "react";

import {
  adminAdjustUserCreditsAction,
  type AdminCreditsFormState,
} from "@/server/actions/admin-user-credits";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const initial: AdminCreditsFormState = null;

type Props = {
  userId: string;
};

export function AdminUserCreditsForm({ userId }: Props) {
  const [state, formAction] = useActionState(
    adminAdjustUserCreditsAction,
    initial,
  );

  useEffect(() => {
    if (state?.ok) {
      const f = document.getElementById("admin-credits-form") as HTMLFormElement | null;
      f?.reset();
    }
  }, [state?.ok]);

  return (
    <form id="admin-credits-form" action={formAction} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      {state?.error ? (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok ? (
        <Alert>
          <AlertTitle>Готово</AlertTitle>
          <AlertDescription>Баланс обновлён.</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="delta">Изменение</Label>
          <Input
            id="delta"
            name="delta"
            type="number"
            step={1}
            required
            placeholder="+100 или −10"
          />
          <p className="text-muted-foreground text-xs">
            Положительное — начислить, отрицательное — списать.
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="reason">Причина *</Label>
          <Input id="reason" name="reason" required placeholder="Кратко" />
        </div>
      </div>
      <button type="submit" className={cn(buttonVariants())}>
        Применить
      </button>
    </form>
  );
}
