"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, Pencil, Plus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelWithInfoTooltip } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils";

type Props = {
  displayName: string;
  hasProject: boolean;
  canRename: boolean;
  onRename: (title: string) => void;
  onNewProduct: () => void;
  newProductBusy?: boolean;
};

export function CurrentProductBar({
  displayName,
  hasProject,
  canRename,
  onRename,
  onNewProduct,
  newProductBusy = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);

  const startEdit = () => {
    setDraft(displayName);
    setEditing(true);
  };

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== displayName) {
      onRename(next);
    }
    setEditing(false);
  };

  return (
    <section
      className="rounded-2xl border border-primary/15 bg-white/90 p-4 shadow-sm"
      aria-label="Текущий товар"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-muted-foreground inline-flex items-center text-xs font-medium uppercase tracking-wide">
            <LabelWithInfoTooltip
              label="Текущий товар"
              tooltip="Все фото, карточки, концепции и видео сохраняются внутри этого товара."
            />
          </p>
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="max-w-xs"
                maxLength={200}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <Button type="button" size="sm" onClick={commitRename}>
                Сохранить
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Отмена
              </Button>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <Package className="text-primary size-5 shrink-0" aria-hidden />
              <p className="text-foreground truncate text-lg font-semibold">{displayName}</p>
              {canRename ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label="Переименовать товар"
                  onClick={startEdit}
                >
                  <Pencil className="size-3.5" />
                </Button>
              ) : null}
            </div>
          )}
          {!hasProject ? (
            <p className="text-muted-foreground text-sm">
              Загрузите фото или создайте новый товар — материалы будут сохранены внутри него.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/dashboard/products"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Мои товары
          </Link>
          <Button
            type="button"
            size="sm"
            onClick={onNewProduct}
            disabled={newProductBusy}
          >
            <Plus className="size-3.5" />
            Новый товар
          </Button>
        </div>
      </div>
    </section>
  );
}
