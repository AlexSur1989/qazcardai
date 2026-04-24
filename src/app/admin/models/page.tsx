import Link from "next/link";
import { AlertCircle, Plus } from "lucide-react";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { ModelRowActions } from "@/components/admin/model-row-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { cn } from "@/lib/utils";

export const metadata = { title: "Модели — админ" };

export default async function AdminModelsPage() {
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
        <div className="border-border/80 overflow-x-auto rounded-lg border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Провайдер</TableHead>
                <TableHead>Активна</TableHead>
                <TableHead className="text-right">Кр.</TableHead>
                <TableHead>Генер.</TableHead>
                <TableHead>Создана</TableHead>
                <TableHead className="w-[1%] min-w-[10rem]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {res.rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs font-medium">{m.name}</TableCell>
                  <TableCell className="text-xs font-mono">{m.slug}</TableCell>
                  <TableCell className="text-xs">{m.type}</TableCell>
                  <TableCell className="text-xs">{m.provider}</TableCell>
                  <TableCell className="text-xs">{m.isActive ? "да" : "нет"}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {m.costCredits}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {m._count.generations}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatAdminDateTime(m.createdAt)}
                  </TableCell>
                  <TableCell>
                    <ModelRowActions
                      id={m.id}
                      isActive={m.isActive}
                      canDelete={m._count.generations === 0}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
