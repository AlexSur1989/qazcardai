import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { KASPI_MANUAL_PAYMENT_PROVIDER } from "@/lib/kaspi-manual-config";
import { manualPaymentContactChannelLabel } from "@/lib/manual-payment-labels";
import { getAdminPaymentsList } from "@/lib/admin-data";
import { formatAdminDateTime } from "@/lib/admin-format";
import { paymentStatusLabel } from "@/lib/payment-labels";
import { cn } from "@/lib/utils";
import { readPaymentMetadata } from "@/server/services/manualPaymentService";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Ручные заявки — QazCard AI" };

export default async function AdminManualPaymentsPage() {
  await requireAdminPagePermission("payments.view");

  const res = await getAdminPaymentsList({
    provider: KASPI_MANUAL_PAYMENT_PROVIDER,
  });

  if (!res.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ручные заявки</h1>
        <Alert className="mt-4" variant="destructive">
          <AlertCircle />
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>Проверьте подключение к базе.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const rows = res.rows;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/payments"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2")}
        >
          ← Все платежи
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Ручные заявки Kaspi / WhatsApp</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Подтверждение и отклонение — на странице заявки. Токены начисляются только вручную.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Заявки на пополнение</CardTitle>
          <CardDescription>
            Проверьте поступление в Kaspi и чек в WhatsApp перед подтверждением.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <AdminEmpty title="Заявок пока нет." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Токены</TableHead>
                    <TableHead>Код</TableHead>
                    <TableHead>Канал</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => {
                    const meta = readPaymentMetadata(p.metadata);
                    const contactChannel =
                      typeof meta.contactChannel === "string"
                        ? meta.contactChannel
                        : "kaspi";
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatAdminDateTime(p.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/users/${p.user.id}`}
                            className="text-primary text-sm underline"
                          >
                            {p.user.email}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {p.amount.toString()} {p.currency}
                        </TableCell>
                        <TableCell>{p.credits}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.providerPaymentId ?? "—"}
                        </TableCell>
                        <TableCell>
                          {manualPaymentContactChannelLabel(contactChannel)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{paymentStatusLabel(p.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/admin/payments/${p.id}`}
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                          >
                            Открыть
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
