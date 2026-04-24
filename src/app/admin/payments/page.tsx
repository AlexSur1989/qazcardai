import { AdminEmpty } from "@/components/admin/admin-empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminPaymentsList } from "@/lib/admin-data";
import { formatAdminDateTime } from "@/lib/admin-format";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Платежи — админ" };

export default async function AdminPaymentsPage() {
  const res = await getAdminPaymentsList();
  if (!res.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Платежи</h1>
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
        <h1 className="text-2xl font-semibold tracking-tight">Платежи</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Учёт платежей провайдера.
        </p>
        <div className="mt-6">
          <AdminEmpty
            title="Платежей нет"
            description="Появятся после внедрения оплаты."
          />
        </div>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Платежи</h1>
      <p className="text-muted-foreground mt-1 text-sm">До 50 последних.</p>
      <div className="mt-6 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Пользователь</TableHead>
              <TableHead>Провайдер</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead>Кр.</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Создан</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {res.rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-[9rem] truncate text-xs">
                  {p.user.email}
                </TableCell>
                <TableCell className="text-xs">{p.provider}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {p.amount.toString()} {p.currency}
                </TableCell>
                <TableCell className="text-xs tabular-nums">{p.credits}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatAdminDateTime(p.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
