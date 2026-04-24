"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: "default" | "destructive";
  /** e.g. disable while server action is pending (parent handles) */
  confirmDisabled?: boolean;
};

/**
 * Модальное подтверждение (Base UI Dialog + Tailwind), без смены бизнес-логики.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Отмена",
  onConfirm,
  variant = "default",
  confirmDisabled = false,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Viewport className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup
            className={cn(
              "border-border/80 bg-card text-card-foreground pointer-events-auto w-full max-w-md rounded-lg border p-6 shadow-lg outline-none",
            )}
            initialFocus
          >
            <Dialog.Title className="text-foreground text-lg font-semibold tracking-tight">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {description}
              </Dialog.Description>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={variant === "destructive" ? "destructive" : "default"}
                disabled={confirmDisabled}
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
