import { getCardBuilderTemplate } from "@/config/card-builder-templates";
import { cardBuilderPlanFieldsSchema } from "@/lib/validations/card-builder-plan";

import { assertUserOwnsFileUrl, getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";
import { buildCardBuilderSuperPrompt } from "@/server/services/cardBuilderPromptBuilder";
import {
  enrichCardBuilderGallerySlides,
  enrichSingleSlideAfterTemplateChange,
} from "@/server/services/cardBuilderTextSlots";
import {
  buildCardBuilderGalleryPlan,
  type CardBuilderGallerySlide,
  type CardBuilderPlanInput,
} from "@/server/services/productCardBuilderPlan";
import {
  appendCardBuilderGeneration,
  mergeCardBuilderBlock,
  readCardBuilderBlock,
  saveCardBuilderSettingsAndPlan,
  type CardBuilderStoredSettings,
} from "@/server/services/productCardCardBuilderMeta";
import {
  allocateCreditsAcrossVariants,
  assertProductCardPriceAllowed,
  buildCardBuilderPriceBreakdown,
  estimateCardBuilderCharge,
  type ProductCardPriceBreakdown,
} from "@/server/services/productCardPricing";
import { resolveCardBuilderImageModel } from "@/server/services/productCardModelResolver";
import {
  queueProductCardImage,
  type ProductCardGenMeta,
} from "@/server/services/productCardQueueGenerations";
import { isValidProductCategoryId } from "@/server/services/productCardGeneration";
import {
  getProductCardSettings,
  PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
} from "@/server/services/productCardSettings";

export type ServiceErr = { ok: false; error: string; status: number; code?: string };
export type PlanOk = { ok: true; slides: CardBuilderGallerySlide[] };
export type GenOk = {
  ok: true;
  generationId: string;
  status: string;
  costCredits: number;
};

export async function assertCardBuilderScenarioEnabled(): Promise<
  | { ok: true; settings: Awaited<ReturnType<typeof getProductCardSettings>> }
  | ServiceErr
> {
  const settings = await getProductCardSettings();
  if (!settings.scenarios.cardBuilder.enabled) {
    return {
      ok: false,
      error: "Сценарий недоступен",
      status: 403,
      code: "CARD_BUILDER_DISABLED",
    };
  }
  return { ok: true, settings };
}

export function parseStoredCardBuilderPlan(
  raw: CardBuilderStoredSettings,
): { ok: true; plan: CardBuilderPlanInput } | ServiceErr {
  const { updatedAt: _u, ...rest } = raw;
  void _u;
  const parsed = cardBuilderPlanFieldsSchema.safeParse(rest);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Параметры структуры устарели — сгенерируйте структуру заново",
      status: 400,
    };
  }
  return { ok: true, plan: parsed.data };
}

function ensureSlidePlanEnrichment(
  slide: CardBuilderGallerySlide,
  planInput: CardBuilderPlanInput,
  productTitle: string | null | undefined,
): CardBuilderGallerySlide {
  return enrichCardBuilderGallerySlides([slide], planInput, productTitle)[0]!;
}

async function assertProjectBasics(
  userId: string,
  projectId: string,
): Promise<
  | {
      ok: true;
      project: NonNullable<Awaited<ReturnType<typeof getOwnedProjectOrNull>>>;
      sourceImageUrls: string[];
    }
  | ServiceErr
> {
  const gate = await assertCardBuilderScenarioEnabled();
  if (!gate.ok) return gate;

  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) return { ok: false, error: "Проект не найден", status: 404 };
  const sel = project.selectedCategory?.trim();
  if (!sel || !isValidProductCategoryId(sel)) {
    return { ok: false, error: "Выберите и подтвердите категорию товара", status: 400 };
  }

  const sourceImages = normalizeProductSourceImages(project);
  const sourceUrl = sourceImages[0]?.url ?? project.sourceImageUrl?.trim();
  if (!sourceUrl) {
    return { ok: false, error: "Загрузите исходное фото", status: 400 };
  }
  if (!(await assertUserOwnsFileUrl(userId, sourceUrl))) {
    return { ok: false, error: "Нет доступа к файлу", status: 403 };
  }
  for (const img of sourceImages.slice(1)) {
    if (!(await assertUserOwnsFileUrl(userId, img.url))) {
      return { ok: false, error: "Нет доступа к одному из фото", status: 403 };
    }
  }
  const urls = sourceImages.length > 0 ? sourceImages.map((i) => i.url) : [sourceUrl];

  return { ok: true, project, sourceImageUrls: urls };
}

export async function planCardBuilderGallery(
  userId: string,
  projectId: string,
  input: CardBuilderPlanInput,
): Promise<PlanOk | ServiceErr> {
  const base = await assertProjectBasics(userId, projectId);
  if (!base.ok) return base;

  const { slides } = buildCardBuilderGalleryPlan(input);
  const enriched = enrichCardBuilderGallerySlides(slides, input, base.project.title ?? undefined);
  await saveCardBuilderSettingsAndPlan(projectId, { ...input }, enriched);
  return { ok: true, slides: enriched };
}

export async function updateCardBuilderSlideTemplate(
  userId: string,
  projectId: string,
  slideId: string,
  templateId: string,
): Promise<
  | { ok: true; slide: CardBuilderGallerySlide; galleryPlan: CardBuilderGallerySlide[] }
  | ServiceErr
> {
  const base = await assertProjectBasics(userId, projectId);
  if (!base.ok) return base;

  const blk = await readCardBuilderBlock(projectId);
  if (!blk?.galleryPlan?.length || !blk.settings) {
    return { ok: false, error: "Сначала сгенерируйте структуру карточки", status: 400 };
  }

  const planParsed = parseStoredCardBuilderPlan(blk.settings);
  if (!planParsed.ok) return planParsed;

  const idx = blk.galleryPlan.findIndex((s) => s.slideId === slideId);
  if (idx < 0) {
    return { ok: false, error: "Слайд не найден в плане", status: 404 };
  }

  const slide = blk.galleryPlan[idx]!;
  const tpl = getCardBuilderTemplate(templateId);
  if (!tpl || tpl.slideRole !== slide.imageRole) {
    return {
      ok: false,
      error: "Этот шаблон недоступен для данного типа слайда",
      status: 400,
      code: "TEMPLATE_ROLE_MISMATCH",
    };
  }

  const merged = enrichSingleSlideAfterTemplateChange(
    { ...slide, templateId },
    planParsed.plan,
    base.project.title ?? undefined,
  );
  const galleryPlan = [...blk.galleryPlan];
  galleryPlan[idx] = merged;
  await mergeCardBuilderBlock(projectId, { galleryPlan });
  return { ok: true, slide: merged, galleryPlan };
}

export async function generateCardBuilderSlide(
  userId: string,
  projectId: string,
  body: {
    slideId: string;
    clientEstimateCredits?: number | null;
    useSavedPlan?: boolean;
    planInput?: CardBuilderPlanInput;
    slide?: CardBuilderGallerySlide;
    /** Пакет галереи: заранее рассчитанное списание за этот слайд */
    forcedBreakdown?: ProductCardPriceBreakdown | null;
    gallerySlideCount?: number | null;
  },
): Promise<GenOk | ServiceErr> {
  const base = await assertProjectBasics(userId, projectId);
  if (!base.ok) return base;

  const resolved = await resolveCardBuilderImageModel();
  if (!resolved) {
    return { ok: false, error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE, status: 400 };
  }
  const { model, fallbackFromMarketplaceCard } = resolved;
  const settings = await getProductCardSettings();

  let slide: CardBuilderGallerySlide | undefined = body.slide;
  let planInput: CardBuilderPlanInput | undefined = body.planInput;

  if (!slide || body.useSavedPlan) {
    const blk = await readCardBuilderBlock(projectId);
    slide = blk?.galleryPlan?.find((s) => s.slideId === body.slideId);
    if (blk?.settings && !planInput) {
      const { updatedAt: _u, ...rest } = blk.settings;
      void _u;
      planInput = rest;
    }
  }

  if (!slide || !planInput) {
    return {
      ok: false,
      error: "Сначала сгенерируйте структуру карточки",
      status: 400,
    };
  }

  const normalizedPlan = parseStoredCardBuilderPlan(planInput as CardBuilderStoredSettings);
  if (!normalizedPlan.ok) return normalizedPlan;
  planInput = normalizedPlan.plan;

  slide = ensureSlidePlanEnrichment(slide, planInput, base.project.title ?? undefined);

  const superPrompt = buildCardBuilderSuperPrompt({
    productTitle: base.project.title ?? undefined,
    subtitle: planInput.subtitle,
    selectedCategory: planInput.selectedCategory,
    marketplace: planInput.marketplace,
    slideRole: slide.imageRole,
    templateId: slide.templateId,
    layoutPreset: slide.layoutPreset,
    goal: planInput.goal,
    benefits: planInput.benefits ?? [],
    additionalBenefits: planInput.benefitsExtra,
    mustShow: planInput.mustShow ?? [],
    audience: planInput.audience,
    priceSegment: planInput.priceSegment,
    salesStyle: planInput.salesStyle,
    textDensity: planInput.textDensity,
    preserveProduct: planInput.preserveProduct,
    preserveProductOptions: planInput.preserveAspects ?? [],
    sourceImageMode: slide.sourceImageMode,
    languageMode:
      (planInput.languageMode === "ru" ||
        planInput.languageMode === "kk" ||
        planInput.languageMode === "mixed" ||
        planInput.languageMode === "auto") &&
      planInput.languageMode
        ? planInput.languageMode
        : "auto",
    dimensions: planInput.dimensions,
  });

  if (!superPrompt.ok) {
    return {
      ok: false,
      error: superPrompt.validationErrors.join("\n"),
      status: 400,
      code: "CARD_BUILDER_PROMPT_VALIDATION",
    };
  }

  const finalPrompt = superPrompt.data.prompt;

  const breakdown: ProductCardPriceBreakdown =
    body.forcedBreakdown ??
    (await estimateCardBuilderCharge(
      "slide",
      model,
      settings.cardBuilderPricing,
      planInput.salesStyle,
      planInput.textDensity,
      slide.imageRole,
      body.gallerySlideCount ?? null,
    ));
  try {
    assertProductCardPriceAllowed(breakdown);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка цены",
      status: 400,
    };
  }

  if (
    body.clientEstimateCredits != null &&
    Number.isFinite(body.clientEstimateCredits) &&
    body.clientEstimateCredits !== breakdown.credits
  ) {
    return {
      ok: false,
      error: "Стоимость изменилась — обновите оценку и попробуйте снова",
      status: 409,
      code: "PRICE_CHANGED",
    };
  }

  const productCard: ProductCardGenMeta["productCard"] = {
    projectId: base.project.id,
    tab: "card_builder",
    category: planInput.selectedCategory,
    sourceType: "original",
  };

  const gc = body.gallerySlideCount ?? null;

  const cardBuilderPromptSnapshot = {
    promptVersion: superPrompt.data.promptVersion,
    textLockLevel: superPrompt.data.textLockLevel,
    textRenderMode: superPrompt.data.textRenderMode,
    exactTextRequested: superPrompt.data.exactTextRequested,
    exactTextPhrases: superPrompt.data.exactTextPhrases,
    designFlexible: superPrompt.data.designFlexible,
    overlayApplied: superPrompt.data.overlayApplied,
  };

  const metadataRoot: Record<string, unknown> = {
    flow: "product_card",
    scenarioKey: "card_builder",
    projectId: base.project.id,
    tab: "card_builder",
    cardBuilderSlideId: slide.slideId,
    cardBuilderSlideRole: slide.imageRole,
    selectedCategory: planInput.selectedCategory,
    marketplace: planInput.marketplace,
    preserveProduct: planInput.preserveProduct,
    fallbackFromMarketplaceCard,
    modelSlug: model.slug,
    pricingScope: "PRODUCT_CARD",
    productCardModelType: model.productCardModelType,
    gallerySlideTitle: slide.title,
    gallerySlideCount: gc,
    priceHint: {
      flow: "product_card",
      scenarioKey: "card_builder",
      slideRole: slide.imageRole,
      finalCredits: breakdown.credits,
    },
    cardBuilderTemplateId: slide.templateId,
    cardBuilderLayoutPreset: slide.layoutPreset,
    cardBuilderOverlayRequired: false,
    cardBuilderPrompt: cardBuilderPromptSnapshot,
    promptVersion: superPrompt.data.promptVersion,
    textLockLevel: superPrompt.data.textLockLevel,
    textRenderMode: superPrompt.data.textRenderMode,
    exactTextRequested: superPrompt.data.exactTextRequested,
    exactTextPhrases: superPrompt.data.exactTextPhrases,
    designFlexible: superPrompt.data.designFlexible,
    overlayApplied: superPrompt.data.overlayApplied,
  };

  const result = await queueProductCardImage(
    userId,
    model,
    finalPrompt,
    base.sourceImageUrls,
    { flow: "product_card", productCard },
    null,
    metadataRoot,
    null,
    breakdown,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      status: result.status,
    };
  }

  const costCredits = result.costCredits ?? 0;

  await appendCardBuilderGeneration(projectId, {
    generationId: result.generationId,
    slideId: slide.slideId,
    imageRole: slide.imageRole,
    templateId: slide.templateId,
    layoutPreset: slide.layoutPreset,
    status: "queued",
  });

  return {
    ok: true,
    generationId: result.generationId,
    status: result.status,
    costCredits,
  };
}

function galleryBundleKind(
  plan: CardBuilderPlanInput,
  slideCount: number,
): "gallery6" | "gallery8" | null {
  if (plan.goal === "full_gallery_6" && slideCount === 6) return "gallery6";
  if (plan.goal === "full_gallery_8" && slideCount === 8) return "gallery8";
  return null;
}

/** Все слайды текущего плана: для полной галереи — пакет 6/8, иначе сумма одиночных. */
export async function generateCardBuilderAllSlides(
  userId: string,
  projectId: string,
  clientEstimateCredits: number | null,
): Promise<
  | ServiceErr
  | { ok: true; totalCredits: number; results: ({ slideId: string } & (GenOk | { error: string }))[] }
> {
  const base = await assertProjectBasics(userId, projectId);
  if (!base.ok) return base;

  const blk = await readCardBuilderBlock(projectId);
  if (!blk?.galleryPlan?.length || !blk.settings) {
    return { ok: false, error: "Сначала сгенерируйте структуру карточки", status: 400 };
  }

  const planParsed = parseStoredCardBuilderPlan(blk.settings);
  if (!planParsed.ok) return planParsed;
  const planInput = planParsed.plan;

  const slides = blk.galleryPlan;
  const resolved = await resolveCardBuilderImageModel();
  if (!resolved) {
    return { ok: false, error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE, status: 400 };
  }
  const { model } = resolved;
  const settings = await getProductCardSettings();

  const bundle = galleryBundleKind(planInput, slides.length);

  let totalCredits: number;
  let allocations: number[];

  if (bundle) {
    const totalBr = await estimateCardBuilderCharge(
      bundle,
      model,
      settings.cardBuilderPricing,
      planInput.salesStyle,
      planInput.textDensity,
      "gallery_bundle",
      slides.length,
    );
    totalCredits = totalBr.credits;
    allocations = allocateCreditsAcrossVariants(totalCredits, slides.length);
  } else {
    allocations = [];
    let sum = 0;
    for (const s of slides) {
      const br = await estimateCardBuilderCharge(
        "slide",
        model,
        settings.cardBuilderPricing,
        planInput.salesStyle,
        planInput.textDensity,
        s.imageRole,
        null,
      );
      allocations.push(br.credits);
      sum += br.credits;
    }
    totalCredits = sum;
  }

  if (
    clientEstimateCredits != null &&
    Number.isFinite(clientEstimateCredits) &&
    clientEstimateCredits !== totalCredits
  ) {
    return {
      ok: false,
      error: "Стоимость изменилась — обновите оценку и попробуйте снова",
      status: 409,
      code: "PRICE_CHANGED",
    };
  }

  const results: ({ slideId: string } & (GenOk | { error: string }))[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]!;
    const alloc = allocations[i];
    if (alloc == null) {
      results.push({ slideId: slide.slideId, error: "Внутренняя ошибка распределения цены" });
      continue;
    }
    const fb = await buildCardBuilderPriceBreakdown({
      model,
      finalCredits: alloc,
      slideRole: slide.imageRole,
      gallerySlideCount: slides.length > 1 ? slides.length : null,
    });

    try {
      assertProductCardPriceAllowed(fb);
    } catch (e) {
      results.push({
        slideId: slide.slideId,
        error: e instanceof Error ? e.message : "Цена недоступна",
      });
      continue;
    }

    const one = await generateCardBuilderSlide(userId, projectId, {
      slideId: slide.slideId,
      slide,
      planInput,
      forcedBreakdown: fb,
      gallerySlideCount: slides.length > 1 ? slides.length : null,
      clientEstimateCredits: alloc,
      useSavedPlan: false,
    });

    if (!one.ok) {
      results.push({ slideId: slide.slideId, error: one.error });
    } else {
      results.push({
        slideId: slide.slideId,
        ok: true,
        generationId: one.generationId,
        status: one.status,
        costCredits: one.costCredits,
      });
    }
  }

  return { ok: true, totalCredits, results };
}
