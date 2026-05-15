import { getAllowedTemplatesForSlide } from "@/config/card-builder-template-allowlist";
import { getCardBuilderTemplate } from "@/config/card-builder-templates";
import { cardBuilderPlanFieldsSchema, coerceCardBuilderPlan } from "@/lib/validations/card-builder-plan";
import {
  categoryFieldsPlainForPlanner,
  effectiveDimensionsForOverlay,
  hasMeasuresFromCategoryPlan,
  normalizeCategoryFieldsOnPlanInput,
  validateNormalizedCategoryPlanFields,
} from "@/lib/card-builder-category-fields-runtime";
import { sanitizeStyleReferenceOnStoredPlan } from "@/lib/card-builder-style-reference";

import { resolveCardBuilderStyleReferenceUrls } from "@/server/services/cardBuilderStyleReferenceFiles";
import { assertUserOwnsFileUrl, getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";
import {
  buildCardBuilderSuperPrompt,
  joinUserDerivedTextForCardBuilderModeration,
} from "@/server/services/cardBuilderPromptBuilder";
import {
  enrichCardBuilderGallerySlides,
  enrichSingleSlideAfterTemplateChange,
} from "@/server/services/cardBuilderTextSlots";
import {
  buildCardBuilderGalleryPlan,
  cardBuilderProfileSlideErrorMessage,
  marketplaceGoalDisallowedReason,
  type CardBuilderGallerySlide,
  type CardBuilderPlanInput,
} from "@/server/services/productCardBuilderPlan";
import {
  buildAppliedMarketplaceRulesSnapshot,
  buildCardBuilderGenerationMarketplaceRules,
  marketplaceBenefitsOverLimitMessage,
  PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION,
  resolveProductCardMarketplaceProfile,
} from "@/server/services/productCardMarketplaceProfiles";
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
import {
  computeCardBuilderPlanFingerprint,
  cardBuilderLivePlanFingerprintInputs,
} from "@/server/services/cardBuilderPlanFingerprint";
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
export type PlanOk = { ok: true; slides: CardBuilderGallerySlide[]; planWarning?: string };
export type GenOk = {
  ok: true;
  generationId: string;
  status: string;
  costCredits: number;
  /** Пользовательская подсказка (не ошибка): обрезание списка акцентов под лимит площадки */
  marketplaceNotice?: string;
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
  return {
    ok: true,
    plan: sanitizeStyleReferenceOnStoredPlan(
      normalizeCategoryFieldsOnPlanInput(coerceCardBuilderPlan(parsed.data)),
    ),
  };
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

  const mpRes = await resolveProductCardMarketplaceProfile(input.marketplace);
  if (!mpRes.ok) return mpRes;

  const normalizedInput = sanitizeStyleReferenceOnStoredPlan(
    normalizeCategoryFieldsOnPlanInput(
      coerceCardBuilderPlan(cardBuilderPlanFieldsSchema.parse(input)),
    ),
  );

  const catFieldProblems = validateNormalizedCategoryPlanFields(normalizedInput);
  if (catFieldProblems.length > 0) {
    return { ok: false, error: catFieldProblems.join("\n"), status: 400 };
  }

  const benefitErr = marketplaceBenefitsOverLimitMessage(normalizedInput.benefits, mpRes.profile);
  if (benefitErr) {
    return {
      ok: false,
      error: benefitErr,
      status: 400,
      code: "CARD_BUILDER_TOO_MANY_BENEFITS",
    };
  }

  const goalFail = marketplaceGoalDisallowedReason(mpRes.profile, normalizedInput.goal);
  if (goalFail) {
    return { ok: false, error: goalFail, status: 400, code: "MARKETPLACE_GOAL_NOT_ALLOWED" };
  }

  const { slides, planWarning } = buildCardBuilderGalleryPlan(normalizedInput, mpRes.profile);
  const enriched = enrichCardBuilderGallerySlides(
    slides,
    normalizedInput,
    base.project.title ?? undefined,
  );
  const snapshot = buildAppliedMarketplaceRulesSnapshot(mpRes.profile);
  const settingsOut: CardBuilderStoredSettings = {
    ...normalizedInput,
    marketplaceProfileId: mpRes.profile.id,
    marketplaceProfileVersion: PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION,
    appliedMarketplaceRules: snapshot,
    cardBuilderTargetAspectRatio: mpRes.profile.defaultAspectRatio,
    cardBuilderTargetSize: mpRes.profile.defaultSize,
  };
  await saveCardBuilderSettingsAndPlan(projectId, settingsOut, enriched);
  return { ok: true, slides: enriched, ...(planWarning ? { planWarning } : {}) };
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

  const mpRes = await resolveProductCardMarketplaceProfile(planParsed.plan.marketplace);
  if (!mpRes.ok) return mpRes;
  const slideErr = cardBuilderProfileSlideErrorMessage(mpRes.profile, slide.imageRole);
  if (slideErr) {
    return { ok: false, error: slideErr, status: 400, code: "MARKETPLACE_SLIDE_NOT_ALLOWED" };
  }

  const allowed = getAllowedTemplatesForSlide({
    categoryKey: planParsed.plan.selectedCategory,
    marketplaceProfile: mpRes.profile,
    imageRole: slide.imageRole,
    currentTemplateId: slide.templateId,
    hasConcreteDimensions: hasMeasuresFromCategoryPlan(planParsed.plan),
    mustShowScale: planParsed.plan.mustShow.includes("scale"),
  });
  if (!allowed.some((t) => t.templateId === templateId)) {
    return {
      ok: false,
      error: "Этот шаблон недоступен для выбранной категории и площадки",
      status: 400,
      code: "TEMPLATE_NOT_ALLOWED",
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
    /** SHA-256 отпечаток плана; обязателен при сохранённой галерее до reserveCredits */
    clientPlanHash?: string | null;
    planInput?: CardBuilderPlanInput;
    slide?: CardBuilderGallerySlide;
    /** Пакет галереи: заранее рассчитанное списание за этот слайд */
    forcedBreakdown?: ProductCardPriceBreakdown | null;
    gallerySlideCount?: number | null;
  },
): Promise<GenOk | ServiceErr> {
  const base = await assertProjectBasics(userId, projectId);
  if (!base.ok) return base;

  const blk = await readCardBuilderBlock(projectId);
  let slide: CardBuilderGallerySlide | undefined = body.slide;
  let planInput: CardBuilderPlanInput | undefined = body.planInput;
  const useSaved = body.useSavedPlan !== false;

  if (!slide || useSaved) {
    slide = blk?.galleryPlan?.find((s) => s.slideId === body.slideId);
    if (blk?.settings && !planInput) {
      const { updatedAt: _u, ...rest } = blk.settings;
      void _u;
      planInput = rest as CardBuilderPlanInput;
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

  const mpRes = await resolveProductCardMarketplaceProfile(planInput.marketplace);
  if (!mpRes.ok) return mpRes;
  const profile = mpRes.profile;
  const slideRoleErr = cardBuilderProfileSlideErrorMessage(profile, slide.imageRole);
  if (slideRoleErr) {
    return {
      ok: false,
      error: slideRoleErr,
      status: 400,
      code: "MARKETPLACE_SLIDE_NOT_ALLOWED",
    };
  }

  const benefitErr = marketplaceBenefitsOverLimitMessage(planInput.benefits, profile);
  if (benefitErr) {
    return {
      ok: false,
      error: benefitErr,
      status: 400,
      code: "CARD_BUILDER_TOO_MANY_BENEFITS",
    };
  }

  const galleryPlan = blk?.galleryPlan;
  if (useSaved && galleryPlan?.length) {
    if (!body.clientPlanHash?.trim()) {
      return {
        ok: false,
        error: "Обновите оценку («Оценить») и попробуйте снова",
        status: 409,
        code: "PLAN_CHANGED",
      };
    }
    const expectedFp = computeCardBuilderPlanFingerprint(
      cardBuilderLivePlanFingerprintInputs(planInput, profile.id),
      galleryPlan,
    );
    if (body.clientPlanHash !== expectedFp) {
      return {
        ok: false,
        error: "Структура галереи на сервере изменилась — нажмите «Оценить» ещё раз",
        status: 409,
        code: "PLAN_CHANGED",
      };
    }
  }

  const resolved = await resolveCardBuilderImageModel();
  if (!resolved) {
    return { ok: false, error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE, status: 400 };
  }
  const { model, fallbackFromMarketplaceCard } = resolved;
  const settings = await getProductCardSettings();

  const textDensityEffective =
    slide.imageRole === "main_photo" && !profile.mainPhotoTextAllowed
      ? "none"
      : planInput.textDensity;

  const catFieldProblemsRun = validateNormalizedCategoryPlanFields(planInput);
  if (catFieldProblemsRun.length > 0) {
    return {
      ok: false,
      error: catFieldProblemsRun.join("\n"),
      status: 400,
      code: "CARD_BUILDER_CATEGORY_FIELDS",
    };
  }

  const srForGen = planInput.styleReference;
  const resolvedStyleUrls =
    srForGen?.enabled && srForGen.referenceAssetIds.length > 0
      ? await resolveCardBuilderStyleReferenceUrls(userId, srForGen.referenceAssetIds)
      : [];
  const styleRefForPrompt = resolvedStyleUrls.length > 0 ? planInput.styleReference : undefined;

  const superPrompt = buildCardBuilderSuperPrompt({
    productTitle: base.project.title ?? undefined,
    subtitle: planInput.subtitle,
    selectedCategory: planInput.selectedCategory,
    marketplace: planInput.marketplace,
    marketplaceProfile: profile,
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
    textDensity: textDensityEffective,
    preserveProduct: planInput.preserveProduct,
    preserveAspects: planInput.preserveAspects ?? [],
    allowCreativeStylization: planInput.allowCreativeStylization,
    sourceImageMode: slide.sourceImageMode,
    languageMode:
      (planInput.languageMode === "ru" ||
        planInput.languageMode === "kk" ||
        planInput.languageMode === "mixed" ||
        planInput.languageMode === "auto") &&
      planInput.languageMode
        ? planInput.languageMode
        : "auto",
    dimensions: effectiveDimensionsForOverlay(planInput) ?? planInput.dimensions,
    categoryFields: planInput.categoryFields,
    categoryFieldsByCategory: planInput.categoryFieldsByCategory,
    styleReferencePlan: styleRefForPrompt ?? undefined,
    productSourceImageCount: base.sourceImageUrls.length,
    styleReferenceImageCount: resolvedStyleUrls.length,
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
      textDensityEffective,
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

  const moderationUserEnvelope = joinUserDerivedTextForCardBuilderModeration({
    productTitle: base.project.title,
    subtitle: planInput.subtitle,
    semanticBenefitIds: planInput.benefits ?? [],
    additionalBenefits: planInput.benefitsExtra,
    mustShowIds: planInput.mustShow ?? [],
    dimensions: planInput.dimensions,
    categoryFactsPlain: categoryFieldsPlainForPlanner(planInput) || undefined,
  });

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
    slideRole: slide.imageRole,
    cardBuilderSlideRole: slide.imageRole,
    marketplaceProfileId: profile.id,
    marketplaceProfileVersion: PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION,
    appliedMarketplaceRules: buildCardBuilderGenerationMarketplaceRules(profile),
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
    styleReferenceUsed: resolvedStyleUrls.length > 0,
    styleReferenceStrength:
      resolvedStyleUrls.length > 0 ? (planInput.styleReference?.strength ?? null) : null,
    styleReferenceCount: resolvedStyleUrls.length,
    /** Сводка настроек мастера для аудита и трассировки (дублирует ключевые поля metadata.cardBuilder.settings в проекте). */
    cardBuilderSettingsSnapshot: {
      preserveProduct: planInput.preserveProduct ?? true,
      preserveAspects: [...(planInput.preserveAspects ?? [])],
      allowCreativeStylization: Boolean(planInput.allowCreativeStylization),
      semanticBenefits: [...(planInput.benefits ?? [])],
      additionalBenefits:
        typeof planInput.benefitsExtra === "string"
          ? planInput.benefitsExtra.trim()
          : (planInput.additionalBenefits ?? ""),
      exactTextPhrases: superPrompt.data.exactTextPhrases,
      mustShow: [...(planInput.mustShow ?? [])],
      audience: planInput.audience,
      priceSegment: planInput.priceSegment,
      salesStyle: planInput.salesStyle,
      textDensity: textDensityEffective,
      languageMode: planInput.languageMode ?? "auto",
      styleReferenceUsed: resolvedStyleUrls.length > 0,
      styleReferenceStrength:
        resolvedStyleUrls.length > 0 ? (planInput.styleReference?.strength ?? "medium") : null,
      styleReferenceCount: resolvedStyleUrls.length,
    },
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
    moderationUserEnvelope || null,
    resolvedStyleUrls.length > 0 ? resolvedStyleUrls : undefined,
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

  const marketplaceNotice = profile.needsVerification
    ? "Перед публикацией проверьте актуальные правила этой площадки — профиль может требовать уточнения."
    : undefined;

  return {
    ok: true,
    generationId: result.generationId,
    status: result.status,
    costCredits,
    ...(marketplaceNotice ? { marketplaceNotice } : {}),
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
  clientPlanHash: string | null,
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

  const mpForGallery = await resolveProductCardMarketplaceProfile(planInput.marketplace);
  if (!mpForGallery.ok) return mpForGallery;
  const galBenefitErr = marketplaceBenefitsOverLimitMessage(planInput.benefits, mpForGallery.profile);
  if (galBenefitErr) {
    return {
      ok: false,
      error: galBenefitErr,
      status: 400,
      code: "CARD_BUILDER_TOO_MANY_BENEFITS",
    };
  }

  const slides = blk.galleryPlan;

  const expectedFp = computeCardBuilderPlanFingerprint(
    cardBuilderLivePlanFingerprintInputs(planInput, mpForGallery.profile.id),
    slides,
  );
  if (!clientPlanHash || clientPlanHash !== expectedFp) {
    return {
      ok: false,
      error: "Структура галереи на сервере изменилась — нажмите «Оценить всю галерею» ещё раз",
      status: 409,
      code: "PLAN_CHANGED",
    };
  }

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
      const dens =
        s.imageRole === "main_photo" && !mpForGallery.profile.mainPhotoTextAllowed
          ? "none"
          : planInput.textDensity;
      const br = await estimateCardBuilderCharge(
        "slide",
        model,
        settings.cardBuilderPricing,
        planInput.salesStyle,
        dens,
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
