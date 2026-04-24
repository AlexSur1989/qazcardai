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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Админ — обзор",
};

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? <CardContent className="pt-0 text-xs">{hint}</CardContent> : null}
    </Card>
  );
}

export default async function AdminHomePage() {
  const res = await getAdminOverview();
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
  return (
    <div className="space-y-8">
      <PageHeader
        title="Обзор"
        description="Счётчики, недавние ошибки API, вебхуки и записи аудита. Данные в реальном времени из базы."
        breadcrumbs={[{ label: "Админ", href: "/admin" }, { label: "Обзор" }]}
      />

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
