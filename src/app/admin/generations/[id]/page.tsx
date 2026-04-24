import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { AdminRefundGenerationForm } from "@/components/admin/admin-refund-generation-form";
import { GenerationDetailView } from "@/components/dashboard/generation-detail-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminGenerationById, getAdminGenerationRefundEligibility } from "@/lib/admin-data";
import type { UserGenerationDetail } from "@/lib/generation-history-data";

export const metadata = { title: "Генерация — админ" };

type Props = { params: Promise<{ id: string }> };

export default async function AdminGenerationDetailPage({ params }: Props) {
  const { id } = await params;
  const res = await getAdminGenerationById(id);

  if (res.ok) {
    const g = res.generation;
    const ref = await getAdminGenerationRefundEligibility(g.id);
    const detail: UserGenerationDetail = {
      id: g.id,
      userId: g.userId,
      type: g.type,
      status: g.status,
      prompt: g.prompt,
      negativePrompt: g.negativePrompt,
      inputFiles: g.inputFiles,
      outputFiles: g.outputFiles,
      metadata: g.metadata,
      errorMessage: g.errorMessage,
      costCredits: g.costCredits,
      createdAt: g.createdAt,
      completedAt: g.completedAt,
      model: {
        id: g.model.id,
        name: g.model.name,
        slug: g.model.slug,
      },
    };
    return (
      <div className="space-y-6">
        <GenerationDetailView
          gen={detail}
          backHref="/admin/generations"
          backLabel="К списку генераций"
          userEmail={g.user.email}
          userIdForAdminLink={g.user.id}
          showRepeat={false}
        />
        {ref.ok && ref.canRefund ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ручной возврат кредитов</CardTitle>
              <CardDescription>
                Доступно, пока по генерации есть <code>RESERVE</code> и нет{" "}
                <code>CAPTURE</code>/<code>REFUND</code>. Создаётся движение и запись{" "}
                <code>generation.refunded</code> в аудите.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminRefundGenerationForm generationId={g.id} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  if (res.error === "not_found") {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Генерация</h1>
      <Alert className="mt-4" variant="destructive">
        <AlertCircle />
        <AlertTitle>Ошибка</AlertTitle>
        <AlertDescription>Не удалось загрузить запись.</AlertDescription>
      </Alert>
    </div>
  );
}
