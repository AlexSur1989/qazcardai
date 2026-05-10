import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  TASK_LABELS_RU,
  GENERATION_MODEL_CATALOG,
} from "@/config/generation-models";
import { Button, buttonVariants } from "@/components/ui/button";
import { GptImage2Playground } from "@/components/dashboard/model-playgrounds/gpt-image-2-playground";
import { prismaWhereForDashboardModelsCatalog } from "@/lib/ai-models-catalog-db";
import {
  mergeGenerationCatalog,
  type MergedCatalogModelCard,
} from "@/lib/generation-models-catalog";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { getBalance } from "@/server/services/credits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { getCreditsUiFloor } from "@/server/services/pricing";

function firstSearchParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

const GPT_IMAGE_2_T2I_SLUG = "gpt-image-2-text-to-image-general";
const GPT_IMAGE_2_I2I_SLUG = "gpt-image-2-image-to-image";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolvePrimaryCta(card: MergedCatalogModelCard) {
  const fromCat = GENERATION_MODEL_CATALOG.find(
    (c) => c.catalogSlug === card.catalogSlug,
  )?.openBehavior;

  if (fromCat?.kind === "detail_only") {
    return {
      href: "/dashboard/create/product-card",
      label: "Перейти к карточке товара",
    };
  }
  if (fromCat?.kind === "product_card") {
    return { href: "/dashboard/create/product-card", label: "Открыть поток карточки" };
  }
  return { href: card.openHref, label: "Создать" };
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const def = GENERATION_MODEL_CATALOG.find((c) => c.catalogSlug === slug);
  const title = def?.displayName ?? slug;
  return {
    title: `${title} — AI-модели — QazCard AI`,
  };
}

export default async function ModelDetailPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  if (!slug) {
    notFound();
  }

  const current = await getFreshSessionUser();
  if (!current.ok) {
    redirect(
      `/login?next=${encodeURIComponent(`/dashboard/models/${slug}`)}`,
    );
  }

  const variantRaw = firstSearchParam(sp.variant)?.toLowerCase();
  const initialGptVariant =
    variantRaw === "i2i" || variantRaw === "image"
      ? ("i2i" as const)
      : ("t2i" as const);

  const catalogAndGpt = await Promise.all([
    prisma.aiModel.findMany({
      where: prismaWhereForDashboardModelsCatalog(),
      select: {
        id: true,
        name: true,
        slug: true,
        provider: true,
        type: true,
        scope: true,
        productCardModelType: true,
        costCredits: true,
        pricingSchema: true,
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
    slug === "gpt-image-2" ?
      Promise.all([
        getBalance(current.user.id),
        prisma.aiModel.findFirst({
          where: {
            slug: GPT_IMAGE_2_T2I_SLUG,
            isActive: true,
            type: "IMAGE",
            scope: "GENERAL",
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            settingsSchema: true,
          },
        }),
        prisma.aiModel.findFirst({
          where: {
            slug: GPT_IMAGE_2_I2I_SLUG,
            isActive: true,
            type: "IMAGE",
            scope: "GENERAL",
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            settingsSchema: true,
          },
        }),
      ])
    : Promise.resolve(null),
  ]);

  const [dbRows, productMinRow, gptBundle] = catalogAndGpt;

  let gptImage2Playground: ReactNode = null;
  if (gptBundle && slug === "gpt-image-2") {
    const [balanceCredits, rowT2I, rowI2I] = gptBundle;
    if (rowT2I && rowI2I) {
      gptImage2Playground = (
        <GptImage2Playground
          balanceCredits={balanceCredits}
          initialVariant={initialGptVariant}
          t2i={{
            id: rowT2I.id,
            name: rowT2I.name,
            slug: rowT2I.slug,
            description: rowT2I.description,
            settingsSchema: rowT2I.settingsSchema,
          }}
          i2i={{
            id: rowI2I.id,
            name: rowI2I.name,
            slug: rowI2I.slug,
            description: rowI2I.description,
            settingsSchema: rowI2I.settingsSchema,
          }}
        />
      );
    }
  }

  const showGptPlayground = slug === "gpt-image-2" && gptImage2Playground !== null;

  const dbModels = dbRows.map((m) => {
    const { pricingSchema: _p, ...rest } = m;
    return {
      ...rest,
      creditsUiMin: getCreditsUiFloor(m),
    };
  });

  const models = mergeGenerationCatalog({
    dbModels,
    productFlowMinCredits: productMinRow._min.costCredits ?? null,
  });

  const card = models.find((m) => m.catalogSlug === slug);
  if (!card) {
    notFound();
  }

  const { href: primaryHref, label: primaryLabel } = resolvePrimaryCta(card);
  const sidebarPrimaryHref =
    card.status === "active" && showGptPlayground ?
      `#gpt-image-2-playground`
    : primaryHref;
  const sidebarPrimaryLabel =
    card.status === "active" && showGptPlayground ? "К генерации" : primaryLabel;

  const def = GENERATION_MODEL_CATALOG.find((c) => c.catalogSlug === slug);

  const catalogDescription =
    def?.descriptionFallback ??
    card.description ??
    "Описание модели временно недоступно.";

  return (
    <div className="space-y-10">
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br px-6 py-10 md:px-10 ${card.gradientClass}`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="relative z-[1] max-w-2xl space-y-3 text-white">
          <p className="text-xs font-semibold tracking-wider text-white/90 uppercase">
            {card.providerLabel}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {card.displayName}
          </h1>
          <p className="text-sm leading-relaxed text-white/90">{catalogDescription}</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Возможности</h2>
            <ul className="text-muted-foreground flex flex-wrap gap-2 text-sm">
              {card.tasks.map((t) => (
                <li
                  key={t}
                  className="bg-primary/8 text-foreground rounded-lg px-3 py-1 font-medium"
                >
                  {TASK_LABELS_RU[t]}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Стоимость</h2>
            <p className="text-muted-foreground text-sm">
              {card.costCreditsMin != null
                ? `От ${card.costCreditsMin} токенов за операцию (зависит от настроек и провайдера).`
                : "Стоимость уточняется при выборе параметров в форме генерации."}
            </p>
          </section>

          {!showGptPlayground ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Примеры</h2>
              <p className="text-muted-foreground text-sm">
                Примеры результатов появятся по мере накопления истории в кабинете. Запустите
                генерацию и посмотрите превью в разделе «История».
              </p>
            </section>
          ) : null}
          {gptImage2Playground}
          {showGptPlayground ?
            <p className="text-muted-foreground text-sm">
              Результат и историю запросов можно посмотреть в разделе{" "}
              <Link href="/dashboard/history" className="text-primary underline">
                История
              </Link>
              .
            </p>
          : null}
        </div>

        <aside className="bg-card border-border space-y-4 rounded-2xl border p-5 shadow-sm">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Статус
          </p>
          <p className="text-foreground text-sm font-medium">
            {card.status === "active"
              ? "Модель доступна"
              : card.status === "disabled"
                ? "Модель отключена администратором"
                : "Скоро появится в каталоге"}
          </p>
          <div className="flex flex-col gap-2">
            {card.status === "active" ? (
              <Link href={sidebarPrimaryHref} className={cn(buttonVariants())}>
                {sidebarPrimaryLabel}
              </Link>
            ) : (
              <Button disabled>{sidebarPrimaryLabel}</Button>
            )}
            {card.status === "active" && showGptPlayground ?
              <Link
                href={primaryHref}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Открыть в «Создать фото»
              </Link>
            : null}
            <Link
              href="/dashboard/models"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Все модели
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
