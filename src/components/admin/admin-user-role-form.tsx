"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";

import { updateAdminUserRoleAction } from "@/server/actions/admin-user-role";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { UserRole } from "@/generated/prisma/enums";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "USER", label: "USER" },
  { value: "MODERATOR", label: "MODERATOR" },
  { value: "ADMIN", label: "ADMIN" },
  { value: "SUPER_ADMIN", label: "SUPER_ADMIN" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      Сохранить роль
    </Button>
  );
}

export function AdminUserRoleForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: UserRole;
}) {
  const [state, formAction] = useActionState(updateAdminUserRoleAction, null);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-1.5">
        <Label htmlFor="user-role">Роль</Label>
        <select
          id="user-role"
          name="role"
          className="border-input bg-background h-9 min-w-[12rem] rounded-md border px-2 text-sm"
          defaultValue={currentRole}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton />
      {state?.error ? <p className="text-destructive w-full text-sm">{state.error}</p> : null}
      {state?.ok ? <p className="text-muted-foreground w-full text-sm">Роль обновлена</p> : null}
    </form>
  );
}
