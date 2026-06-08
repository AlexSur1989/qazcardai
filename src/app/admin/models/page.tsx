import Link from "next/link";
import { AlertCircle, Plus, Sparkles } from "lucide-react";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { ModelRowActions } from "@/components/admin/model-row-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminModelsList } from "@/lib/admin-data";
import { adminTerm } from "@/lib/admin-terms";
import { labelScopeUsage } from "@/lib/product-card-model-type-labels";
import { cn } from "@/lib/utils";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Модели — QazCard AI" };

type AdminModelsListRow = Extract<
  Awaited<ReturnType<typeof getAdminModelsList>>,
  { ok: true }
>["rows"][number];

function AdminModelsTable({ rows }: { rows: AdminModelsListRow[] }) {
  return (
    <div className="border-border/80 overflow-x-auto rounded-lg border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>{adminTerm("provider")}</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Product Card / использование</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Kie Model ID (apiModelId)</TableHead>
            <TableHead className="text-right">{adminTerm("costCredits")}</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Public</TableHead>
            <TableHead className="w-[1%] min-w-[10rem]">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="text-xs font-medium">{m.name}</TableCell>
              <TableCell className="font-mono text-xs">{m.slug}</TableCell>
              <TableCell className="text-xs">{m.provider}</TableCell>
              <TableCell className="text-xs">{m.scope}</TableCell>
              <TableCell className="text-xs">
                {labelScopeUsage(m.scope, m.productCardModelType)}
              </TableCell>
              <TableCell className="text-xs">{m.type}</TableCell>
              <TableCell className="max-w-[12rem] truncate font-mono text-xs" title={m.apiModelId}>
                {m.apiModelId}
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">{m.costCredits}</TableCell>
              <TableCell className="text-xs">
                <Badge variant={m.isActive ? "qazBlue" : "outline"}>
                  {m.isActive ? "Активна" : "Неактивна"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                <Badge variant={m.isActive && m.isPublic ? "qazGold" : "outline"}>
                  {m.isActive && m.isPublic ? "Публичная" : "Скрыта"}
                </Badge>
              </TableCell>
              <TableCell>
                <ModelRowActions
                  id={m.id}
                  isActive={m.isActive}
                  isPublic={m.isPublic}
                  canDelete={m._count.generations === 0}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function AdminModelsPage() {
  await requireAdminPagePermission("models.view");
  const res = await getAdminModelsList();
  if (!res.ok) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="AI-модели"
          breadcrumbs={[{ label: "Админ", href: "/admin" }, { label: "Модели" }]}
        />
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>Проверьте подключение к базе.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const activeRows = res.rows.filter((m) => m.isActive);
  const inactiveRows = res.rows.filter((m) => !m.isActive);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="AI-модели"
          description="Управление Kie.ai моделями для Product Card и admin QA."
          breadcrumbs={[{ label: "Админ", href: "/admin" }, { label: "Модели" }]}
          className="min-w-0 flex-1"
        />
        <div className="flex flex-wrap gap-2 self-start sm:self-center">
          <Link
            href="/admin/models/import-kie"
            className={cn(
              buttonVariants({ size: "sm", variant: "secondary" }),
              "inline-flex gap-1.5",
            )}
          >
            <Sparkles className="size-3.5" aria-hidden />
            Добавить модель Kie.ai
          </Link>
          <Link
            href="/admin/models/new"
            className={cn(buttonVariants({ size: "sm" }), "inline-flex gap-1.5")}
          >
            <Plus className="size-3.5" aria-hidden />
            Новая модель
          </Link>
        </div>
      </div>

      {res.rows.length === 0 ? (
        <AdminEmpty
          title="Моделей нет"
          description="Создайте модель через Import Wizard или форму «Новая модель»."
        />
      ) : (
        <div className="space-y-8">
          {activeRows.length > 0 ? (
            <section className="space-y-2">
              {inactiveRows.length > 0 ? (
                <h2 className="text-sm font-semibold tracking-tight">Активные</h2>
              ) : null}
              <AdminModelsTable rows={activeRows} />
            </section>
          ) : (
            <p className="text-muted-foreground text-sm">Нет активных моделей.</p>
          )}
          {inactiveRows.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold tracking-tight">Неактивные</h2>
              <p className="text-muted-foreground text-xs">
                Заготовки и отключённые модели — активируйте после настройки Kie Model ID.
              </p>
              <AdminModelsTable rows={inactiveRows} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
