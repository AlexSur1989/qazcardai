import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { AdminGenerationsFiltersForm } from "@/components/admin/admin-generations-filters-form";
import { AdminEmpty } from "@/components/admin/admin-empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { buttonVariants } from "@/components/ui/button";
import {
  getAdminGenerationsList,
  getAdminGenerationFilterOptions,
} from "@/lib/admin-data";
import { formatAdminDateTime, truncate } from "@/lib/admin-format";
import { generationStatusLabel } from "@/lib/generation-labels";
import { cn } from "@/lib/utils";
import type { GenerationStatus, GenerationType } from "@/generated/prisma/enums";

export const metadata = { title: "Генерации — админ" };

const ALL_STATUS: GenerationStatus[] = [
  "CREATED",
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "BLOCKED",
  "CANCELLED",
  "REFUNDED",
];

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminGenerationsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const userId = first(sp.userId).trim() || undefined;
  const typeRaw = first(sp.type);
  const type: GenerationType | undefined =
    typeRaw === "IMAGE" || typeRaw === "VIDEO" ? typeRaw : undefined;
  const statusRaw = first(sp.status);
  const status: GenerationStatus | undefined = ALL_STATUS.includes(
    statusRaw as GenerationStatus,
  )
    ? (statusRaw as GenerationStatus)
    : undefined;
  const modelId = first(sp.modelId).trim() || undefined;
  const q = first(sp.q).trim() || undefined;

  const [res, opts] = await Promise.all([
    getAdminGenerationsList({ userId, type, status, modelId, q }),
    getAdminGenerationFilterOptions(),
  ]);

  if (!res.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Генерации</h1>
        <Alert className="mt-4" variant="destructive">
          <AlertCircle />
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>Проверьте подключение к базе.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!opts.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Генерации</h1>
        <Alert className="mt-4" variant="destructive">
          <AlertCircle />
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>Не удалось загрузить списки для фильтров.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasActiveFilters = Boolean(
    userId || type || status || modelId || q,
  );
  const rows = res.rows;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Генерации</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Все запросы (до 200, новые сверху). Фильтрация по пользователю, типу, статусу,
          модели и промпту.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>
            Список пользователей — до 300 по email; модели — из каталога.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminGenerationsFiltersForm
            userIdValue={userId ?? ""}
            typeValue={typeRaw}
            statusValue={statusRaw}
            modelIdValue={modelId ?? ""}
            qValue={q ?? ""}
            users={opts.users}
            models={opts.models}
          />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <div>
          {hasActiveFilters ? (
            <AdminEmpty
              title="Нет записей"
              description="Сузьте или сбросьте фильтр — в базе могут быть другие генерации."
            />
          ) : (
            <AdminEmpty
              title="Генераций нет"
              description="Список заполнится после появления запросов от пользователей."
            />
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Модель</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="max-w-[10rem]">Ошибка / модерация</TableHead>
                <TableHead>Промпт</TableHead>
                <TableHead className="text-right">Кр.</TableHead>
                <TableHead>Создана</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="max-w-[10rem]">
                    <Link
                      href={`/admin/users/${g.userId}`}
                      className="text-primary truncate text-xs underline"
                      title={g.user.email}
                    >
                      {g.user.email}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[7rem] truncate text-xs">
                    {g.model.name}
                  </TableCell>
                  <TableCell className="text-xs">{g.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {generationStatusLabel(g.status)}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground max-w-[10rem] text-xs"
                    title={g.errorMessage ?? ""}
                  >
                    {g.errorMessage ? truncate(g.errorMessage, 40) : "—"}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground max-w-[12rem] text-xs"
                    title={g.prompt}
                  >
                    {truncate(g.prompt, 48)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {g.costCredits}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatAdminDateTime(g.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/generations/${g.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      Детали
                    </Link>
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
