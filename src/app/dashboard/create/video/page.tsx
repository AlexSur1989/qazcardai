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
import { isAiModelVisibleInUserCatalog } from "@/lib/ai-model-public-catalog";
import { getCreditsUiFloor } from "@/server/services/pricing";

export const metadata = {
  title: "Создать видео — QazCard AI",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CreateVideoPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const rawModel =
    typeof sp.model === "string" ? sp.model : Array.isArray(sp.model) ? sp.model[0] : undefined;
  if (rawModel?.trim() === "kling-2-6") {
    redirect("/dashboard/models/kling-2-6");
  }

  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard/create/video");
  }

  const [rows, balanceCredits] = await Promise.all([
    prisma.aiModel.findMany({
      where: { isActive: true, isPublic: true, type: "VIDEO", scope: "GENERAL", productCardModelType: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        costCredits: true,
        pricingSchema: true,
        description: true,
        settingsSchema: true,
        supportsNegativePrompt: true,
        supportsImageInput: true,
        supportsVideoInput: true,
        supportsSeed: true,
        maxDuration: true,
        isPublic: true,
        metadata: true,
      },
    }),
    getBalance(current.user.id),
  ]);

  const models = rows
    .filter((m) =>
      isAiModelVisibleInUserCatalog({
        slug: m.slug,
        isActive: true,
        isPublic: m.isPublic,
        metadata: m.metadata,
      }),
    )
    .map((m) => {
    const { pricingSchema: _p, ...rest } = m;
    return {
      ...rest,
      creditsUiMin: getCreditsUiFloor(m),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        variant="qaz"
        title="Создать видео"
        description="Запустите генерацию и отслеживайте статус на этой странице или в истории."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "AI-модели", href: "/dashboard/models" },
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
            Кредиты резервируются при запуске; окончательное списание — после успешного результата.
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
