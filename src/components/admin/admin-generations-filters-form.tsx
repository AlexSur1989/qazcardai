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

type UserOpt = { id: string; email: string };
type ModelOpt = { id: string; name: string; slug: string; type: string };

type Props = {
  userIdValue: string;
  typeValue: string;
  statusValue: string;
  modelIdValue: string;
  qValue: string;
  users: UserOpt[];
  models: ModelOpt[];
};

export function AdminGenerationsFiltersForm({
  userIdValue,
  typeValue,
  statusValue,
  modelIdValue,
  qValue,
  users,
  models,
}: Props) {
  return (
    <form
      method="get"
      action="/admin/generations"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      <div className="space-y-1">
        <Label htmlFor="ag-user" className="text-xs text-muted-foreground">
          Пользователь
        </Label>
        <select
          id="ag-user"
          name="userId"
          defaultValue={userIdValue}
          className={cn(
            "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          )}
        >
          <option value="">Все</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ag-type" className="text-xs text-muted-foreground">
          Тип
        </Label>
        <select
          id="ag-type"
          name="type"
          defaultValue={typeValue}
          className={cn(
            "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          )}
        >
          <option value="">Все</option>
          <option value="IMAGE">IMAGE</option>
          <option value="VIDEO">VIDEO</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ag-status" className="text-xs text-muted-foreground">
          Статус
        </Label>
        <select
          id="ag-status"
          name="status"
          defaultValue={statusValue}
          className={cn(
            "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm",
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
      <div className="space-y-1">
        <Label htmlFor="ag-model" className="text-xs text-muted-foreground">
          Модель
        </Label>
        <select
          id="ag-model"
          name="modelId"
          defaultValue={modelIdValue}
          className={cn(
            "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          )}
        >
          <option value="">Все</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.type})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1 sm:col-span-2 lg:col-span-2">
        <Label htmlFor="ag-q" className="text-xs text-muted-foreground">
          Поиск в промпте
        </Label>
        <Input
          id="ag-q"
          name="q"
          type="search"
          defaultValue={qValue}
          placeholder="Подстрока промпта"
          className="h-9"
        />
      </div>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
        <Button type="submit" size="sm" className="h-9">
          Применить
        </Button>
        <Link
          href="/admin/generations"
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
