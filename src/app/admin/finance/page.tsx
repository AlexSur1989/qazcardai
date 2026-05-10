import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AdminEmpty } from "@/components/admin/admin-empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { adminTerm } from "@/lib/admin-terms";
import { formatAdminDateTime } from "@/lib/admin-format";
import { formatKzt } from "@/lib/format-kzt";
import { getFinanceSummary } from "@/server/services/financeAdmin";
import { buttonVariants } from "@/components/ui/button";
import { creditTypeLabel } from "@/lib/credit-labels";
import { paymentStatusLabel } from "@/lib/payment-labels";
import { cn } from "@/lib/utils";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Финансы / Finance — QazCard AI" };

const cardClass =
  "rounded-2xl border border-[#b8dce6] bg-white shadow-sm shadow-sky-900/5";

function Stat({
  title,
  value,
  valueNode,
  hint,
}: {
  title: string;
  value?: string;
  valueNode?: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className={cardClass}>
      <CardHeader className="pb-2">
        <CardDescription className="text-foreground/80">{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums text-sky-950">
          {valueNode ?? value}
        </CardTitle>
      </CardHeader>
      {hint ? <CardContent className="pt-0 text-xs text-amber-900/80">{hint}</CardContent> : null}
    </Card>
  );
}

export default async function AdminFinancePage() {
  await requireAdminPagePermission("finance.view");
  let data;
  try {
    data = await getFinanceSummary({});
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={adminTerm("finance")}
          description="Доходы, токены, возвраты и финансовые показатели сервиса."
          breadcrumbs={[
            { label: "Админ", href: "/admin" },
            { label: "Финансы" },
          ]}
        />
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>Не удалось загрузить сводку.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const m = data.margin;
  const marginNote =
    m.estimatedClientRevenueKzt == null || m.estimatedProviderCostKzt == null
      ? "Недостаточно данных для полной оценки (matrix pricing, realCost и т.д.)."
      : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title={adminTerm("finance")}
        description="Revenue, tokens, refunds and service-level finance / Доходы, токены, возвраты и финансовые показатели сервиса."
        breadcrumbs={[
          { label: "Админ", href: "/admin" },
          { label: "Финансы" },
        ]}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-tight text-amber-900/90">
          {adminTerm("revenue")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            title="Revenue today / Доход сегодня"
            value={formatKzt(data.revenue.today)}
          />
          <Stat
            title="Revenue 7 days / Доход за 7 дней"
            value={formatKzt(data.revenue.last7Days)}
          />
          <Stat
            title="Revenue 30 days / Доход за 30 дней"
            value={formatKzt(data.revenue.last30Days)}
          />
          <Stat
            title="Revenue all time / Доход за всё время"
            value={formatKzt(data.revenue.allTime)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-tight text-amber-900/90">Tokens / Токены</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Stat
            title={adminTerm("tokensPurchased")}
            value={String(data.tokens.purchased)}
          />
          <Stat title={adminTerm("tokensSpent")} value={String(data.tokens.spent)} />
          <Stat
            title={adminTerm("tokensRefunded")}
            value={String(data.tokens.refunded)}
          />
          <Stat title={adminTerm("adminGrants")} value={String(data.tokens.adminGranted)} />
          <Stat
            title={adminTerm("currentBalancesTotal")}
            value={String(data.tokens.currentBalancesTotal)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-tight text-amber-900/90">
          Generations finance / Финансы генераций
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            title="Completed 24h / За 24ч"
            value={String(data.generations.completed24h)}
          />
          <Stat title="Failed 24h / Ошибок 24ч" value={String(data.generations.failed24h)} />
          <Stat
            title="Tokens spent 24h / Списано 24ч"
            value={String(data.generations.tokensSpent24h)}
          />
          <Stat
            title="Refunds 24h / Возвратов 24ч"
            value={String(data.generations.tokensRefunded24h)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-tight text-amber-900/90">
          {adminTerm("estimatedMargin")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            title="Provider KZT (est.) / Себестоимость (оценка)"
            valueNode={
              m.estimatedProviderCostKzt == null
                ? "—"
                : formatKzt(m.estimatedProviderCostKzt)
            }
            hint={marginNote}
          />
          <Stat
            title="Client KZT (est.) / Доход клиента"
            valueNode={
              m.estimatedClientRevenueKzt == null
                ? "—"
                : formatKzt(m.estimatedClientRevenueKzt)
            }
          />
          <Stat
            title="Margin KZT (est.) / Маржа"
            valueNode={
              m.estimatedMarginKzt == null
                ? "—"
                : formatKzt(m.estimatedMarginKzt)
            }
          />
          <Stat
            title="Margin % / % маржи"
            valueNode={
              m.estimatedMarginPercent == null
                ? "—"
                : `${m.estimatedMarginPercent.toFixed(1)}%`
            }
          />
        </div>
        {marginNote ? (
          <p className="text-muted-foreground text-sm">{marginNote}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-tight text-amber-900/90">
          Product Card finance / Карточка товара
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat title="Completed / Завершено" value={String(data.productCard.completed)} />
          <Stat title="Tokens / Токены" value={String(data.productCard.tokens)} />
          <Stat title="Revenue / Доход" value={formatKzt(data.productCard.revenueKzt)} />
          <Stat
            title="Margin / Маржа"
            valueNode={`${formatKzt(data.productCard.marginKzt)}${
              data.productCard.marginPercent == null
                ? ""
                : ` · ${data.productCard.marginPercent.toFixed(1)}%`
            }`}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={cardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base text-sky-950">
                {adminTerm("recentPayments")}
              </CardTitle>
              <CardDescription>COMPLETED, последние 10</CardDescription>
            </div>
            <Link
              href="/admin/payments"
              className={cn(
                buttonVariants({ variant: "ghost", size: "xs" }),
                "shrink-0",
              )}
            >
              Все
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentPayments.length === 0 ? (
              <AdminEmpty title="Нет платежей" description="Появятся после успешных оплат." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Пров.</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Пакет</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                      <TableHead className="text-right">Ток.</TableHead>
                      <TableHead>mock</TableHead>
                      <TableHead>Оплачен</TableHead>
                      <TableHead>Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatAdminDateTime(new Date(p.createdAt))}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.provider}</TableCell>
                        <TableCell className="max-w-[8rem] truncate text-xs">
                          {p.userEmail}
                        </TableCell>
                        <TableCell className="max-w-[6rem] truncate text-xs">
                          {p.tokenPackageName ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium tabular-nums">
                          {formatKzt(p.amount)} {p.currency}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {p.credits}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.metadataMock === true ? "yes" : p.metadataMock === false ? "no" : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {p.paidAt ? formatAdminDateTime(new Date(p.paidAt)) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {paymentStatusLabel(p.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base text-sky-950">
                {adminTerm("recentCreditTransactions")}
              </CardTitle>
              <CardDescription>Последние 10</CardDescription>
            </div>
            <Link
              href="/admin/credit-transactions"
              className={cn(
                buttonVariants({ variant: "ghost", size: "xs" }),
                "shrink-0",
              )}
            >
              Все
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentCreditTransactions.length === 0 ? (
              <AdminEmpty
                title="Нет транзакций"
                description="Движения кредитов появятся в процессе работы."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentCreditTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatAdminDateTime(new Date(t.createdAt))}
                        </TableCell>
                        <TableCell className="max-w-[7rem] truncate text-xs">
                          {t.userEmail}
                        </TableCell>
                        <TableCell className="text-xs">
                          {creditTypeLabel(t.type)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right text-xs font-mono tabular-nums",
                            t.type === "REFUND" && "text-amber-800",
                            t.type !== "REFUND" && t.amount > 0 && "text-emerald-700",
                            t.type !== "REFUND" && t.amount < 0 && "text-red-600",
                          )}
                        >
                          {t.amount > 0 ? `+${t.amount}` : t.amount}
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
    </div>
  );
}
