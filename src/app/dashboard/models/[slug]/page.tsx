import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  TASK_LABELS_RU,
  GENERATION_MODEL_CATALOG,
} from "@/config/generation-models";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  CreateVideoForm,
  type CreateVideoFormModel,
} from "@/components/dashboard/create-video-form";
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
const KLING_26_T2V_SLUG = "kling-2-6-text-to-video";
const KLING_26_I2V_SLUG = "kling-2-6-image-to-video";

/** Старые URL карточек до объединения семейств */
const LEGACY_CATALOG_SLUG_REDIRECTS: Record<string, string> = {
  "kling-2-6-text-to-video": "/dashboard/models/kling-2-6?mode=t2v",
  "kling-2-6-image-to-video": "/dashboard/models/kling-2-6?mode=i2v",
};

const FAMILY_HUB_SLUGS = new Set(["gpt-image-2", "kling-2-6"]);

const KLING_VIDEO_SELECT = {
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
} as const;

function resolveKling26InitialSlug(
  raw: string | string[] | undefined,
): string | undefined {
  const s = firstSearchParam(raw)?.trim().toLowerCase();
  if (!s) return undefined;
  if (
    s === "i2v" ||
    s === "image-to-video" ||
    s === "image" ||
    s === KLING_26_I2V_SLUG
  ) {
    return KLING_26_I2V_SLUG;
  }
  if (
    s === "t2v" ||
    s === "text-to-video" ||
    s === "text" ||
    s === KLING_26_T2V_SLUG
  ) {
    return KLING_26_T2V_SLUG;
  }
  return undefined;
}

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

  const legacyTarget = LEGACY_CATALOG_SLUG_REDIRECTS[slug];
  if (legacyTarget) {
    redirect(legacyTarget);
  }

  const variantRaw = firstSearchParam(sp.variant)?.toLowerCase();
  const initialGptVariant =
    variantRaw === "i2i" || variantRaw === "image"
      ? ("i2i" as const)
      : ("t2i" as const);

  const klingInitialSlug = resolveKling26InitialSlug(sp.mode);
  const needPlaygroundBalance = FAMILY_HUB_SLUGS.has(slug);

  const [[dbRows, productMinRow], balanceCredits] = await Promise.all([
    Promise.all([
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
    ]),
    needPlaygroundBalance ? getBalance(current.user.id) : Promise.resolve(0),
  ]);

  let gptImage2Playground: ReactNode = null;
  if (slug === "gpt-image-2") {
    const [rowT2I, rowI2I] = await Promise.all([
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
    ]);
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

  let kling26Playground: ReactNode = null;
  if (slug === "kling-2-6") {
    const [rowT2V, rowI2V] = await Promise.all([
      prisma.aiModel.findFirst({
        where: {
          slug: KLING_26_T2V_SLUG,
          isActive: true,
          type: "VIDEO",
          scope: "GENERAL",
        },
        select: KLING_VIDEO_SELECT,
      }),
      prisma.aiModel.findFirst({
        where: {
          slug: KLING_26_I2V_SLUG,
          isActive: true,
          type: "VIDEO",
          scope: "GENERAL",
        },
        select: KLING_VIDEO_SELECT,
      }),
    ]);

    if (rowT2V && rowI2V) {
      const toFormModel = (row: NonNullable<typeof rowT2V>): CreateVideoFormModel => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        creditsUiMin: getCreditsUiFloor(row),
        description: row.description,
        settingsSchema: row.settingsSchema,
        supportsNegativePrompt: row.supportsNegativePrompt,
        supportsImageInput: row.supportsImageInput,
        supportsVideoInput: row.supportsVideoInput,
        supportsSeed: row.supportsSeed,
        maxDuration: row.maxDuration,
      });

      kling26Playground = (
        <section
          id="kling-2-6-playground"
          className="border-border rounded-2xl border bg-muted/25 p-5 shadow-inner md:p-6"
        >
          <div className="mb-6 space-y-1">
            <h2 className="text-lg font-semibold">Генерация Kling 2.6</h2>
            <p className="text-muted-foreground text-sm">
              Режимы Kie:{" "}
              <span className="font-mono">kling-2.6/text-to-video</span> и{" "}
              <span className="font-mono">kling-2.6/image-to-video</span>. Параметры
              берутся из схемы модели; списание — в токенах QazCard.
            </p>
          </div>
          <CreateVideoForm
            models={[toFormModel(rowT2V), toFormModel(rowI2V)]}
            balanceCredits={balanceCredits}
            familyHub={{
              labels: ["Текст → видео", "Изображение → видео"],
              initialSlug: klingInitialSlug,
            }}
          />
        </section>
      );
    }
  }

  const showGptPlayground = slug === "gpt-image-2" && gptImage2Playground !== null;
  const showKlingPlayground = slug === "kling-2-6" && kling26Playground !== null;
  const showAnyPlayground = showGptPlayground || showKlingPlayground;

  const playgroundAnchor =
    showGptPlayground ? "#gpt-image-2-playground"
    : showKlingPlayground ? "#kling-2-6-playground"
    : null;

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
    card.status === "active" && playgroundAnchor ? playgroundAnchor : primaryHref;
  const sidebarPrimaryLabel =
    card.status === "active" && playgroundAnchor ? "К генерации" : primaryLabel;

  const def = GENERATION_MODEL_CATALOG.find((c) => c.catalogSlug === slug);

  const hubTitle =
    def && FAMILY_HUB_SLUGS.has(slug) ? def.displayName : card.displayName;

  const secondaryCreateLabel =
    def?.openBehavior.kind === "video"
      ? "Открыть в «Создать видео»"
      : "Открыть в «Создать фото»";

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
            {hubTitle}
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

          {!showAnyPlayground ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Примеры</h2>
              <p className="text-muted-foreground text-sm">
                Примеры результатов появятся по мере накопления истории в кабинете. Запустите
                генерацию и посмотрите превью в разделе «История».
              </p>
            </section>
          ) : null}
          {gptImage2Playground}
          {kling26Playground}
          {showAnyPlayground ?
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
            {card.status === "active" && showAnyPlayground ?
              <Link
                href={primaryHref}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                {secondaryCreateLabel}
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
