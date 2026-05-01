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

export const metadata = { title: "API логи — QazCard AI" };

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
              <TableHead className="min-w-[7rem] text-[0.7rem] leading-tight">
                {adminTerm("createdAt")}
              </TableHead>
              <TableHead className="min-w-[6rem] text-[0.7rem] leading-tight">
                {adminTerm("generationId")}
              </TableHead>
              <TableHead className="min-w-[5rem] text-[0.7rem] leading-tight">
                {adminTerm("provider")}
              </TableHead>
              <TableHead className="min-w-[6rem] text-[0.7rem] leading-tight">
                {adminTerm("endpoint")}
              </TableHead>
              <TableHead className="min-w-[8rem] max-w-[10rem] text-[0.7rem] leading-tight">
                {adminTerm("requestPayload")}
              </TableHead>
              <TableHead className="min-w-[8rem] max-w-[10rem] text-[0.7rem] leading-tight">
                {adminTerm("responsePayload")}
              </TableHead>
              <TableHead className="w-12 text-[0.7rem] leading-tight">
                {adminTerm("statusCode")}
              </TableHead>
              <TableHead className="min-w-[6rem] max-w-[8rem] text-[0.7rem] leading-tight">
                {adminTerm("errorMessage")}
              </TableHead>
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
                <TableCell
                  className="text-muted-foreground max-w-[10rem] align-top text-[0.65rem] leading-snug"
                  title={jsonPreview(row.requestPayload, 5000)}
                >
                  {jsonPreview(row.requestPayload, 80)}
                </TableCell>
                <TableCell
                  className="text-muted-foreground max-w-[10rem] align-top text-[0.65rem] leading-snug"
                  title={jsonPreview(row.responsePayload, 5000)}
                >
                  {jsonPreview(row.responsePayload, 80)}
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
