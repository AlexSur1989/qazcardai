import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { ModelRowActions } from "@/components/admin/model-row-actions";
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
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Модели — админ" };

export default async function AdminModelsPage() {
  const res = await getAdminModelsList();
  if (!res.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI-модели</h1>
        <Alert className="mt-4" variant="destructive">
          <AlertCircle />
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>Проверьте подключение к базе.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI-модели</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Каталог для UI генерации: цены и флаги только из БД.
          </p>
        </div>
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
        <div className="mt-8">
          <AdminEmpty
            title="Моделей нет"
            description="Создайте первую запись — кнопка «Новая модель» выше."
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border">
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
