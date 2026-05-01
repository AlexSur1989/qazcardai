import Link from "next/link";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminAdminsForFilter, getAdminAuditLogsList } from "@/lib/admin-data";
import { formatAdminDateTime, truncate } from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Аудит — QazCard AI" };

type SearchProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminAuditLogsPage({ searchParams }: SearchProps) {
  const sp = await searchParams;
  const action = typeof sp.action === "string" ? sp.action : "";
  const adminUserId = typeof sp.adminUserId === "string" ? sp.adminUserId : "";
  const targetType = typeof sp.targetType === "string" ? sp.targetType : "";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";
  const page = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;

  const [res, admins] = await Promise.all([
    getAdminAuditLogsList({
      action: action || undefined,
      adminUserId: adminUserId || undefined,
      targetType: targetType || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
    }),
    getAdminAdminsForFilter(),
  ]);

  if (!res.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Аудит</h1>
        <Alert className="mt-4" variant="destructive">
          <AlertCircle />
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>Проверьте подключение к базе.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(res.total / res.pageSize));
  const q = new URLSearchParams();
  if (action) q.set("action", action);
  if (adminUserId) q.set("adminUserId", adminUserId);
  if (targetType) q.set("targetType", targetType);
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const baseQS = q.toString();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Аудит администраторов</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Только чтение. Фильтры — через GET, записи не редактируются.
      </p>

      <form
        method="get"
        className="mt-6 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="grid flex-1 gap-2 sm:min-w-[10rem]">
          <Label htmlFor="f-action">action (часть строки)</Label>
          <Input id="f-action" name="action" defaultValue={action} placeholder="user.balance" />
        </div>
        <div className="grid gap-2 sm:min-w-[12rem]">
          <Label htmlFor="f-admin">Админ</Label>
          <select
            id="f-admin"
            name="adminUserId"
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            defaultValue={adminUserId}
          >
            <option value="">— все —</option>
            {admins.ok
              ? admins.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))
              : null}
          </select>
        </div>
        <div className="grid gap-2 sm:min-w-[8rem]">
          <Label htmlFor="f-tt">targetType</Label>
          <Input id="f-tt" name="targetType" defaultValue={targetType} placeholder="User" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="f-from">С даты</Label>
          <Input id="f-from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="f-to">По дату</Label>
          <Input id="f-to" name="to" type="date" defaultValue={to} />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className={cn(buttonVariants({ size: "sm" }), "h-9 self-end")}
          >
            Применить
          </button>
          <Link
            href="/admin/audit-logs"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 self-end")}
          >
            Сброс
          </Link>
        </div>
      </form>

      {res.rows.length === 0 ? (
        <div className="mt-6">
          <AdminEmpty title="Нет записей" description="Смените фильтры или выполните действия в админке." />
        </div>
      ) : (
        <>
          <p className="text-muted-foreground mt-4 text-xs">
            Стр. {res.page} из {totalPages} · всего {res.total}
          </p>
          <div className="mt-2 overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Время</TableHead>
                  <TableHead>Админ</TableHead>
                  <TableHead>Действие</TableHead>
                  <TableHead>Цель</TableHead>
                  <TableHead>old / new / meta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {res.rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatAdminDateTime(a.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-[9rem] truncate text-xs">
                      {a.admin.email}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.action}</TableCell>
                    <TableCell className="text-xs">
                      {a.targetType}
                      {a.targetId ? ` · ${a.targetId}` : ""}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground max-w-md text-xs"
                      title={JSON.stringify({ o: a.oldValue, n: a.newValue, m: a.metadata })}
                    >
                      {truncate(
                        JSON.stringify({ o: a.oldValue, n: a.newValue, m: a.metadata }),
                        120,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {res.page > 1 ? (
              <Link
                className={buttonVariants({ variant: "outline", size: "sm" })}
                href={`/admin/audit-logs?${baseQS ? `${baseQS}&` : ""}page=${res.page - 1}`}
              >
                Назад
              </Link>
            ) : null}
            {res.page < totalPages ? (
              <Link
                className={buttonVariants({ variant: "outline", size: "sm" })}
                href={`/admin/audit-logs?${baseQS ? `${baseQS}&` : ""}page=${res.page + 1}`}
              >
                Вперёд
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
