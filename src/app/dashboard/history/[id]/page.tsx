import { notFound, redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { GenerationDetailView } from "@/components/dashboard/generation-detail-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getUserGenerationDetail } from "@/lib/generation-history-data";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

export const metadata = {
  title: "Детали генерации — QazCard AI",
};

type Props = { params: Promise<{ id: string }> };

export default async function HistoryDetailPage({ params }: Props) {
  const { id } = await params;
  if (!id) {
    notFound();
  }

  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect(
      `/auth/login?callbackUrl=${encodeURIComponent(`/dashboard/history/${id}`)}`,
    );
  }

  const res = await getUserGenerationDetail(current.user.id, id);
  if (res.ok) {
    return (
      <GenerationDetailView
        gen={res.generation}
        backHref="/dashboard/history"
        backLabel="К истории"
        showRepeat
      />
    );
  }
  if (res.error === "not_found") {
    notFound();
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Генерация</h1>
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Ошибка</AlertTitle>
        <AlertDescription>
          Не удалось загрузить запись. Обновите страницу.
        </AlertDescription>
      </Alert>
    </div>
  );
}
