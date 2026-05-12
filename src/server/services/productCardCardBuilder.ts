import type { ProductCategoryId } from "@/config/product-card-categories";
import { getProductCategoryById } from "@/config/product-card-categories";
import {
  CARD_BUILDER_AUDIENCES,
  CARD_BUILDER_BENEFIT_TAGS,
  CARD_BUILDER_MARKETPLACES,
  CARD_BUILDER_MUST_SHOW,
  CARD_BUILDER_PRESERVE_ASPECTS,
  CARD_BUILDER_PRICE_SEGMENTS,
  CARD_BUILDER_SALES_STYLES,
  type CardBuilderGoalId,
  type CardBuilderImageRole,
  type CardBuilderPreserveAspectId,
} from "@/config/card-builder-presets";
import { buildCardBuilderSlidePrompt } from "@/config/product-card-prompts";
import { prisma } from "@/lib/prisma";
import { allocateCreditsAcrossVariants } from "@/server/services/productCardPricing";
import { assertUserOwnsFileUrl, getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";
import { resolveCardBuilderImageModel } from "@/server/services/productCardModelResolver";
import {
  buildCardBuilderGalleryPlan,
  type CardBuilderRecommendedTextMode,
  type CardBuilderSlidePlan,
} from "@/server/services/productCardBuilderPlan";
import {
  buildCardBuilderPriceBreakdown,
  estimateCardBuilderGalleryCredits,
  estimateCardBuilderPlanCreditsCost,
  estimateCardBuilderSingleSlideCredits,
} from "@/server/services/productCardBuilderCredits";
import { PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE } from "@/server/services/productCardSettings";
import { getProductCardScenarios, isCardBuilderScenarioEnabled } from "@/server/services/productCardScenarios";
import { isValidProductCategoryId } from "@/server/services/productCardGeneration";
import { queueProductCardImage, type ProductCardGenMeta } from "@/server/services/productCardQueueGenerations";
import {
  appendCardBuilderGenerationRecord,
  persistCardBuilderDraft,
  recordCardBuilderSlideJob,
} from "@/server/services/productCardUpdateMeta";
import { getBalance } from "@/server/services/credits";

export type CardBuilderWizardSettings = {
  marketplace: string;
  goal: CardBuilderGoalId;
  preserveProduct: boolean;
  preserveAspects: CardBuilderPreserveAspectId[];
  allowCreativeStyle: boolean;
  benefitsTags: string[];
  benefitsExtra?: string;
  mustShow: string[];
  audience: string | null;
  priceSegment: string | null;
  salesStyle: string;
  textDensity: CardBuilderRecommendedTextMode;
};

function marketplaceLabel(id: string): string {
  return CARD_BUILDER_MARKETPLACES.find((x) => x.id === id)?.label ?? id;
}

function tagLabels(ids: readonly string[], catalog: readonly { id: string; label: string }[]): string {
  return ids
    .map((id) => catalog.find((x) => x.id === id)?.label ?? id)
    .filter(Boolean)
    .join(", ");
}

type Err = { ok: false; error: string; status: number; code?: "PRICE_CHANGED" };
type Ok<T> = { ok: true } & T;
type Res<T> = Err | Ok<T>;

async function gateCardBuilder(): Promise<Err | { ok: true }> {
  const scenarios = await getProductCardScenarios();
  if (!isCardBuilderScenarioEnabled(scenarios)) {
    return {
      ok: false,
      error:
        "Сценарий «Создать карточку» временно недоступен. Если нужна помощь — напишите в поддержку.",
      status: 403,
    };
  }
  return { ok: true };
}

async function resolveSourcesAndProject(
  userId: string,
  projectId: string,
): Promise<
  | Err
  | {
      ok: true;
      project: NonNullable<Awaited<ReturnType<typeof getOwnedProjectOrNull>>>;
      sourceUrls: string[];
      primaryUrl: string;
    }
> {
  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) {
    return { ok: false, error: "Проект не найден", status: 404 };
  }
  const imgs = normalizeProductSourceImages(project);
  const urls = imgs.map((x) => x.url).filter(Boolean);
  const primary = urls[0] ?? project.sourceImageUrl?.trim() ?? "";
  if (!primary) {
    return { ok: false, error: "Загрузите фото товара", status: 400 };
  }
  const all = urls.length > 0 ? urls : [primary];
  for (const u of all) {
    const own = await assertUserOwnsFileUrl(userId, u);
    if (!own) {
      return { ok: false, error: "Нет доступа к файлу фото", status: 403 };
    }
  }
  return { ok: true, project, sourceUrls: all, primaryUrl: primary };
}

function categoryOrErr(
  project: { selectedCategory: string | null },
): Res<{ categoryId: ProductCategoryId }> {
  const cat = project.selectedCategory?.trim();
  if (!cat || !isValidProductCategoryId(cat)) {
    return { ok: false, error: "Укажите категорию товара", status: 400 };
  }
  return { ok: true, categoryId: cat };
}

export async function persistCardBuilderGalleryPlan(
  userId: string,
  projectId: string,
  settings: CardBuilderWizardSettings,
): Promise<Res<{ slides: CardBuilderSlidePlan[] }>> {
  const gated = await gateCardBuilder();
  if (!gated.ok) return gated;

  const pack = await resolveSourcesAndProject(userId, projectId);
  if (!pack.ok) return pack;

  const cat = categoryOrErr(pack.project);
  if (!cat.ok) return cat;

  const planInput = {
    selectedCategory: cat.categoryId,
    marketplace: settings.marketplace,
    goal: settings.goal,
    preserveProduct: settings.preserveProduct,
    preserveAspects: settings.preserveAspects,
    allowCreativeStyle: settings.allowCreativeStyle,
    benefitsTags: settings.benefitsTags,
    benefitsExtra: settings.benefitsExtra,
    mustShow: settings.mustShow,
    audience: settings.audience,
    priceSegment: settings.priceSegment,
    salesStyle: settings.salesStyle,
    textDensity: settings.textDensity,
  };
  const { slides } = buildCardBuilderGalleryPlan(planInput);

  await persistCardBuilderDraft(projectId, (prev) => ({
    ...prev,
    settings: { ...settings },
    galleryPlan: slides,
    future: prev.future ?? {
      qualityScore: null,
      marketplaceCompliance: null,
      improvementSuggestions: null,
    },
  }));

  return { ok: true, slides };
}

export async function estimateCardBuilderOperation(
  userId: string,
  projectId: string,
  body: {
    operation: "plan" | "slide" | "gallery_6" | "gallery_8";
    salesStyle: string;
    textDensity: CardBuilderRecommendedTextMode;
  },
): Promise<
  Res<{
    credits: number;
    priceHint?: Record<string, unknown>;
    appliedMultipliers?: Array<{ key: string; value: number }>;
  }>
> {
  void userId;
  void projectId;

  const gated = await gateCardBuilder();
  if (!gated.ok) return gated;

  if (body.operation === "plan") {
    const c = await estimateCardBuilderPlanCreditsCost();
    return { ok: true, credits: c, priceHint: { kind: "card_builder_plan" } };
  }
  if (body.operation === "slide") {
    const e = await estimateCardBuilderSingleSlideCredits({
      salesStyle: body.salesStyle,
      textDensity: body.textDensity,
    });
    return {
      ok: true,
      credits: e.credits,
      priceHint: e.breakdown,
      appliedMultipliers: e.appliedMultipliers,
    };
  }
  const slideCount = body.operation === "gallery_8" ? 8 : 6;
  const e = await estimateCardBuilderGalleryCredits({
    slideCount,
    salesStyle: body.salesStyle,
    textDensity: body.textDensity,
  });
  return {
    ok: true,
    credits: e.credits,
    priceHint: e.breakdown,
    appliedMultipliers: e.appliedMultipliers,
  };
}

async function loadPlanFromProject(
  projectId: string,
): Promise<{ settings: CardBuilderWizardSettings; slides: CardBuilderSlidePlan[] } | null> {
  const p = await prisma.productCardProject.findUnique({
    where: { id: projectId },
    select: { metadata: true },
  });
  const meta = (p?.metadata as Record<string, unknown> | null) ?? {};
  const raw = meta.cardBuilder;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const b = raw as {
    settings?: CardBuilderWizardSettings;
    galleryPlan?: unknown;
  };
  if (!b.settings || !Array.isArray(b.galleryPlan) || b.galleryPlan.length === 0) {
    return null;
  }
  const slides = b.galleryPlan.filter(
    (x): x is CardBuilderSlidePlan =>
      Boolean(x) && typeof x === "object" && typeof (x as CardBuilderSlidePlan).slideId === "string",
  );
  if (slides.length === 0) return null;
  return { settings: b.settings, slides };
}

async function buildPromptForSlide(
  slide: CardBuilderSlidePlan,
  ctx: { categoryId: ProductCategoryId; settings: CardBuilderWizardSettings },
): Promise<{ prompt: string; role: CardBuilderImageRole }> {
  const categoryLabel = getProductCategoryById(ctx.categoryId)?.label ?? ctx.categoryId;
  const preserveHints = ctx.settings.preserveAspects.filter((id) =>
    (CARD_BUILDER_PRESERVE_ASPECTS as readonly string[]).includes(id),
  );

  const benefitsSummary = [
    tagLabels(ctx.settings.benefitsTags, CARD_BUILDER_BENEFIT_TAGS),
    ctx.settings.benefitsExtra?.trim(),
  ]
    .filter(Boolean)
    .join(". ");

  const audienceLabel = ctx.settings.audience
    ? CARD_BUILDER_AUDIENCES.find((x) => x.id === ctx.settings.audience)?.label ?? ctx.settings.audience
    : null;
  const priceSegmentLabel = ctx.settings.priceSegment
    ? CARD_BUILDER_PRICE_SEGMENTS.find((x) => x.id === ctx.settings.priceSegment)?.label ??
      ctx.settings.priceSegment
    : null;
  const salesStyleLabel =
    CARD_BUILDER_SALES_STYLES.find((x) => x.id === ctx.settings.salesStyle)?.label ??
    ctx.settings.salesStyle.replace(/_/g, " ");

  const role = slide.imageRole;
  if (role === "gallery_6" || role === "gallery_8") {
    throw new Error("Некорректное состояние плана галереи");
  }

  const prompt = buildCardBuilderSlidePrompt({
    marketplaceLabel: marketplaceLabel(ctx.settings.marketplace),
    categoryLabel,
    imageRole: role,
    slideTitle: slide.title,
    purpose: slide.purpose,
    promptIntent: slide.promptIntent,
    recommendedTextMode: slide.recommendedTextMode,
    preserveProductStrict: ctx.settings.preserveProduct && !ctx.settings.allowCreativeStyle,
    preserveHints,
    allowCreativeStyle: ctx.settings.allowCreativeStyle,
    benefitsSummary,
    mustShowSummary: tagLabels(ctx.settings.mustShow, CARD_BUILDER_MUST_SHOW),
    audienceLabel,
    priceSegmentLabel,
    salesStyleLabel,
    futureHints: "quality_score, compliance, improvements — reserved.",
  });

  return { prompt, role };
}

export async function generateCardBuilderSingleSlide(params: {
  userId: string;
  projectId: string;
  slideId: string;
  clientEstimateCredits?: number | null;
}): Promise<Res<{ generationId: string; status: string; costCredits: number }>> {
  const gated = await gateCardBuilder();
  if (!gated.ok) return gated;

  const pack = await resolveSourcesAndProject(params.userId, params.projectId);
  if (!pack.ok) return pack;

  const cat = categoryOrErr(pack.project);
  if (!cat.ok) return cat;

  const bundle = await loadPlanFromProject(params.projectId);
  if (!bundle) {
    return { ok: false, error: "Сначала сгенерируйте структуру карточки", status: 400 };
  }
  const slide = bundle.slides.find((s) => s.slideId === params.slideId);
  if (!slide) {
    return { ok: false, error: "Слайд не найден в структуре", status: 400 };
  }

  const resolved = await resolveCardBuilderImageModel();
  if (!resolved) {
    return { ok: false, error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE, status: 400 };
  }

  const { model, usedFallbackMarketplaceCard } = resolved;

  const est = await estimateCardBuilderSingleSlideCredits({
    salesStyle: bundle.settings.salesStyle,
    textDensity: bundle.settings.textDensity,
  });
  const credits = est.credits;
  if (
    params.clientEstimateCredits != null &&
    Number.isFinite(params.clientEstimateCredits) &&
    params.clientEstimateCredits !== credits
  ) {
    return {
      ok: false,
      error: "Стоимость изменилась — обновите оценку и попробуйте снова",
      status: 409,
      code: "PRICE_CHANGED",
    };
  }

  const { prompt, role } = await buildPromptForSlide(slide, {
    categoryId: cat.categoryId,
    settings: bundle.settings,
  });

  const priceBd = await buildCardBuilderPriceBreakdown(model, credits, {
    scenarioKey: "card_builder",
    slideRole: role,
    slideId: slide.slideId,
    usedFallbackMarketplaceCard,
    appliedMultipliers: est.appliedMultipliers,
    finalCreditsField: credits,
  });

  const productMeta: ProductCardGenMeta = {
    flow: "product_card",
    productCard: {
      projectId: params.projectId,
      tab: "card_builder",
      category: cat.categoryId,
    },
  };

  const metaRoot = {
    cardBuilder: {
      slideId: slide.slideId,
      imageRole: role,
      usedFallbackMarketplaceCard,
      future: {
        qualityScore: null,
        marketplaceCompliance: null,
        improvementSuggestions: null,
      },
    },
  };

  const res = await queueProductCardImage(
    params.userId,
    model,
    prompt,
    pack.primaryUrl,
    productMeta,
    null,
    metaRoot,
    null,
    priceBd,
  );

  if (!res.ok) {
    return { ok: false, error: res.error, status: res.status };
  }

  await recordCardBuilderSlideJob(params.projectId, slide.slideId, {
    slideId: slide.slideId,
    generationId: res.generationId,
    status: res.status,
    errorMessage: null,
  });
  await appendCardBuilderGenerationRecord(params.projectId, {
    generationId: res.generationId,
    slideId: slide.slideId,
    imageRole: role,
    mode: "single",
  });

  return {
    ok: true,
    generationId: res.generationId!,
    status: res.status,
    costCredits: res.costCredits ?? credits,
  };
}

export async function generateCardBuilderFullGallery(params: {
  userId: string;
  projectId: string;
  clientEstimateCredits?: number | null;
}): Promise<Res<{ generationIds: string[]; costCredits: number }>> {
  const gated = await gateCardBuilder();
  if (!gated.ok) return gated;

  const pack = await resolveSourcesAndProject(params.userId, params.projectId);
  if (!pack.ok) return pack;

  const cat = categoryOrErr(pack.project);
  if (!cat.ok) return cat;

  const bundle = await loadPlanFromProject(params.projectId);
  if (!bundle) {
    return { ok: false, error: "Сначала сгенерируйте структуру карточки", status: 400 };
  }
  const { slides, settings } = bundle;
  if (slides.length !== 6 && slides.length !== 8) {
    return {
      ok: false,
      error:
        "Полную галерею можно сгенерировать только когда в структуре ровно 6 или 8 слайдов. Обновите структуру.",
      status: 400,
    };
  }

  const slideCount = slides.length === 8 ? 8 : 6;

  const est = await estimateCardBuilderGalleryCredits({
    slideCount,
    salesStyle: settings.salesStyle,
    textDensity: settings.textDensity,
  });
  const total = est.credits;
  if (
    params.clientEstimateCredits != null &&
    Number.isFinite(params.clientEstimateCredits) &&
    params.clientEstimateCredits !== total
  ) {
    return {
      ok: false,
      error: "Стоимость изменилась — обновите оценку и попробуйте снова",
      status: 409,
      code: "PRICE_CHANGED",
    };
  }

  const balance = await getBalance(params.userId);
  if (balance < total) {
    return { ok: false, error: "Недостаточно кредитов", status: 402 };
  }

  const resolved = await resolveCardBuilderImageModel();
  if (!resolved) {
    return { ok: false, error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE, status: 400 };
  }
  const { model, usedFallbackMarketplaceCard } = resolved;

  const allocations = allocateCreditsAcrossVariants(total, slides.length);
  const generationIds: string[] = [];

  const productMeta: ProductCardGenMeta = {
    flow: "product_card",
    productCard: {
      projectId: params.projectId,
      tab: "card_builder",
      category: cat.categoryId,
    },
  };

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]!;
    const sliceCredits = allocations[i] ?? 0;
    const { prompt, role } = await buildPromptForSlide(slide, {
      categoryId: cat.categoryId,
      settings,
    });

    const priceBd = await buildCardBuilderPriceBreakdown(model, sliceCredits, {
      scenarioKey: "card_builder",
      slideRole: role,
      slideId: slide.slideId,
      gallerySlides: slides.length,
      usedFallbackMarketplaceCard,
      appliedMultipliers: est.appliedMultipliers,
      finalCreditsField: sliceCredits,
    });

    const metaRoot = {
      cardBuilder: {
        slideId: slide.slideId,
        imageRole: role,
        galleryIndex: i + 1,
        galleryTotal: slides.length,
        usedFallbackMarketplaceCard,
        future: {
          qualityScore: null,
          marketplaceCompliance: null,
          improvementSuggestions: null,
        },
      },
    };

    const res = await queueProductCardImage(
      params.userId,
      model,
      prompt,
      pack.primaryUrl,
      productMeta,
      null,
      metaRoot,
      null,
      priceBd,
    );

    if (!res.ok) {
      return { ok: false, error: res.error, status: res.status };
    }
    if (!res.generationId) {
      return { ok: false, error: "Не удалось поставить слайд в очередь", status: 500 };
    }

    generationIds.push(res.generationId);
    await recordCardBuilderSlideJob(params.projectId, slide.slideId, {
      slideId: slide.slideId,
      generationId: res.generationId,
      status: res.status,
      errorMessage: null,
    });
    await appendCardBuilderGenerationRecord(params.projectId, {
      generationId: res.generationId,
      slideId: slide.slideId,
      imageRole: role,
      mode: "gallery_bundle",
    });
  }

  return { ok: true, generationIds, costCredits: total };
}
