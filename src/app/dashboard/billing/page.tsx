import { Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { TokenPackagesBillingSection } from "@/components/dashboard/token-packages-billing-section";
import { DashboardSectionEmpty } from "@/components/dashboard/dashboard-section-empty";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  creditTransactionUserComment,
  creditTransactionUserTypeLabel,
  shouldShowCreditTransactionToUser,
} from "@/lib/credit-labels";
import { formatAdminDateTime } from "@/lib/admin-format";
import { formatKzt, formatRuDate } from "@/lib/format-kzt";
import { userTokenPackageStatusLabel } from "@/lib/user-token-package-labels";
import { getKaspiManualBillingPublic } from "@/server/services/kaspiManualSettings";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { getBalance, listTransactions } from "@/server/services/credits";
import { listActiveTokenPackagesForBilling } from "@/server/services/token-packages-catalog";
import {
  getUserLastTokenPackage,
  getUserTokenPackageHistory,
} from "@/server/services/tokenPackages";

export const metadata = {
  title: "Биллинг — QazCard AI",
};

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BillingPage({ searchParams }: PageProps) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard/billing");
  }
  const sp = (await searchParams) ?? {};
  const checkout = first(sp.checkout);

  const [balance, txs, packRows, lastBought, packHistory, kaspiManual] =
    await Promise.all([
    getBalance(current.user.id),
    listTransactions(current.user.id, { take: 50 }),
    listActiveTokenPackagesForBilling(),
    getUserLastTokenPackage(current.user.id),
    getUserTokenPackageHistory(current.user.id, 100),
    getKaspiManualBillingPublic(),
  ]);
  const packageCards = packRows.map((p) => ({
    id: p.id,
    name: p.name,
    priceKzt: p.priceKzt,
    baseTokens: p.baseTokens,
    bonusTokens: p.bonusTokens,
    totalTokens: p.totalTokens,
    description: p.description ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        variant="qaz"
        title="Биллинг"
        description="Пополнение баланса через Kaspi и WhatsApp. Токены начисляются после проверки оплаты."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "Биллинг" },
        ]}
      />

      {checkout === "success" && (
        <Alert>
          <AlertTitle>Оплата отправлена</AlertTitle>
          <AlertDescription>
            Если токены ещё не появились, подождите несколько секунд и обновите страницу.
          </AlertDescription>
        </Alert>
      )}
      {checkout === "kaspi_success" && (
        <Alert>
          <AlertTitle>Kaspi: оплата подтверждена на сервере</AlertTitle>
          <AlertDescription>
            Токены должны отобразиться на балансе. При задержке обновите страницу.
          </AlertDescription>
        </Alert>
      )}
      {checkout === "cancel" && (
        <Alert>
          <AlertTitle>Оплата прервана</AlertTitle>
          <AlertDescription>Вы отменили оплату. Баланс не менялся.</AlertDescription>
        </Alert>
      )}

      {lastBought ? (
        <div className="bg-muted/40 rounded-lg border px-4 py-3 text-sm">
          <p className="text-muted-foreground text-xs">Последний купленный пакет</p>
          <p className="text-foreground mt-1 font-medium">
            {lastBought.packageName} — {lastBought.totalTokens} токенов
            {lastBought.bonusTokens > 0
              ? ` · +${lastBought.bonusTokens} бонусных токенов`
              : ""}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Куплен: {formatRuDate(lastBought.purchasedAt)} · {formatKzt(lastBought.priceKzt)}
          </p>
        </div>
      ) : null}

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5" aria-hidden />
            Баланс токенов
          </CardTitle>
          <CardDescription>Доступно для генераций</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tabular-nums">{balance}</p>
          <p className="text-muted-foreground mt-1 text-xs">токенов</p>
        </CardContent>
      </Card>

      <TokenPackagesBillingSection
        packages={packageCards}
        kaspiManual={kaspiManual}
      />

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">История пакетов</CardTitle>
          <CardDescription>Разовые покупки пакетов токенов</CardDescription>
        </CardHeader>
        <CardContent>
          {packHistory.length === 0 ? (
            <DashboardSectionEmpty
              title="Пока нет покупок"
              description="Купленные пакеты отобразятся здесь после оплаты или начисления администратором."
            />
          ) : (
            <div className="border-border/80 overflow-x-auto rounded-lg border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Пакет</TableHead>
                    <TableHead className="text-right">Цена</TableHead>
                    <TableHead className="text-right">База</TableHead>
                    <TableHead className="text-right">Бонус</TableHead>
                    <TableHead className="text-right">Итого</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packHistory.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatRuDate(r.purchasedAt)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{r.packageName}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatKzt(r.priceKzt)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.baseTokens}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.bonusTokens}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium tabular-nums">
                        {r.totalTokens}
                      </TableCell>
                      <TableCell className="text-xs">
                        {userTokenPackageStatusLabel(r.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">История токенов</CardTitle>
          <CardDescription>До 50 последних операций</CardDescription>
        </CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <DashboardSectionEmpty
              title="Пока нет операций"
              description="Начисления, резервы и списания появятся здесь."
            />
          ) : (
            <div className="border-border/80 overflow-x-auto rounded-lg border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Токены</TableHead>
                    <TableHead>Комментарий</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txs.filter(shouldShowCreditTransactionToUser).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatAdminDateTime(t.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {creditTransactionUserTypeLabel(t.type, t.reason)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono tabular-nums">
                        {t.amount > 0 ? `+${t.amount}` : t.amount}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-md text-xs">
                        {creditTransactionUserComment(t.type, t.reason) ?? "—"}
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
