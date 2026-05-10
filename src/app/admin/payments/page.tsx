import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { AdminPaymentsFiltersForm } from "@/components/admin/admin-payments-filters-form";
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
import {
  getAdminPaymentFilterOptions,
  getAdminPaymentsList,
} from "@/lib/admin-data";
import { formatAdminDateTime } from "@/lib/admin-format";
import { paymentStatusLabel } from "@/lib/payment-labels";
import { cn } from "@/lib/utils";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";
import type { PaymentStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Платежи — QazCard AI" };

const ALL_STATUS: PaymentStatus[] = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
];

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPaymentsPage({ searchParams }: PageProps) {
  await requireAdminPagePermission("payments.view");
  const sp = (await searchParams) ?? {};
  const userId = first(sp.userId).trim() || undefined;
  const statusRaw = first(sp.status);
  const status: PaymentStatus | undefined = ALL_STATUS.includes(
    statusRaw as PaymentStatus,
  )
    ? (statusRaw as PaymentStatus)
    : undefined;
  const provider = first(sp.provider).trim() || undefined;

  const [res, opts] = await Promise.all([
    getAdminPaymentsList({ userId, status, provider }),
    getAdminPaymentFilterOptions(),
  ]);

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
  if (!opts.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Платежи</h1>
        <Alert className="mt-4" variant="destructive">
          <AlertCircle />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>Не удалось загрузить список пользователей.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasFilters = Boolean(userId || status || provider);
  const rows = res.rows;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Платежи</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Все транзакции. Кредиты начисляются по webhook, не по redirect с Stripe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>По пользователю, статусу, провайдеру (подстрока exact).</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminPaymentsFiltersForm
            userIdValue={userId ?? ""}
            statusValue={statusRaw}
            providerValue={provider ?? ""}
            users={opts.users}
          />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <div>
          {hasFilters ? (
            <AdminEmpty
              title="Нет записей"
              description="Сбросьте фильтр — в базе могут быть другие платежи."
            />
          ) : (
            <AdminEmpty
              title="Платежей нет"
              description="Появятся после успешных оплат во вкладке биллинга."
            />
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Провайдер</TableHead>
                <TableHead>Пакет</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Кр.</TableHead>
                <TableHead>mock</TableHead>
                <TableHead>Оплачен</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Создан</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const meta =
                  p.metadata &&
                  typeof p.metadata === "object" &&
                  !Array.isArray(p.metadata)
                    ? (p.metadata as Record<string, unknown>)
                    : null;
                const mock = meta && typeof meta.mock === "boolean" ? meta.mock : null;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-[10rem]">
                      <Link
                        href={`/admin/users/${p.userId}`}
                        className="text-primary truncate text-xs underline"
                      >
                        {p.user.email}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{p.provider}</TableCell>
                    <TableCell className="max-w-[8rem] truncate text-xs">
                      {p.tokenPackage?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {p.amount.toString()} {p.currency}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{p.credits}</TableCell>
                    <TableCell className="text-xs">
                      {mock === true ? "yes" : mock === false ? "no" : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {p.paidAt ? formatAdminDateTime(p.paidAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {paymentStatusLabel(p.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatAdminDateTime(p.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/payments/${p.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        Детали
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
