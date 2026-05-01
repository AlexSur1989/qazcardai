"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";

import { updateUserStatusAction } from "@/server/actions/admin-user-status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { UserStatus } from "@/generated/prisma/enums";

const STATUSES: UserStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "BLOCKED",
  "PENDING_VERIFICATION",
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      Сохранить статус
    </Button>
  );
}

export function AdminUserStatusForm({
  userId,
  currentStatus,
}: {
  userId: string;
  currentStatus: UserStatus;
}) {
  const [state, formAction] = useActionState(updateUserStatusAction, null);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-1.5">
        <Label htmlFor="user-status">Статус</Label>
        <select
          id="user-status"
          name="status"
          className="border-input bg-background h-9 min-w-[12rem] rounded-md border px-2 text-sm"
          defaultValue={currentStatus}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton />
      {state?.error ? <p className="text-destructive w-full text-sm">{state.error}</p> : null}
      {state?.ok ? <p className="text-muted-foreground w-full text-sm">Статус обновлён</p> : null}
    </form>
  );
}
