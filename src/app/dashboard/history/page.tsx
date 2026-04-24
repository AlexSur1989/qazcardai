import { auth } from "@/auth";
import { HistoryFiltersForm } from "@/components/dashboard/history-filters-form";
import { HistoryGenerationList } from "@/components/dashboard/history-generation-list";
import { DashboardSectionEmpty } from "@/components/dashboard/dashboard-section-empty";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { GenerationStatus, GenerationType } from "@/generated/prisma/enums";
import { getUserHistoryList, type UserHistoryFilters } from "@/lib/generation-history-data";
import { redirect } from "next/navigation";
import { AlertCircle, History } from "lucide-react";

export const metadata = {
  title: "История генераций — AI Media",
};

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

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

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HistoryPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/dashboard/history");
  }

  const sp = (await searchParams) ?? {};
  const typeRaw = first(sp.type);
  const type: GenerationType | undefined =
    typeRaw === "IMAGE" || typeRaw === "VIDEO" ? typeRaw : undefined;
  const statusRaw = first(sp.status);
  const status: GenerationStatus | undefined = ALL_STATUS.includes(
    statusRaw as GenerationStatus,
  )
    ? (statusRaw as GenerationStatus)
    : undefined;
  const q = first(sp.q).trim() || undefined;

  const filters: UserHistoryFilters = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
  };

  const data = await getUserHistoryList(session.user.id, filters);

  if (!data.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">История</h1>
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Не удалось загрузить историю</AlertTitle>
          <AlertDescription>
            {data.error === "not_found"
              ? "Пользователь не найден. Войдите снова."
              : data.error === "database"
                ? "Проверьте подключение к базе и обновите страницу."
                : "Что-то пошло не так."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const items = data.items;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          История генераций
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Только ваши запросы. Скачивание — готовых файлов, повтор — с теми же
          modelId и промптом (в пределах длины URL).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5" aria-hidden />
            Фильтры
          </CardTitle>
          <CardDescription>Тип, статус, поиск по тексту промпта.</CardDescription>
        </CardHeader>
        <CardContent>
          <HistoryFiltersForm
            typeValue={typeRaw}
            statusValue={statusRaw}
            qValue={q ?? ""}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Записи</CardTitle>
          <CardDescription>
            До 100 позиций, новые сверху. Пусто — сузьте фильтр или сбросьте.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <DashboardSectionEmpty
              title="Ничего не найдено"
              description="Попробуйте другой фильтр или создайте новую генерацию."
            />
          ) : (
            <HistoryGenerationList items={items} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
