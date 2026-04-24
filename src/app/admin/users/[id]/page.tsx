import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";

import { AdminUserCreditsForm } from "@/components/admin/admin-user-credits-form";
import { AdminEmpty } from "@/components/admin/admin-empty";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminUserById } from "@/lib/admin-data";
import { creditTypeLabel } from "@/lib/credit-labels";
import { formatAdminDateTime } from "@/lib/admin-format";
import { listTransactions } from "@/server/services/credits";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
type Props = { params: Promise<{ id: string }> };

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  const res = await getAdminUserById(id);
  if (res.ok) {
    const { user } = res;
    const txs = await listTransactions(user.id, { take: 30 });

    return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/users"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-2 inline-flex items-center gap-1",
          )}
        >
          <ArrowLeft className="size-3.5" />
          К списку
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Пользователь</h1>
        <p className="text-foreground mt-1 font-mono text-sm">{user.email}</p>
        <p className="text-muted-foreground text-xs">id: {user.id}</p>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2 sm:max-w-md">
        <p>
          <span className="text-muted-foreground">Роль:</span> {user.role}
        </p>
        <p>
          <span className="text-muted-foreground">Статус:</span> {user.status}
        </p>
        <p>
          <span className="text-muted-foreground">Кредитов сейчас:</span>{" "}
          <span className="font-mono font-medium tabular-nums">
            {user.balanceCredits}
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">Регистрация:</span>{" "}
          {formatAdminDateTime(user.createdAt)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Корректировка кредитов</CardTitle>
          <CardDescription>
            Создаётся движение <code>ADMIN_ADJUSTMENT</code> и запись в аудите
            администратора.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminUserCreditsForm userId={user.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Операции с кредитами</CardTitle>
          <CardDescription>Последние 30 (новые сверху)</CardDescription>
        </CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <AdminEmpty
              title="Нет движений"
              description="Появятся после начислений, резервов и ручных правок."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead>Причина</TableHead>
                    <TableHead>Генерация</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txs.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatAdminDateTime(t.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {creditTypeLabel(t.type)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono tabular-nums">
                        {t.amount > 0 ? `+${t.amount}` : t.amount}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs text-xs">
                        {t.reason?.slice(0, 120) || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[6rem] truncate font-mono text-xs">
                        {t.generationId?.slice(0, 8) || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    );
  }
  if (res.error === "not_found") {
    notFound();
  }
  return (
    <div>
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Ошибка</AlertTitle>
        <AlertDescription>Не удалось загрузить пользователя.</AlertDescription>
      </Alert>
    </div>
  );
}
