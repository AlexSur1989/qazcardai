import { Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CreditPackagesSection } from "@/components/dashboard/credit-packages-section";
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
import { creditTypeLabel } from "@/lib/credit-labels";
import { formatAdminDateTime } from "@/lib/admin-format";
import { getResolvableCreditPackages } from "@/lib/credit-packages";
import { isStripeSecretConfigured } from "@/lib/payment-config";
import { getBalance, listTransactions } from "@/server/services/credits";

export const metadata = {
  title: "Биллинг — AI Media",
};

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BillingPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/dashboard/billing");
  }
  const sp = (await searchParams) ?? {};
  const checkout = first(sp.checkout);

  const balance = await getBalance(session.user.id);
  const txs = await listTransactions(session.user.id, { take: 50 });
  const packs = getResolvableCreditPackages();
  const stripeReady = isStripeSecretConfigured();
  const packageCards = packs.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    credits: p.credits,
    amount: p.amount,
    currency: p.currency,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Биллинг
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Покупка кредитов через Stripe. Начисление только после подтверждения на
          сервере (webhook), а не по странице «успех» в браузере.
        </p>
      </div>

      {checkout === "success" && (
        <Alert>
          <AlertTitle>Оплата отправлена</AlertTitle>
          <AlertDescription>
            Если кредиты ещё не появились, подождите несколько секунд — срабатывает
            webhook Stripe. Обновите страницу.
          </AlertDescription>
        </Alert>
      )}
      {checkout === "cancel" && (
        <Alert>
          <AlertTitle>Оплата прервана</AlertTitle>
          <AlertDescription>Вы отменили оплату. Баланс не менялся.</AlertDescription>
        </Alert>
      )}

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

      <CreditPackagesSection packages={packageCards} stripeReady={stripeReady} />

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
    </div>
  );
}
