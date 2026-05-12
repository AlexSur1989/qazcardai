import Link from "next/link";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { AdminUsersFiltersForm } from "@/components/admin/admin-users-filters-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminUsersList } from "@/lib/admin-data";
import { formatAdminDateTime } from "@/lib/admin-format";
import { AlertCircle } from "lucide-react";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Пользователи — QazCard AI" };

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireAdminPagePermission("users.view");
  const sp = (await searchParams) ?? {};
  const lpRaw = first(sp.loginProvider).trim();
  const loginProvider =
    lpRaw === "telegram" || lpRaw === "credentials" ? lpRaw : undefined;

  const res = await getAdminUsersList(
    loginProvider ? { loginProvider } : undefined,
  );
  if (!res.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Пользователи</h1>
        <Alert className="mt-4" variant="destructive">
          <AlertCircle />
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>Проверьте подключение к базе.</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (res.rows.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Пользователи</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          До 50 записей, новые сверху.
        </p>
        <div className="mt-6">
          <AdminEmpty
            title="Пользователей нет"
            description="Создайте учётные записи через регистрацию."
          />
        </div>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Пользователи</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        До 50 записей, новые сверху. Кредиты: откройте карточку пользователя.
      </p>
      <div className="mt-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <AdminUsersFiltersForm loginProviderValue={lpRaw} />
      </div>
      <div className="mt-6 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Вход</TableHead>
              <TableHead>Имя</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Кредиты</TableHead>
              <TableHead>Создан</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {res.rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="max-w-[12rem] truncate text-xs">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-primary font-medium underline-offset-2 hover:underline"
                  >
                    {u.email}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {u.hasTelegramIdentity ? "Telegram" : "Email / пароль"}
                </TableCell>
                <TableCell className="text-xs">
                  {u.name?.trim() || "—"}
                </TableCell>
                <TableCell className="text-xs font-mono">{u.role}</TableCell>
                <TableCell className="text-xs">{u.status}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {u.balanceCredits}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatAdminDateTime(u.createdAt)}
                </TableCell>
                <TableCell className="text-end text-xs">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-primary whitespace-nowrap underline-offset-2 hover:underline"
                  >
                    Подробнее
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
