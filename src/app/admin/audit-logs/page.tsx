import { AdminEmpty } from "@/components/admin/admin-empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminAuditLogsList } from "@/lib/admin-data";
import { formatAdminDateTime, truncate } from "@/lib/admin-format";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Аудит — админ" };

export default async function AdminAuditLogsPage() {
  const res = await getAdminAuditLogsList();
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
  if (res.rows.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Аудит администраторов</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Логи ручных действий.
        </p>
        <div className="mt-6">
          <AdminEmpty
            title="Записей нет"
            description="Создаются при изменениях баланса, моделей, настроек."
          />
        </div>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Аудит администраторов</h1>
      <p className="text-muted-foreground mt-1 text-sm">До 50 последних.</p>
      <div className="mt-6 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Время</TableHead>
              <TableHead>Админ</TableHead>
              <TableHead>Действие</TableHead>
              <TableHead>Цель</TableHead>
              <TableHead>Детали</TableHead>
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
                <TableCell className="text-xs">{a.action}</TableCell>
                <TableCell className="text-xs">
                  {a.targetType}
                  {a.targetId ? ` · ${a.targetId}` : ""}
                </TableCell>
                <TableCell
                  className="text-muted-foreground max-w-[8rem] text-xs"
                  title={JSON.stringify({ old: a.oldValue, new: a.newValue })}
                >
                  {truncate(JSON.stringify({ o: a.oldValue, n: a.newValue }), 40)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
