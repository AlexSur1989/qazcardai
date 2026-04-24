import { auth } from "@/auth";
import { DashboardSectionEmpty } from "@/components/dashboard/dashboard-section-empty";
import { GenerationPreviewList } from "@/components/dashboard/generation-preview-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getUserGenerationsList } from "@/lib/dashboard-data";
import { redirect } from "next/navigation";
import { AlertCircle, History } from "lucide-react";

export const metadata = {
  title: "История генераций — AI Media",
};

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/dashboard/history");
  }

  const data = await getUserGenerationsList(session.user.id);

  if (!data.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          История
        </h1>
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Не удалось загрузить историю</AlertTitle>
          <AlertDescription>
            {data.error === "not_found"
              ? "Пользователь не найден. Войдите снова."
              : "Проверьте базу данных и обновите страницу."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const all = data.items;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          История генераций
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Видны только ваши запросы. Фильтры и скачивание — на следующих этапах.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5" aria-hidden />
            Все записи
          </CardTitle>
          <CardDescription>До 50 последних запросов, только ваши.</CardDescription>
        </CardHeader>
        <CardContent>
          {all.length === 0 ? (
            <DashboardSectionEmpty
              title="История пуста"
              description="После первых генераций они появятся здесь и на главной кабинета."
            />
          ) : (
            <GenerationPreviewList
              items={all}
              emptyMessage="Нет данных."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
