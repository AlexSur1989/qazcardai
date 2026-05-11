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
import { IMAGE_CREATE_MODEL_GROUPS } from "@/config/generation-models";
import type { CreateImageFormModel } from "@/components/dashboard/create-image-form";
import { prisma } from "@/lib/prisma";
import { getCreditsUiFloor } from "@/server/services/pricing";

export const metadata = {
  title: "Создать изображение — QazCard AI",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CreateImagePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const rawModel =
    typeof sp.model === "string" ? sp.model : Array.isArray(sp.model) ? sp.model[0] : undefined;
  if (rawModel?.trim() === "gpt-image-2") {
    redirect("/dashboard/models/gpt-image-2");
  }

  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard/create/image");
  }

  const [rows, balanceCredits] = await Promise.all([
    prisma.aiModel.findMany({
      where: { isActive: true, type: "IMAGE", scope: "GENERAL" },
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
        supportsSeed: true,
      },
    }),
    getBalance(current.user.id),
  ]);

  const models = rows.map((m) => {
    const { pricingSchema: _p, ...rest } = m;
    return {
      ...rest,
      creditsUiMin: getCreditsUiFloor(m),
    };
  });

  const modelsBySlug = new Map(models.map((m) => [m.slug, m]));
  const groupedSlugSet = new Set(
    IMAGE_CREATE_MODEL_GROUPS.flatMap((g) => g.variants.map((v) => v.slug)),
  );
  const soloModels = models.filter((m) => !groupedSlugSet.has(m.slug));
  const modelGroups = IMAGE_CREATE_MODEL_GROUPS.map((spec) => ({
    label: spec.label,
    members: spec.variants.flatMap((v) => {
      const base = modelsBySlug.get(v.slug);
      if (!base) {
        return [];
      }
      return [{ ...base, pickerLabel: v.optionLabel }] satisfies readonly [
        CreateImageFormModel,
      ];
    }),
  })).filter((g) => g.members.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        variant="qaz"
        title="Создать фото"
        description="Выбор модели из каталога, постановка в очередь, воркер обращается к провайдеру. Статус обновляется на странице."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "AI-модели", href: "/dashboard/models" },
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
            <CreateImageForm
              soloModels={soloModels}
              modelGroups={modelGroups}
              balanceCredits={balanceCredits}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
