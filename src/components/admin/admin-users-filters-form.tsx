import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  loginProviderValue: string;
};

export function AdminUsersFiltersForm({ loginProviderValue }: Props) {
  return (
    <form
      method="get"
      action="/admin/users"
      className="flex flex-wrap items-end gap-3"
    >
      <div className="space-y-1">
        <Label htmlFor="auf-login" className="text-xs text-muted-foreground">
          Способ входа
        </Label>
        <select
          id="auf-login"
          name="loginProvider"
          defaultValue={loginProviderValue}
          className={cn(
            "border-input h-9 min-w-[12rem] rounded-md border bg-transparent px-2 text-sm",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          )}
        >
          <option value="">Все</option>
          <option value="credentials">Email / пароль</option>
          <option value="telegram">Telegram</option>
        </select>
      </div>
      <Button type="submit" size="sm" className="h-9">
        Применить
      </Button>
      <Link
        href="/admin/users"
        className={cn(
          buttonVariants({ variant: "secondary", size: "sm" }),
          "inline-flex h-9 items-center justify-center",
        )}
      >
        Сброс
      </Link>
    </form>
  );
}
