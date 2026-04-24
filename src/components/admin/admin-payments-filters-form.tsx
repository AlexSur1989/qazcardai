import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { paymentStatusLabel } from "@/lib/payment-labels";
import type { PaymentStatus } from "@/generated/prisma/enums";

const STATUSES: PaymentStatus[] = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
];

type UserOpt = { id: string; email: string };

type Props = {
  userIdValue: string;
  statusValue: string;
  providerValue: string;
  users: UserOpt[];
};

export function AdminPaymentsFiltersForm({
  userIdValue,
  statusValue,
  providerValue,
  users,
}: Props) {
  return (
    <form
      method="get"
      action="/admin/payments"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="space-y-1">
        <Label htmlFor="ap-user" className="text-xs text-muted-foreground">
          Пользователь
        </Label>
        <select
          id="ap-user"
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
        <Label htmlFor="ap-status" className="text-xs text-muted-foreground">
          Статус
        </Label>
        <select
          id="ap-status"
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
              {paymentStatusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1 sm:col-span-2 lg:col-span-1">
        <Label htmlFor="ap-provider" className="text-xs text-muted-foreground">
          Провайдер
        </Label>
        <Input
          id="ap-provider"
          name="provider"
          defaultValue={providerValue}
          placeholder="stripe"
          className="h-9"
        />
      </div>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="sm" className="h-9">
          Применить
        </Button>
        <Link
          href="/admin/payments"
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
