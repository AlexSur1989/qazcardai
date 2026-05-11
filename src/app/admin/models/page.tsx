import Link from "next/link";
import { AlertCircle, Plus } from "lucide-react";

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
import { formatAdminDateTime } from "@/lib/admin-format";
import { adminTerm } from "@/lib/admin-terms";
import { cn } from "@/lib/utils";
import { requireAdminPagePermission } from "@/server/guards/admin-page-guard";

export const metadata = { title: "Модели — QazCard AI" };

type AdminModelsListRow = Extract<
  Awaited<ReturnType<typeof getAdminModelsList>>,
  { ok: true }
>["rows"][number];

function AdminModelsTable({
  rows,
  variant = "default",
}: {
  rows: AdminModelsListRow[];
  variant?: "default" | "archive";
}) {
  return (
    <div
      className={cn(
        "border-border/80 overflow-x-auto rounded-lg border bg-card shadow-sm",
        variant === "archive" && "border-dashed bg-muted/25",
      )}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead className="text-[0.7rem] leading-tight">Тип</TableHead>
            <TableHead className="text-[0.7rem] leading-tight">Scope</TableHead>
            <TableHead className="text-[0.7rem] leading-tight">Product Card роль</TableHead>
            <TableHead className="text-[0.7rem] leading-tight">
              {adminTerm("provider")}
            </TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Public</TableHead>
            <TableHead className="text-right text-[0.7rem] leading-tight">
              {adminTerm("costCredits")}
            </TableHead>
            <TableHead>Генер.</TableHead>
            <TableHead className="text-[0.7rem] leading-tight">{adminTerm("createdAt")}</TableHead>
            <TableHead className="w-[1%] min-w-[10rem]">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="text-xs font-medium">{m.name}</TableCell>
              <TableCell className="text-xs font-mono">{m.slug}</TableCell>
              <TableCell className="text-xs">{m.type}</TableCell>
              <TableCell className="text-xs">{m.scope}</TableCell>
              <TableCell className="text-xs">{m.productCardModelType ?? "—"}</TableCell>
              <TableCell className="text-xs">{m.provider}</TableCell>
              <TableCell className="text-xs">
                <Badge variant={m.isActive ? "qazBlue" : "outline"}>
                  {m.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                <Badge variant={m.isActive && m.isPublic ? "qazGold" : "outline"}>
                  {m.isActive && m.isPublic ? "Public" : "Hidden"}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">{m.costCredits}</TableCell>
              <TableCell className="text-xs tabular-nums">{m._count.generations}</TableCell>
              <TableCell className="whitespace-nowrap text-xs">
                {formatAdminDateTime(m.createdAt)}
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
  const archiveRows = res.rows.filter((m) => !m.isActive);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="AI-модели"
          description="Каталог для UI генерации: цены и флаги только из БД."
          breadcrumbs={[{ label: "Админ", href: "/admin" }, { label: "Модели" }]}
          className="min-w-0 flex-1"
        />
        <Link
          href="/admin/models/new"
          className={cn(
            buttonVariants({ size: "sm" }),
            "inline-flex gap-1.5 self-start sm:self-center",
          )}
        >
          <Plus className="size-3.5" aria-hidden />
          Новая модель
        </Link>
      </div>

      {res.rows.length === 0 ? (
        <div>
          <AdminEmpty
            title="Моделей нет"
            description="Создайте первую запись — кнопка «Новая модель» выше."
          />
        </div>
      ) : (
        <div className="space-y-8">
          {activeRows.length > 0 ? (
            <section className="space-y-2">
              {archiveRows.length > 0 ? (
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Активные
                </h2>
              ) : null}
              <AdminModelsTable rows={activeRows} />
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              Нет активных моделей — в каталоге для пользователей пусто.
            </p>
          )}
          {archiveRows.length > 0 ? (
            <section className="space-y-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Отключённые / Архив
                </h2>
                <p className="text-xs text-muted-foreground">
                  Не показываются в UI генерации; здесь можно редактировать или снова включить.
                </p>
              </div>
              <AdminModelsTable rows={archiveRows} variant="archive" />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
