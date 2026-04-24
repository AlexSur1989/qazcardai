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
import { getAdminWebhookEventsList } from "@/lib/admin-data";
import { formatAdminDateTime, truncate } from "@/lib/admin-format";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Webhooks — админ" };

export default async function AdminWebhooksPage() {
  const res = await getAdminWebhookEventsList();
  if (!res.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
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
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Входящие события (провайдер, оплата).
        </p>
        <div className="mt-6">
          <AdminEmpty
            title="Событий нет"
            description="Сохраняются вебхуками воркеров и платёжек."
          />
        </div>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
      <p className="text-muted-foreground mt-1 text-sm">До 50 последних.</p>
      <div className="mt-6 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Время</TableHead>
              <TableHead>Провайдер</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Ошибка</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {res.rows.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatAdminDateTime(w.createdAt)}
                </TableCell>
                <TableCell className="text-xs">{w.provider}</TableCell>
                <TableCell className="max-w-[8rem] truncate text-xs">
                  {w.eventType}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {w.status}
                  </Badge>
                </TableCell>
                <TableCell
                  className="text-muted-foreground max-w-xs text-xs"
                  title={w.errorMessage ?? undefined}
                >
                  {w.errorMessage
                    ? truncate(w.errorMessage, 48)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
