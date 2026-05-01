import { Image as ImageIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

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
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Создать изображение — QazCard AI",
};

export default async function CreateImagePage() {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/auth/login?callbackUrl=/dashboard/create/image");
  }

  const [models, balanceCredits] = await Promise.all([
    prisma.aiModel.findMany({
      where: { isActive: true, type: "IMAGE", scope: "GENERAL" },
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
        supportsSeed: true,
      },
    }),
    getBalance(current.user.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        variant="qaz"
        title="Создать фото"
        description="Выбор модели из каталога, постановка в очередь, воркер обращается к провайдеру. Статус обновляется на странице."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "Создать фото" },
        ]}
      />
      <Card>
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
