import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { GenerationStatus } from "@/generated/prisma/enums";

const STATUSES: GenerationStatus[] = [
  "CREATED",
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "BLOCKED",
  "CANCELLED",
  "REFUNDED",
];

const STATUS_LABEL: Record<GenerationStatus, string> = {
  CREATED: "Создана",
  QUEUED: "В очереди",
  PROCESSING: "В обработке",
  COMPLETED: "Готово",
  FAILED: "Ошибка",
  BLOCKED: "Блок",
  CANCELLED: "Отмена",
  REFUNDED: "Возврат",
};

type Props = {
  typeValue: string;
  statusValue: string;
  qValue: string;
};

export function HistoryFiltersForm({ typeValue, statusValue, qValue }: Props) {
  return (
    <form
      method="get"
      action="/dashboard/history"
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="space-y-1">
        <Label htmlFor="hf-type" className="text-xs text-muted-foreground">
          Тип
        </Label>
        <select
          id="hf-type"
          name="type"
          defaultValue={typeValue}
          className={cn(
            "border-input h-9 min-w-[9rem] rounded-md border bg-transparent px-2 text-sm",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          )}
        >
          <option value="">Все</option>
          <option value="IMAGE">Фото</option>
          <option value="VIDEO">Видео</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="hf-status" className="text-xs text-muted-foreground">
          Статус
        </Label>
        <select
          id="hf-status"
          name="status"
          defaultValue={statusValue}
          className={cn(
            "border-input h-9 min-w-[10rem] rounded-md border bg-transparent px-2 text-sm",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          )}
        >
          <option value="">Все</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0 flex-1 space-y-1 sm:min-w-[12rem]">
        <Label htmlFor="hf-q" className="text-xs text-muted-foreground">
          Поиск в промпте
        </Label>
        <Input
          id="hf-q"
          name="q"
          type="search"
          defaultValue={qValue}
          placeholder="Слова из промпта"
          className="h-9"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" className="h-9">
          Применить
        </Button>
        <Link
          href="/dashboard/history"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "inline-flex h-9 items-center justify-center",
          )}
        >
          Сброс
        </Link>
      </div>
    </form>
  );
}
