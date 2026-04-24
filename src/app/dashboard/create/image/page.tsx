import { Image as ImageIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CreateImageForm } from "@/components/dashboard/create-image-form";
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
  title: "Создать изображение — AI Media",
};

export default async function CreateImagePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/dashboard/create/image");
  }

  const [models, balanceCredits] = await Promise.all([
    prisma.aiModel.findMany({
      where: { isActive: true, type: "IMAGE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        costCredits: true,
        description: true,
        supportsNegativePrompt: true,
        supportsImageInput: true,
        supportsSeed: true,
      },
    }),
    getBalance(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Создать фото
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Модель и стоимость — из базы; запрос к Kie.ai выполняется на сервере.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-5" aria-hidden />
            Генерация
          </CardTitle>
          <CardDescription>
            Выберите модель, задайте промпт и при необходимости параметры. Кредиты
            резервируются и списываются при успехе.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateImageForm models={models} balanceCredits={balanceCredits} />
        </CardContent>
      </Card>
    </div>
  );
}
