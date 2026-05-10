import Link from "next/link";
import { notFound } from "next/navigation";
import type { UserRole, UserStatus } from "@/generated/prisma/enums";
import { AlertCircle, ArrowLeft } from "lucide-react";

import { AdminUserStatusForm } from "@/components/admin/admin-user-status-form";
import { AdminUserCreditsForm } from "@/components/admin/admin-user-credits-form";
import { AdminUserRoleForm } from "@/components/admin/admin-user-role-form";
import { AdminEmpty } from "@/components/admin/admin-empty";
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
import { getAdminUserById } from "@/lib/admin-data";
import { creditTypeLabel } from "@/lib/credit-labels";
import { formatAdminDateTime } from "@/lib/admin-format";
import { formatKzt, formatRuDate } from "@/lib/format-kzt";
import { paymentStatusLabel } from "@/lib/payment-labels";
import { hasPermission } from "@/lib/permissions";
import { adminTerm } from "@/lib/admin-terms";
import { userTokenPackageStatusLabel } from "@/lib/user-token-package-labels";
import { getUserFinanceSummary } from "@/server/services/financeAdmin";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { listTransactions } from "@/server/services/credits";
import {
  getUserLastTokenPackage,
  getUserTokenPackageHistoryForAdmin,
} from "@/server/services/tokenPackages";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
type Props = { params: Promise<{ id: string }> };

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  const res = await getAdminUserById(id);
  if (res.ok) {
    const { user } = res;
    const session = await getFreshAdminSessionUser();
    const canFinance = session.ok && hasPermission(session.user.role, "finance.view");
    const canCreditTx =
      session.ok && hasPermission(session.user.role, "credit_transactions.view");
    const canAdjustBalance =
      session.ok && hasPermission(session.user.role, "users.adjust_balance");
    const canChangeRole =
      session.ok && hasPermission(session.user.role, "users.change_role");

    const [txs, lastPack, packHistory, finance] = await Promise.all([
      canCreditTx ? listTransactions(user.id, { take: 30 }) : Promise.resolve([]),
      canFinance ? getUserLastTokenPackage(user.id) : Promise.resolve(null),
      canFinance ? getUserTokenPackageHistoryForAdmin(user.id) : Promise.resolve([]),
      canFinance ? getUserFinanceSummary(user.id) : Promise.resolve(null),
    ]);

    return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/users"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-2 inline-flex items-center gap-1",
          )}
        >
          <ArrowLeft className="size-3.5" />
          К списку
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Пользователь</h1>
        <p className="text-foreground mt-1 font-mono text-sm">{user.email}</p>
        <p className="text-muted-foreground text-xs">id: {user.id}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Статус учётной записи</CardTitle>
          <CardDescription>
            Блокировка и разблокировка пишутся в аудит (<code>user.status_changed</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminUserStatusForm userId={user.id} currentStatus={user.status as UserStatus} />
        </CardContent>
      </Card>

      {canChangeRole ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Роль аккаунта</CardTitle>
            <CardDescription>
              Изменять роли может только SUPER_ADMIN. Действия пишутся в аудит.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminUserRoleForm userId={user.id} currentRole={user.role as UserRole} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-2 text-sm sm:grid-cols-2 sm:max-w-md">
        <p>
          <span className="text-muted-foreground">Роль:</span> {user.role}
        </p>
        <p>
          <span className="text-muted-foreground">Статус (текущий):</span> {user.status}
        </p>
        {canFinance ? (
          <p>
            <span className="text-muted-foreground">Токенов сейчас (balanceCredits):</span>{" "}
            <span className="font-mono font-medium tabular-nums">{user.balanceCredits}</span>
          </p>
        ) : (
          <p className="text-muted-foreground text-xs sm:col-span-2">
            Баланс и платежи скрыты для этой роли.
          </p>
        )}
        <p>
          <span className="text-muted-foreground">Регистрация:</span>{" "}
          {formatAdminDateTime(user.createdAt)}
        </p>
      </div>

      {canFinance && finance ? (
        <Card className="rounded-2xl border border-[#b8dce6] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-sky-950">{adminTerm("userFinance")}</CardTitle>
            <CardDescription>
              Balance, aggregates, last payment, package and recent credit movements / Баланс,
              итоги, последний платёж, пакет и движения токенов
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <p>
                <span className="text-muted-foreground">Current balance / Текущий баланс: </span>
                <span className="font-mono font-semibold tabular-nums text-sky-950">
                  {finance.balanceCredits}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Total purchased / Всего куплено: </span>
                <span className="font-mono tabular-nums">{finance.totals.purchased}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Total spent / Всего потрачено: </span>
                <span className="font-mono tabular-nums">{finance.totals.spent}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Total refunded / Всего возвращено: </span>
                <span className="font-mono tabular-nums text-amber-900/90">
                  {finance.totals.refunded}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Admin grants / Начислено админом: </span>
                <span className="font-mono tabular-nums">{finance.totals.adminGranted}</span>
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Last payment / Последний платёж
                </p>
                {finance.lastPayment ? (
                  <p className="mt-1 text-sm">
                    {formatKzt(finance.lastPayment.amount)} {finance.lastPayment.currency} ·{" "}
                    {paymentStatusLabel(finance.lastPayment.status)} ·{" "}
                    {formatAdminDateTime(new Date(finance.lastPayment.createdAt))}{" "}
                    <Link
                      className="font-mono text-xs text-sky-800 underline-offset-2 hover:underline"
                      href={`/admin/payments/${finance.lastPayment.id}`}
                    >
                      {finance.lastPayment.id.slice(0, 8)}…
                    </Link>
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-1 text-sm">—</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Last package / Последний пакет
                </p>
                {finance.lastPackage ? (
                  <p className="mt-1 text-sm">
                    {finance.lastPackage.packageName} · {finance.lastPackage.totalTokens} ток. ·{" "}
                    {formatKzt(finance.lastPackage.priceKzt)} ·{" "}
                    {userTokenPackageStatusLabel(finance.lastPackage.status)} ·{" "}
                    {formatRuDate(new Date(finance.lastPackage.purchasedAt))}
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-1 text-sm">—</p>
                )}
              </div>
            </div>
            {finance.recentTransactions.length > 0 ? (
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                  Recent credit transactions / Последние транзакции токенов
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead>Причина</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {finance.recentTransactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatAdminDateTime(new Date(t.createdAt))}
                          </TableCell>
                          <TableCell className="text-xs">{creditTypeLabel(t.type)}</TableCell>
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
                          <TableCell className="text-muted-foreground max-w-xs text-xs">
                            {t.reason?.slice(0, 80) || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Link
                  href={`/admin/credit-transactions?userId=${user.id}`}
                  className={cn(
                    buttonVariants({ variant: "link", size: "sm" }),
                    "mt-2 h-auto px-0",
                  )}
                >
                  Все транзакции пользователя →
                </Link>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Нет движений по кредитам.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canFinance ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Пакет токенов (последний)</CardTitle>
            <CardDescription>Разовая покупка, не подписка (последний COMPLETED)</CardDescription>
          </CardHeader>
          <CardContent>
            {lastPack ? (
              <div className="text-sm">
                <p className="font-medium">{lastPack.packageName}</p>
                <p className="text-muted-foreground mt-1">
                  {lastPack.totalTokens} ток. · {formatKzt(lastPack.priceKzt)} ·{" "}
                  {formatRuDate(lastPack.purchasedAt)} ·{" "}
                  {userTokenPackageStatusLabel(lastPack.status)}
                  {lastPack.paymentId ? (
                    <span className="block font-mono text-xs">
                      payment: {lastPack.paymentId}
                    </span>
                  ) : null}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Пакетов ещё не покупал</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canFinance ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">История пакетов токенов</CardTitle>
            <CardDescription>Записи UserTokenPackage</CardDescription>
          </CardHeader>
          <CardContent>
            {packHistory.length === 0 ? (
              <AdminEmpty
                title="Нет записей"
                description="Покупки пакетов появятся после оплаты или ручного начисления."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Пакет</TableHead>
                      <TableHead className="text-right">Цена</TableHead>
                      <TableHead className="text-right">Итого</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packHistory.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatRuDate(r.purchasedAt)}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {r.packageName}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatKzt(r.priceKzt)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {r.totalTokens}
                        </TableCell>
                        <TableCell className="text-xs">
                          {userTokenPackageStatusLabel(r.status)}
                        </TableCell>
                        <TableCell className="max-w-[8rem] truncate font-mono text-xs">
                          {r.paymentId || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canAdjustBalance ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Корректировка кредитов</CardTitle>
            <CardDescription>
              Создаётся движение <code>ADMIN_ADJUSTMENT</code> и запись в аудите
              администратора.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminUserCreditsForm userId={user.id} canAdjust={canAdjustBalance} />
          </CardContent>
        </Card>
      ) : null}

      {canCreditTx ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Операции с кредитами</CardTitle>
            <CardDescription>Последние 30 (новые сверху)</CardDescription>
          </CardHeader>
          <CardContent>
            {txs.length === 0 ? (
              <AdminEmpty
                title="Нет движений"
                description="Появятся после начислений, резервов и ручных правок."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                      <TableHead>Причина</TableHead>
                      <TableHead>Генерация</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txs.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatAdminDateTime(t.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {creditTypeLabel(t.type)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          {t.amount > 0 ? `+${t.amount}` : t.amount}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs text-xs">
                          {t.reason?.slice(0, 120) || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[6rem] truncate font-mono text-xs">
                          {t.generationId?.slice(0, 8) || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
    );
  }
  if (res.error === "not_found") {
    notFound();
  }
  return (
    <div>
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Ошибка</AlertTitle>
        <AlertDescription>Не удалось загрузить пользователя.</AlertDescription>
      </Alert>
    </div>
  );
}
