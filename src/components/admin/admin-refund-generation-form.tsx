"use client";

import { useFormState, useFormStatus } from "react-dom";

import { adminRefundGenerationAction } from "@/server/actions/admin-generation-refund";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      Вернуть зарезервированные кредиты
    </Button>
  );
}

export function AdminRefundGenerationForm({ generationId }: { generationId: string }) {
  const [state, formAction] = useFormState(adminRefundGenerationAction, null);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="generationId" value={generationId} />
      <div>
        <Label htmlFor="refund-reason">Причина (в логе кредитов и аудите)</Label>
        <Textarea
          id="refund-reason"
          name="reason"
          rows={2}
          className="text-sm"
          placeholder="Напр.: сбой, по запросу пользователя"
        />
      </div>
      <SubmitButton />
      {state?.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state?.ok ? <p className="text-muted-foreground text-sm">Возврат выполнен</p> : null}
    </form>
  );
}
