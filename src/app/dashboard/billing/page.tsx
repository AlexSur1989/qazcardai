import { Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardSectionEmpty } from "@/components/dashboard/dashboard-section-empty";
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
import { creditTypeLabel } from "@/lib/credit-labels";
import { formatAdminDateTime } from "@/lib/admin-format";
import { getBalance, listTransactions } from "@/server/services/credits";

export const metadata = {
  title: "Биллинг — AI Media",
};

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/dashboard/billing");
  }
  const balance = await getBalance(session.user.id);
  const txs = await listTransactions(session.user.id, { take: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Биллинг
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Баланс и история движений кредитов. Покупка пакетов — на этапе с
          оплатой.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5" aria-hidden />
            Баланс
          </CardTitle>
          <CardDescription>Доступно для генераций</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tabular-nums">{balance}</p>
          <p className="text-muted-foreground mt-1 text-xs">кредитов</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">История кредитов</CardTitle>
          <CardDescription>До 50 последних операций</CardDescription>
        </CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <DashboardSectionEmpty
              title="Пока нет операций"
              description="Начисления, резервы и списания появятся здесь."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead>Комментарий</TableHead>
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
                      <TableCell className="text-muted-foreground max-w-md text-xs">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пакеты и оплата</CardTitle>
          <CardDescription>Stripe / другие провайдеры — позже</CardDescription>
        </CardHeader>
        <CardContent>
          <DashboardSectionEmpty
            title="Оплата пока недоступна"
            description="После этапа с платёжной интеграцией здесь появятся пакеты кредитов."
          />
        </CardContent>
      </Card>
    </div>
  );
}
