import { Image as ImageIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { CreateImageForm } from "@/components/dashboard/create-image-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateFormSkeleton } from "@/components/dashboard/create-form-skeleton";
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
      <PageHeader
        title="Создать фото"
        description="Выбор модели из каталога, постановка в очередь, воркер обращается к провайдеру. Статус обновляется на странице."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "Создать фото" },
        ]}
      />
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-5" aria-hidden />
            Генерация
          </CardTitle>
          <CardDescription>
            Кредиты резервируются при постановке; списание (CAPTURE) — когда появляется
            результат, возврат при ошибке.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<CreateFormSkeleton />}>
            <CreateImageForm models={models} balanceCredits={balanceCredits} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
