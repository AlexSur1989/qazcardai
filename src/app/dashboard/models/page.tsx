import { redirect } from "next/navigation";

import { ModelsCatalogExplore } from "@/components/dashboard/models-catalog-explore";
import { PageHeader } from "@/components/layout/page-header";
import { prismaWhereForDashboardModelsCatalog } from "@/lib/ai-models-catalog-db";
import {
  mergeGenerationCatalog,
  visibleInModelsCatalog,
} from "@/lib/generation-models-catalog";
import { prisma } from "@/lib/prisma";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import type { GenerationTaskId } from "@/config/generation-models";
import { TASK_FILTER_GROUPS } from "@/config/generation-models";

export const metadata = {
  title: "AI-модели — QazCard AI",
};

const TASK_IDS = new Set(
  TASK_FILTER_GROUPS.flatMap((g) => g.items.map((i) => i.id)),
);

function parseTaskParam(raw: string | string[] | undefined): GenerationTaskId[] {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s?.trim()) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x): x is GenerationTaskId => TASK_IDS.has(x as GenerationTaskId));
}

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardModelsPage({ searchParams }: Props) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect("/login?next=/dashboard/models");
  }

  const sp = (await searchParams) ?? {};
  const qRaw = sp.q ?? sp.search;
  const initialSearch =
    typeof qRaw === "string" ? qRaw : Array.isArray(qRaw) ? (qRaw[0] ?? "") : "";
  const initialTaskFilters = parseTaskParam(sp.task);

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
        productCardModelType: true,
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

  const models = visibleInModelsCatalog(
    mergeGenerationCatalog({
      dbModels,
      productFlowMinCredits,
    }),
  );

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
      <ModelsCatalogExplore
        key={[initialSearch, ...initialTaskFilters].join("|")}
        models={models}
        suppressTitleBlock
        initialSearch={initialSearch}
        initialTaskFilters={initialTaskFilters}
      />
    </div>
  );
}
