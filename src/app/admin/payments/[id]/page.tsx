import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";

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
import { getAdminPaymentById } from "@/lib/admin-data";
import { formatAdminDateTime } from "@/lib/admin-format";
import { creditTypeLabel } from "@/lib/credit-labels";
import { paymentStatusLabel } from "@/lib/payment-labels";
import { cn } from "@/lib/utils";
import { KASPI_MANUAL_PAYMENT_PROVIDER } from "@/lib/kaspi-manual-config";
import { manualPaymentContactChannelLabel } from "@/lib/manual-payment-labels";
import { hasPermission } from "@/lib/permissions";
import { AdminKaspiManualPaymentActions } from "@/components/admin/admin-kaspi-manual-payment-actions";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Платёж — QazCard AI" };

type Props = { params: Promise<{ id: string }> };

export default async function AdminPaymentDetailPage({ params }: Props) {
  const adminUser = await requireAdminPagePermission("payments.view");
  const canManagePayments = hasPermission(adminUser.role, "payments.manage");
  const { id } = await params;
  const res = await getAdminPaymentById(id);

  if (res.ok) {
    const p = res.payment;
    return (
      <div className="space-y-8">
        <div>
          <Link
            href="/admin/payments"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "mb-2 inline-flex items-center gap-1",
            )}
          >
            <ArrowLeft className="size-3.5" />
            К списку
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Платёж</h1>
          <p className="text-muted-foreground font-mono text-xs break-all">{p.id}</p>
        </div>

        <div className="grid gap-2 text-sm sm:max-w-2xl">
          <p>
            <span className="text-muted-foreground">Пользователь: </span>
            <Link
              className="text-primary font-medium underline"
              href={`/admin/users/${p.user.id}`}
            >
              {p.user.email}
            </Link>
          </p>
          <p>
            <span className="text-muted-foreground">Провайдер: </span>{" "}
            <span className="font-mono">{p.provider}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Пакет: </span>
            <span>{p.tokenPackage?.name ?? "—"}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Сумма: </span>
            {p.amount.toString()} {p.currency}
          </p>
          <p>
            <span className="text-muted-foreground">Кредиты: </span>
            {p.credits}
          </p>
          <p>
            <span className="text-muted-foreground">Статус: </span>
            <Badge variant="outline" className="ml-1">
              {paymentStatusLabel(p.status)}
            </Badge>
          </p>
          <p>
            <span className="text-muted-foreground">ID у провайдера: </span>{" "}
            <span className="font-mono break-all text-xs">
              {p.providerPaymentId ?? "—"}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Оплачен (paidAt): </span>
            {p.paidAt ? formatAdminDateTime(p.paidAt) : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Создан: </span>
            {formatAdminDateTime(p.createdAt)}
          </p>
        </div>

        {p.provider === KASPI_MANUAL_PAYMENT_PROVIDER ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ручное пополнение Kaspi / WhatsApp</CardTitle>
              <CardDescription>
                Код заявки, канал связи и данные от пользователя. Подтверждайте только после
                проверки поступления.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(() => {
                const meta =
                  p.metadata &&
                  typeof p.metadata === "object" &&
                  !Array.isArray(p.metadata)
                    ? (p.metadata as Record<string, unknown>)
                    : {};
                const contactChannel =
                  typeof meta.contactChannel === "string" ? meta.contactChannel : "kaspi";
                const userComment =
                  typeof meta.userComment === "string" ? meta.userComment : null;
                const userReceiptUrl =
                  typeof meta.userReceiptUrl === "string" ? meta.userReceiptUrl : null;
                const instructionCode =
                  typeof meta.instructionCode === "string"
                    ? meta.instructionCode
                    : p.providerPaymentId;
                return (
                  <>
                    <p>
                      <span className="text-muted-foreground">Канал связи: </span>
                      {manualPaymentContactChannelLabel(contactChannel)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Код платежа: </span>
                      <code className="rounded bg-muted px-1 font-mono text-xs">
                        {instructionCode ?? "—"}
                      </code>
                    </p>
                    {userComment ? (
                      <p>
                        <span className="text-muted-foreground">Комментарий пользователя: </span>
                        {userComment}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">Комментарий пользователя: —</p>
                    )}
                    {userReceiptUrl ? (
                      <p>
                        <span className="text-muted-foreground">Чек / скрин: </span>
                        <a
                          className="text-primary font-medium underline"
                          href={userReceiptUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Открыть
                        </a>
                      </p>
                    ) : (
                      <p className="text-muted-foreground">Чек / скрин: —</p>
                    )}
                  </>
                );
              })()}
              <AdminKaspiManualPaymentActions
                paymentId={p.id}
                provider={p.provider}
                status={p.status}
                canManagePayments={canManagePayments}
              />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">metadata</CardTitle>
            <CardDescription>Как в БД (в т.ч. packageId, checkoutSessionId)</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted/50 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs">
              {p.metadata == null
                ? "—"
                : JSON.stringify(p.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Связанные CreditTransaction</CardTitle>
            <CardDescription>Движения, привязанные к этому платежу</CardDescription>
          </CardHeader>
          <CardContent>
            {p.creditTransactions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Нет записей (кредиты ещё не начислены или не связаны).
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                      <TableHead>Комментарий</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.creditTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="max-w-[6rem] truncate font-mono text-xs">
                          {t.id}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatAdminDateTime(t.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {creditTypeLabel(t.type)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          {t.amount > 0 ? `+${t.amount}` : t.amount}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-sm text-xs">
                          {t.reason || "—"}
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
      <h1 className="text-2xl font-semibold tracking-tight">Платёж</h1>
      <Alert className="mt-4" variant="destructive">
        <AlertCircle />
        <AlertTitle>Ошибка</AlertTitle>
        <AlertDescription>Не удалось загрузить запись.</AlertDescription>
      </Alert>
    </div>
  );
}
