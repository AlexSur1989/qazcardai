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
import { adminTerm } from "@/lib/admin-terms";
import { AlertCircle } from "lucide-react";

function jsonPreview(v: unknown, max: number): string {
  if (v == null) return "—";
  try {
    return truncate(JSON.stringify(v), max);
  } catch {
    return "—";
  }
}

export const metadata = { title: "Webhooks — QazCard AI" };

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
              <TableHead className="min-w-[6rem] text-[0.7rem] leading-tight">
                {adminTerm("webhookEvent")}
              </TableHead>
              <TableHead className="min-w-[5rem] text-[0.7rem] leading-tight">
                {adminTerm("createdAt")}
              </TableHead>
              <TableHead className="min-w-[5rem] text-[0.7rem] leading-tight">
                {adminTerm("provider")}
              </TableHead>
              <TableHead className="min-w-[6rem] text-[0.7rem] leading-tight">
                {adminTerm("eventType")}
              </TableHead>
              <TableHead className="min-w-[8rem] max-w-[12rem] text-[0.7rem] leading-tight">
                {adminTerm("payload")}
              </TableHead>
              <TableHead className="min-w-[4rem] text-[0.7rem] leading-tight">
                {adminTerm("status")}
              </TableHead>
              <TableHead className="min-w-[6rem] text-[0.7rem] leading-tight">
                {adminTerm("processedAt")}
              </TableHead>
              <TableHead className="min-w-[6rem] max-w-[8rem] text-[0.7rem] leading-tight">
                {adminTerm("errorMessage")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {res.rows.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-mono text-[0.65rem] text-xs break-all">
                  {truncate(w.id, 12)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatAdminDateTime(w.createdAt)}
                </TableCell>
                <TableCell className="text-xs">{w.provider}</TableCell>
                <TableCell className="max-w-[8rem] truncate text-xs">
                  {w.eventType}
                </TableCell>
                <TableCell
                  className="text-muted-foreground max-w-[12rem] align-top text-[0.65rem] leading-snug"
                  title={jsonPreview(w.payload, 8000)}
                >
                  {jsonPreview(w.payload, 96)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {w.status}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {w.processedAt ? formatAdminDateTime(w.processedAt) : "—"}
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
