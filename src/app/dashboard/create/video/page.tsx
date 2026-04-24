import { Video } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CreateVideoForm } from "@/components/dashboard/create-video-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBalance } from "@/server/services/credits";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Создать видео — AI Media",
};

export default async function CreateVideoPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/dashboard/create/video");
  }

  const [models, balanceCredits] = await Promise.all([
    prisma.aiModel.findMany({
      where: { isActive: true, type: "VIDEO" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        costCredits: true,
        description: true,
        supportsNegativePrompt: true,
        supportsImageInput: true,
        supportsVideoInput: true,
        supportsSeed: true,
        maxDuration: true,
      },
    }),
    getBalance(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Создать видео
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Запрос в очередь, без ожидания готового файла. Статус — по id генерации.
        </p>
      </div>
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
          <CreateVideoForm models={models} balanceCredits={balanceCredits} />
        </CardContent>
      </Card>
    </div>
  );
}
