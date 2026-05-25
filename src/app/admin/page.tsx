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
import { getAdminOverview } from "@/lib/admin-data";
import { formatAdminDateTime, truncate } from "@/lib/admin-format";
import { hasPermission } from "@/lib/permissions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = {
  title: "Обзор — QazCard AI",
};

function StatCard({
  title,
  value,
  hint,
  href,
  valueClassName,
}: {
  title: string;
  value: string | number;
  hint?: string;
  href?: string;
  valueClassName?: string;
}) {
  const content = (
    <>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle
          className={cn("text-3xl font-semibold tabular-nums", valueClassName)}
        >
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? <CardContent className="pt-0 text-xs">{hint}</CardContent> : null}
    </>
  );

  if (!href) {
    return (
      <Card className="border-border/80 shadow-sm">{content}</Card>
    );
  }

  return (
    <Link href={href} className="block transition-opacity hover:opacity-90">
      <Card className="border-border/80 shadow-sm">{content}</Card>
    </Link>
  );
}

export default async function AdminHomePage() {
  const adminUser = await requireAdminPagePermission("overview.view");
  const includePricingWarnings = hasPermission(adminUser.role, "models.pricing.manage");
  const res = await getAdminOverview({ includePricingWarnings });
  if (!res.ok) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Обзор"
          breadcrumbs={[{ label: "Админ", href: "/admin" }, { label: "Обзор" }]}
        />
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Нет доступа к данным</AlertTitle>
          <AlertDescription>
            Проверьте DATABASE_URL и миграции, затем обновите страницу.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const d = res.data;
  const w = d.ownerWidgets;
  const revenueFormatted = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(w.revenueTodayKzt);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Обзор"
        description="Операционные показатели, счётчики и последние события из базы."
        breadcrumbs={[{ label: "Админ", href: "/admin" }, { label: "Обзор" }]}
      />

      <div>
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Операции
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <StatCard
            title="Заявки на пополнение"
            value={w.pendingManualPayments}
            hint="Ожидают проверки (Kaspi / WhatsApp)"
            href="/admin/payments/manual"
            valueClassName={w.pendingManualPayments > 0 ? "text-amber-600" : undefined}
          />
          <StatCard
            title="Ошибки генераций"
            value={w.failedGenerations24h}
            hint="За последние 24 часа"
            href="/admin/generations?status=FAILED"
            valueClassName={w.failedGenerations24h > 0 ? "text-destructive" : undefined}
          />
          <StatCard
            title="Выручка сегодня"
            value={`${revenueFormatted} ₸`}
            hint="Завершённые платежи"
            href="/admin/finance"
          />
          <StatCard
            title="Новые пользователи"
            value={w.newUsersToday}
            hint="Зарегистрированы сегодня"
            href="/admin/users"
          />
          {w.pricingWarnings != null ? (
            <StatCard
              title="Предупреждения цен"
              value={w.pricingWarnings}
              hint="Warnings в разделе цен"
              href="/admin/pricing?tab=warnings"
              valueClassName={w.pricingWarnings > 0 ? "text-amber-600" : undefined}
            />
          ) : null}
        </div>
      </div>

      <div>
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Сводка
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Пользователей" value={d.counts.users} />
          <StatCard title="Генераций" value={d.counts.generations} />
          <StatCard title="Платежей" value={d.counts.payments} />
          <StatCard
            title="Активных моделей"
            value={d.counts.activeModels}
            hint="Только isActive = true"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Ошибки API</CardTitle>
              <CardDescription>
                Записи с ошибкой или HTTP ≥ 400, последние
              </CardDescription>
            </div>
            <Link
              href="/admin/logs"
              className={cn(
                buttonVariants({ variant: "ghost", size: "xs" }),
                "shrink-0",
              )}
            >
              Все логи
            </Link>
          </CardHeader>
          <CardContent>
            {d.recentApiErrors.length === 0 ? (
              <AdminEmpty
                title="Нет зафиксированных ошибок"
                description="Появятся при вызовах провайдера с ошибкой."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Время</TableHead>
                    <TableHead>Провайдер</TableHead>
                    <TableHead>Код</TableHead>
                    <TableHead>Кратко</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.recentApiErrors.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatAdminDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-[6rem] truncate text-xs">
                        {row.provider}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.statusCode ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs text-xs">
                        {truncate(row.errorMessage || row.endpoint, 80)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Webhooks</CardTitle>
              <CardDescription>Последние входящие события</CardDescription>
            </div>
            <Link
              href="/admin/webhooks"
              className={cn(
                buttonVariants({ variant: "ghost", size: "xs" }),
                "shrink-0",
              )}
            >
              Все
            </Link>
          </CardHeader>
          <CardContent>
            {d.recentWebhooks.length === 0 ? (
              <AdminEmpty
                title="Событий нет"
                description="Сохраняются при POST /api/webhooks/… на следующих этапах."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Время</TableHead>
                    <TableHead>Провайдер</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.recentWebhooks.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatAdminDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs">{row.provider}</TableCell>
                      <TableCell className="max-w-[7rem] truncate text-xs">
                        {row.eventType}
                      </TableCell>
                      <TableCell className="text-xs">{row.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Аудит администраторов</CardTitle>
            <CardDescription>Последние действия в панели</CardDescription>
          </div>
          <Link
            href="/admin/audit-logs"
            className={cn(
              buttonVariants({ variant: "ghost", size: "xs" }),
              "shrink-0",
            )}
          >
            Все записи
          </Link>
        </CardHeader>
        <CardContent>
          {d.recentAudit.length === 0 ? (
            <AdminEmpty
              title="Записей аудита нет"
              description="Появятся при ручных изменениях (баланс, настройки и т.д.)."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Время</TableHead>
                  <TableHead>Админ</TableHead>
                  <TableHead>Действие</TableHead>
                  <TableHead>Тип / ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.recentAudit.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatAdminDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-[8rem] truncate text-xs">
                      {row.adminEmail}
                    </TableCell>
                    <TableCell className="text-xs">{row.action}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.targetType}
                      {row.targetId ? ` · ${row.targetId}` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
