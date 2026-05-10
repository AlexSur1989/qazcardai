import Link from "next/link";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { creditTypeLabel } from "@/lib/credit-labels";
import { cn } from "@/lib/utils";
import { getCreditTransactionList } from "@/server/services/financeAdmin";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";
import type { CreditTransactionType } from "@/generated/prisma/enums";
export const metadata = {
  title: "Транзакции токенов / Credit Transactions — QazCard AI",
};

const ALL_TYPES: CreditTransactionType[] = [
  "PURCHASE",
  "RESERVE",
  "CAPTURE",
  "REFUND",
  "ADMIN_ADJUSTMENT",
  "PROMO",
];

const PAGE_SIZES = [20, 50, 100] as const;

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function toQuery(
  sp: Record<string, string | undefined>,
  patch: Record<string, string | undefined | null>,
): string {
  const p = new URLSearchParams();
  const merged = { ...sp, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "") p.set(k, v);
  }
  return p.toString();
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function metadataCell(m: unknown): string {
  if (m == null) return "—";
  try {
    const s = JSON.stringify(m);
    return s.length > 200 ? `${s.slice(0, 200)}…` : s;
  } catch {
    return "—";
  }
}

function amountClass(type: CreditTransactionType, amount: number): string {
  if (type === "REFUND")
    return "text-amber-800 dark:text-amber-200 font-mono tabular-nums";
  if (amount > 0) return "text-emerald-700 dark:text-emerald-300 font-mono tabular-nums";
  if (amount < 0) return "text-red-600 dark:text-red-400 font-mono tabular-nums";
  return "font-mono tabular-nums";
}

export default async function AdminCreditTransactionsPage({ searchParams }: PageProps) {
  await requireAdminPagePermission("credit_transactions.view");
  const sp = (await searchParams) ?? {};
  const userEmail = first(sp.userEmail).trim() || undefined;
  const userId = first(sp.userId).trim() || undefined;
  const typeRaw = first(sp.type);
  const type: CreditTransactionType | undefined =
    typeRaw && ALL_TYPES.includes(typeRaw as CreditTransactionType)
      ? (typeRaw as CreditTransactionType)
      : undefined;
  const dateFromS = first(sp.dateFrom) || undefined;
  const dateToS = first(sp.dateTo) || undefined;
  const generationId = first(sp.generationId).trim() || undefined;
  const paymentId = first(sp.paymentId).trim() || undefined;
  const page = Math.max(1, parseInt(first(sp.page) || "1", 10) || 1);
  const pageSizeRaw = parseInt(first(sp.pageSize) || "20", 10) || 20;
  const pageSize = PAGE_SIZES.includes(pageSizeRaw as (typeof PAGE_SIZES)[number])
    ? pageSizeRaw
    : 20;
  const amountMinS = first(sp.amountMin);
  const amountMaxS = first(sp.amountMax);
  const amountMin = amountMinS ? parseInt(amountMinS, 10) : undefined;
  const amountMax = amountMaxS ? parseInt(amountMaxS, 10) : undefined;

  const current: Record<string, string | undefined> = {
    ...(userEmail ? { userEmail } : {}),
    ...(userId ? { userId } : {}),
    ...(type ? { type } : {}),
    ...(dateFromS ? { dateFrom: dateFromS } : {}),
    ...(dateToS ? { dateTo: dateToS } : {}),
    ...(generationId ? { generationId } : {}),
    ...(paymentId ? { paymentId } : {}),
    ...(Number.isFinite(amountMin) ? { amountMin: String(amountMin) } : {}),
    ...(Number.isFinite(amountMax) ? { amountMax: String(amountMax) } : {}),
    pageSize: String(pageSize),
    ...(page > 1 ? { page: String(page) } : {}),
  };

  const result = await getCreditTransactionList({
    page,
    pageSize,
    type,
    userId,
    userEmail,
    generationId,
    paymentId,
    dateFrom: dateFromS ? new Date(`${dateFromS}T00:00:00.000Z`) : undefined,
    dateTo: dateToS ? new Date(`${dateToS}T23:59:59.999Z`) : undefined,
    amountMin: amountMinS !== "" && Number.isFinite(amountMin) ? amountMin : undefined,
    amountMax: amountMaxS !== "" && Number.isFinite(amountMax) ? amountMax : undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-sky-950">
          {adminTerm("creditTransactions")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Credit transaction ledger / Журнал движения токенов с фильтрами и пагинацией.
        </p>
      </div>

      <Card className="rounded-2xl border border-[#b8dce6] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Filters / Фильтры</CardTitle>
          <CardDescription>
            Date / Период, user email, type, links to generation and payment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="ct-email">User email / Email</Label>
              <Input
                id="ct-email"
                name="userEmail"
                type="search"
                placeholder="user@…"
                defaultValue={userEmail ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-uid">User ID / ID пользователя</Label>
              <Input
                id="ct-uid"
                name="userId"
                defaultValue={userId ?? ""}
                className="font-mono text-xs"
                placeholder="uuid"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-type">Type / Тип</Label>
              <select
                id="ct-type"
                name="type"
                defaultValue={type ?? ""}
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              >
                <option value="">All / Все</option>
                {ALL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-gen">Generation ID / ID генерации</Label>
              <Input
                id="ct-gen"
                name="generationId"
                defaultValue={generationId ?? ""}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-pay">Payment ID / ID платежа</Label>
              <Input
                id="ct-pay"
                name="paymentId"
                defaultValue={paymentId ?? ""}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-df">Date from / Дата от</Label>
              <Input id="ct-df" name="dateFrom" type="date" defaultValue={dateFromS ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-dt">Date to / Дата до</Label>
              <Input id="ct-dt" name="dateTo" type="date" defaultValue={dateToS ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-min">Amount min / Мин. сумма</Label>
              <Input
                id="ct-min"
                name="amountMin"
                type="number"
                defaultValue={amountMinS !== "" && Number.isFinite(amountMin) ? amountMin : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-max">Amount max / Макс. сумма</Label>
              <Input
                id="ct-max"
                name="amountMax"
                type="number"
                defaultValue={amountMaxS !== "" && Number.isFinite(amountMax) ? amountMax : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-ps">Page size / На странице</Label>
              <select
                id="ct-ps"
                name="pageSize"
                defaultValue={String(pageSize)}
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <input type="hidden" name="page" value="1" />
              <button type="submit" className={cn(buttonVariants(), "w-full sm:w-auto")}>
                Apply / Применить
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result.items.length === 0 ? (
        <AdminEmpty
          title="Нет записей"
          description="Измените фильтры или проверьте период."
        />
      ) : (
        <Card className="rounded-2xl border border-[#b8dce6] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Transactions / Транзакции</CardTitle>
            <CardDescription>
              Total: {result.total} · page {result.page} / {Math.max(1, Math.ceil(result.total / result.pageSize))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date / Дата</TableHead>
                    <TableHead>User / Пользователь</TableHead>
                    <TableHead>Type / Тип</TableHead>
                    <TableHead className="text-right">Amount / Сумма</TableHead>
                    <TableHead>Reason / Причина</TableHead>
                    <TableHead>Generation / Генерация</TableHead>
                    <TableHead>Payment / Платёж</TableHead>
                    <TableHead>Metadata / Метаданные</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((row) => (
                    <TableRow
                      key={row.id}
                      className={row.type === "REFUND" ? "bg-amber-50/40 dark:bg-amber-950/20" : undefined}
                    >
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatAdminDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-xs">
                        {row.user.email}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="secondary" className="font-normal">
                          {creditTypeLabel(row.type)}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right text-xs",
                          amountClass(row.type, row.amount),
                        )}
                      >
                        {row.amount > 0 ? `+${row.amount}` : row.amount}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs text-xs">
                        {row.reason ? row.reason : "—"}
                      </TableCell>
                      <TableCell className="max-w-[8rem] font-mono text-xs">
                        {row.generationId ? (
                          <Link
                            className="text-sky-800 underline-offset-2 hover:underline"
                            href={`/admin/generations/${row.generationId}`}
                          >
                            {row.generationId.slice(0, 8)}…
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[8rem] font-mono text-xs">
                        {row.paymentId ? (
                          <Link
                            className="text-sky-800 underline-offset-2 hover:underline"
                            href={`/admin/payments/${row.paymentId}`}
                          >
                            {row.paymentId.slice(0, 8)}…
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground max-w-[8rem] font-mono text-[10px] leading-tight"
                        title={metadataCell(row.metadata)}
                      >
                        {metadataCell(row.metadata)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {result.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">
            {result.items.length} of {result.total} · sort: createdAt desc
          </p>
          <div className="flex flex-wrap gap-2">
            {page > 1 ? (
              <Link
                href={`/admin/credit-transactions?${toQuery(current, { page: String(page - 1) })}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                ← Prev
              </Link>
            ) : null}
            {page * pageSize < result.total ? (
              <Link
                href={`/admin/credit-transactions?${toQuery(current, { page: String(page + 1) })}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      )}

    </div>
  );
}
