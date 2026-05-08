import { redirect } from "next/navigation";

import { ModelsCatalogExplore } from "@/components/dashboard/models-catalog-explore";
import { PageHeader } from "@/components/layout/page-header";
import { prismaWhereForDashboardModelsCatalog } from "@/lib/ai-models-catalog-db";
import { mergeGenerationCatalog } from "@/lib/generation-models-catalog";
import { prisma } from "@/lib/prisma";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

export const metadata = {
  title: "AI-модели — QazCard AI",
};

export default async function DashboardModelsPage() {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard/models");
  }

  const [dbModels, productMinRow] = await Promise.all([
    prisma.aiModel.findMany({
      where: prismaWhereForDashboardModelsCatalog(),
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        provider: true,
        type: true,
        scope: true,
        costCredits: true,
        description: true,
        isActive: true,
        supportsImageInput: true,
        supportsVideoInput: true,
      },
    }),
    prisma.aiModel.aggregate({
      where: { scope: "PRODUCT_CARD", isActive: true },
      _min: { costCredits: true },
    }),
  ]);

  const productFlowMinCredits = productMinRow._min.costCredits ?? null;

  const models = mergeGenerationCatalog({
    dbModels,
    productFlowMinCredits,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        variant="qaz"
        title="AI-модели"
        description="Выберите модель для генерации изображений, видео или редактирования контента."
        breadcrumbs={[
          { label: "Кабинет", href: "/dashboard" },
          { label: "AI-модели" },
        ]}
      />
      <ModelsCatalogExplore models={models} suppressTitleBlock />
    </div>
  );
}
