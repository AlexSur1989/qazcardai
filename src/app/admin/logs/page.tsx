import { AdminEmpty } from "@/components/admin/admin-empty";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminApiLogsList } from "@/lib/admin-data";
import { formatAdminDateTime, truncate } from "@/lib/admin-format";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "API логи — админ" };

export default async function AdminLogsPage() {
  const res = await getAdminApiLogsList();
  if (!res.ok) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="API логи"
          breadcrumbs={[{ label: "Админ", href: "/admin" }, { label: "Логи API" }]}
        />
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>Проверьте подключение к базе.</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (res.rows.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="API логи"
          description="Запросы к провайдерам (Kie.ai и др.)."
          breadcrumbs={[{ label: "Админ", href: "/admin" }, { label: "Логи API" }]}
        />
        <div>
          <AdminEmpty
            title="Логов нет"
            description="Появятся при интеграции генерации с провайдером."
          />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="API логи"
        description="До 50 последних."
        breadcrumbs={[{ label: "Админ", href: "/admin" }, { label: "Логи API" }]}
      />
      <div className="border-border/80 overflow-x-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Время</TableHead>
              <TableHead>Gen ID</TableHead>
              <TableHead>Провайдер</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>HTTP</TableHead>
              <TableHead>Ошибка</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {res.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatAdminDateTime(row.createdAt)}
                </TableCell>
                <TableCell className="max-w-[5rem] truncate font-mono text-xs">
                  {row.generationId ?? "—"}
                </TableCell>
                <TableCell className="text-xs">{row.provider}</TableCell>
                <TableCell
                  className="text-muted-foreground max-w-[10rem] text-xs"
                  title={row.endpoint}
                >
                  {truncate(row.endpoint, 40)}
                </TableCell>
                <TableCell className="text-xs">
                  {row.statusCode ?? "—"}
                </TableCell>
                <TableCell
                  className="text-muted-foreground max-w-xs text-xs"
                  title={row.errorMessage ?? undefined}
                >
                  {row.errorMessage
                    ? truncate(row.errorMessage, 56)
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
