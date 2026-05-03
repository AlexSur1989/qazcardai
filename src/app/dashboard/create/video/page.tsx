import { Video } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { CreateVideoForm } from "@/components/dashboard/create-video-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateFormSkeleton } from "@/components/dashboard/create-form-skeleton";
import { getBalance } from "@/server/services/credits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Создать видео — QazCard AI",
};

export default async function CreateVideoPage() {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard/create/video");
  }

  const [models, balanceCredits] = await Promise.all([
    prisma.aiModel.findMany({
      where: { isActive: true, type: "VIDEO", scope: "GENERAL" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        costCredits: true,
        description: true,
        settingsSchema: true,
        supportsNegativePrompt: true,
        supportsImageInput: true,
        supportsVideoInput: true,
        supportsSeed: true,
        maxDuration: true,
      },
    }),
    getBalance(current.user.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        variant="qaz"
        title="Создать видео"
        description="Постановка в очередь, статусы и результат отслеживайте в истории и на этой странице (опрос по id)."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "Создать видео" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="size-5" aria-hidden />
            Задача
          </CardTitle>
          <CardDescription>
            Модели и стоимость из базы; кредиты резервируются при создании задачи.
            Завершение и списание — во воркере (следующий этап).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<CreateFormSkeleton />}>
            <CreateVideoForm models={models} balanceCredits={balanceCredits} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
