"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteAiModelAction,
  type AiModelActionState,
  toggleAiModelActiveAction,
} from "@/server/actions/ai-model";
import { cn } from "@/lib/utils";

const delInitial: AiModelActionState = null;

type ModelRowActionsProps = {
  id: string;
  isActive: boolean;
  canDelete: boolean;
};

export function ModelRowActions({
  id,
  isActive,
  canDelete,
}: ModelRowActionsProps) {
  const [delState, deleteAction] = useActionState(
    deleteAiModelAction,
    delInitial,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteFormId = `admin-delete-model-${id}`;

  return (
    <div className="flex max-w-[14rem] flex-col gap-1 sm:flex-row sm:items-center sm:gap-1">
      {delState?.error ? (
        <p className="text-destructive w-full text-[10px] sm:col-span-2">
          {delState.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        <form action={toggleAiModelActiveAction} className="inline">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="nextActive" value={String(!isActive)} />
          <button
            type="submit"
            className={cn(
              buttonVariants({ size: "xs", variant: isActive ? "outline" : "secondary" }),
            )}
          >
            {isActive ? "Выкл" : "Вкл"}
          </button>
        </form>
        <Link
          href={`/admin/models/${id}/edit`}
          className={cn(
            buttonVariants({ size: "xs", variant: "secondary" }),
            "no-underline",
          )}
        >
          Правка
        </Link>
        <form id={deleteFormId} action={deleteAction} className="hidden" aria-hidden>
          <input type="hidden" name="id" value={id} />
        </form>
        <button
          type="button"
          disabled={!canDelete}
          className={cn(
            buttonVariants({ size: "xs", variant: "destructive" }),
            !canDelete && "pointer-events-none opacity-40",
          )}
          title={
            canDelete
              ? "Удалить"
              : "Нельзя удалить: у модели есть генерации"
          }
          onClick={() => {
            if (canDelete) setConfirmOpen(true);
          }}
        >
          Удалить
        </button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Удалить AI-модель?"
          description="Модель будет удалена из каталога. Пока с ней не связаны генерации — операция разрешена."
          confirmLabel="Удалить"
          variant="destructive"
          onConfirm={() => {
            const f = document.getElementById(deleteFormId) as HTMLFormElement | null;
            f?.requestSubmit();
          }}
        />
      </div>
    </div>
  );
}
