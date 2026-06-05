import type { AiModel } from "@/generated/prisma/client";
import { isAdminPricingPinned } from "@/lib/admin-pricing-pinned";
import { isRecord } from "@/lib/model-pricing-shared";
import { prisma } from "@/lib/prisma";
import { getCreditsUiFloor } from "@/server/services/pricing";
import { getAppSetting } from "@/server/services/appSettings";
import { getKaspiManualSettings } from "@/server/services/kaspiManualSettings";
import {
  buildPricingPreview,
  getFinalCreditsFromPricingSchema,
} from "@/server/services/modelPricingCalculator";
import {
  calculateProductCardConceptImageCredits,
  calculateProductCardMarketplaceCardCredits,
  calculateProductCardVideoCredits,
  estimateCardBuilderCharge,
  resolveMarketplaceVariantBundleTotals,
} from "@/server/services/productCardPricing";
import {
  getProductCardSettings,
  type ProductCardSettings,
} from "@/server/services/productCardSettings";
import {
  resolveCardBuilderImageModel,
  resolveDefaultProductConceptImageModel,
  resolveDefaultMarketplaceCardModel,
  resolveDefaultProductVideoModel,
} from "@/server/services/productCardModelResolver";
import {
  cardBuilderPricingSoftWarnings,
  storageToCardBuilderPricingApi,
} from "@/lib/pricing-admin/card-builder";
import { tokenPackagePriceWarnings } from "@/lib/pricing-admin/token-packages";
import { listActiveTokenPackagesForBilling } from "@/server/services/token-packages-catalog";
import { buildGeneralPriceBreakdownV2 } from "@/server/services/unifiedModelPricing";

export type AdminPricingTabId =
  | "overview"
  | "models"
  | "card-builder"
  | "marketplace"
  | "video"
  | "concepts"
  | "topup"
  | "warnings";

export type AdminPricingWarningSeverity = "info" | "warning" | "error";

export type AdminPricingWarning = {
  id: string;
  severity: AdminPricingWarningSeverity;
  title: string;
  detail: string;
  tab?: AdminPricingTabId;
};

export type PricingScenarioId =
  | "ai_image"
  | "ai_video"
  | "card_builder"
  | "marketplace_card"
  | "concept_photo"
  | "product_video"
  | "topup";

export type ScenarioOverviewCard = {
  id: PricingScenarioId;
  label: string;
  status: "active" | "disabled" | "partial" | "missing";
  priceSource: string;
  minCredits: number | null;
  sampleCredits: number | null;
  warningCount: number;
  tab: AdminPricingTabId;
};

export type AdminPricingModelRow = {
  id: string;
  name: string;
  slug: string;
  scope: string;
  type: string;
  productCardModelType: string | null;
  provider: string;
  isActive: boolean;
  pricingSchemaType: string;
  providerCostUsd: number | null;
  minCredits: number;
  sampleCredits: number;
  marginPercent: number | null;
  pinned: boolean;
};

export type GeneralVideoMatrixRow = {
  modelId: string;
  modelName: string;
  modelSlug: string;
  pricingSchemaType: string;
  matrixKeyStrategy: string | null;
  cells: Array<{
    label: string;
    resolution: string;
    duration: number | string;
    credits: number;
  }>;
};

export type ProductVideoPricingSample = {
  duration: number;
  resolution: string;
  credits: number;
};

export type AdminPricingOverviewData = {
  economics: {
    globalTokenValueKzt: number | null;
    productCardTokenValueKzt: number;
    usdToKzt: number;
    productCardUsdToKzt: number;
    defaultMarkupPercent: number | null;
    productCardMarkupPercent: number;
    tokenValuesDiffer: boolean;
  };
  scenarioCards: ScenarioOverviewCard[];
  models: AdminPricingModelRow[];
  productCardSettings: ProductCardSettings;
  cardBuilderModel: {
    id: string;
    name: string;
    slug: string;
    fallbackFromMarketplaceCard: boolean;
  } | null;
  cardBuilderSamples: Array<{ label: string; credits: number; formula: string }>;
  marketplaceModel: { id: string; name: string; slug: string } | null;
  marketplaceSamples: Array<{ variantCount: number; credits: number; formula: string }>;
  conceptModel: { id: string; name: string; slug: string } | null;
  conceptSample: { credits: number; formula: string; minCredits: number } | null;
  productVideoModel: { id: string; name: string; slug: string } | null;
  productVideoSamples: ProductVideoPricingSample[];
  productVideoFlatPrice: boolean;
  generalVideoMatrices: GeneralVideoMatrixRow[];
  generalImageSample: { minCredits: number; maxCredits: number; modelCount: number };
  tokenPackages: Array<{
    id: string;
    name: string;
    slug: string;
    priceKzt: number;
    baseTokens: number;
    bonusTokens: number;
    totalTokens: number;
    pricePerTokenKzt: number;
    isActive: boolean;
    sortOrder: number;
    description: string | null;
  }>;
  tokenPackagePriceWarnings: string[];
  manualTopUp: {
    enabled: boolean;
    recipientName: string;
    kaspiPhoneMasked: string;
    whatsappEnabled: boolean;
    whatsappPhoneDisplay: string;
  };
  warnings: AdminPricingWarning[];
  notAffectingPrice: Array<{ scenario: string; items: string[] }>;
};

const LEGACY_BUILDER_KEYS = [
  "PRODUCT_CARD_BUILDER_PLAN_CREDITS",
  "PRODUCT_CARD_BUILDER_SLIDE_CREDITS",
  "PRODUCT_CARD_BUILDER_GALLERY_6_CREDITS",
  "PRODUCT_CARD_BUILDER_GALLERY_8_CREDITS",
  "PRODUCT_CARD_BUILDER_PRICE_MULTIPLIERS",
] as const;

function schemaType(pricingSchema: unknown): string {
  if (!isRecord(pricingSchema)) return "fallback (costCredits)";
  const t = String(pricingSchema.type ?? "").trim();
  return t || "unknown";
}

function schemaProviderCostUsd(pricingSchema: unknown): number | null {
  if (!isRecord(pricingSchema)) return null;
  const v = pricingSchema.providerCostUsd ?? pricingSchema.providerCost;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function generalSampleCredits(
  model: Pick<AiModel, "costCredits" | "pricingSchema" | "id" | "slug" | "name" | "type" | "apiModelId">,
): { credits: number; marginPercent: number | null } {
  const breakdown = buildGeneralPriceBreakdownV2(model, {});
  return {
    credits: breakdown.tokens,
    marginPercent: breakdown.marginPercent,
  };
}

function extractGeneralVideoMatrix(model: AiModel): GeneralVideoMatrixRow | null {
  if (model.type !== "VIDEO" || model.scope !== "GENERAL" || !model.isActive) return null;
  const raw = model.pricingSchema;
  if (!isRecord(raw)) return null;
  const typ = String(raw.type ?? "");
  const strategy = typeof raw.matrixKeyStrategy === "string" ? raw.matrixKeyStrategy : null;

  const cells: GeneralVideoMatrixRow["cells"] = [];

  if (typ === "matrix" && !strategy) {
    const preview = buildPricingPreview(raw);
    for (const row of preview.rows.slice(0, 24)) {
      cells.push({
        label: row.inputType,
        resolution: row.resolution,
        duration: row.duration,
        credits: row.finalClientTokens,
      });
    }
  } else if (strategy === "kling_mode_sound" && isRecord(raw.matrix)) {
    for (const [modeKey, row] of Object.entries(raw.matrix)) {
      if (!isRecord(row)) continue;
      for (const [dur, credits] of Object.entries(row)) {
        if (typeof credits === "number") {
          cells.push({
            label: modeKey,
            resolution: modeKey,
            duration: dur,
            credits: Math.floor(credits),
          });
        }
      }
    }
  } else if (typ === "fixed" && typeof raw.credits === "number") {
    cells.push({
      label: "fixed",
      resolution: "—",
      duration: "—",
      credits: Math.floor(raw.credits),
    });
  } else {
    const sample = getFinalCreditsFromPricingSchema(model, { duration: "5", resolution: "720p" });
    cells.push({
      label: "sample",
      resolution: "720p",
      duration: 5,
      credits: sample,
    });
  }

  if (cells.length === 0) return null;
  return {
    modelId: model.id,
    modelName: model.name,
    modelSlug: model.slug,
    pricingSchemaType: typ || "unknown",
    matrixKeyStrategy: strategy,
    cells,
  };
}

function countWarningsForTab(warnings: AdminPricingWarning[], tab: AdminPricingTabId): number {
  return warnings.filter((w) => w.tab === tab || w.tab === undefined).length;
}

export async function buildAdminPricingOverview(): Promise<AdminPricingOverviewData> {
  const [
    models,
    productSettings,
    tokenPackagesActive,
    allTokenPackages,
    kaspiSettings,
    globalTokenRaw,
    globalUsdRaw,
    globalMarkupRaw,
    cardBuilderResolved,
    conceptModel,
    marketplaceModel,
    productVideoModel,
  ] = await Promise.all([
    prisma.aiModel.findMany({
      orderBy: [{ scope: "asc" }, { type: "asc" }, { name: "asc" }],
    }),
    getProductCardSettings(),
    listActiveTokenPackagesForBilling(),
    prisma.tokenPackage.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        priceKzt: true,
        baseTokens: true,
        bonusTokens: true,
        totalTokens: true,
        description: true,
        sortOrder: true,
        isActive: true,
      },
    }),
    getKaspiManualSettings(),
    getAppSetting("TOKEN_VALUE_KZT"),
    getAppSetting("USD_TO_KZT"),
    getAppSetting("DEFAULT_MARKUP_PERCENT"),
    resolveCardBuilderImageModel(),
    resolveDefaultProductConceptImageModel(),
    resolveDefaultMarketplaceCardModel(),
    resolveDefaultProductVideoModel(),
  ]);

  const warnings: AdminPricingWarning[] = [];

  const globalTokenValueKzt =
    typeof globalTokenRaw === "number" && Number.isFinite(globalTokenRaw)
      ? globalTokenRaw
      : null;
  const tokenValuesDiffer =
    globalTokenValueKzt != null &&
    Math.abs(globalTokenValueKzt - productSettings.tokenValueKzt) > 0.001;

  if (tokenValuesDiffer) {
    warnings.push({
      id: "token-value-mismatch",
      severity: "warning",
      title: "Разные стоимости токена: GLOBAL и Product Card",
      detail: `TOKEN_VALUE_KZT=${globalTokenValueKzt}, PRODUCT_CARD_DEFAULT_TOKEN_VALUE_KZT=${productSettings.tokenValueKzt}. Маржа и выручка в разных разделах считаются по разным правилам.`,
      tab: "overview",
    });
  }

  for (const key of LEGACY_BUILDER_KEYS) {
    const row = await prisma.appSetting.findUnique({
      where: { key },
      select: { key: true },
    });
    if (row) {
      warnings.push({
        id: `legacy-${key}`,
        severity: "info",
        title: `Legacy-ключ ${key} есть в БД, но код его не читает`,
        detail: `Каноничный источник тарифов card_builder — PRODUCT_CARD_CARD_BUILDER_PRICING. Значение ${key} можно удалить из AppSettings.`,
        tab: "warnings",
      });
    }
  }

  const cbApi = storageToCardBuilderPricingApi(productSettings.cardBuilderPricing);
  for (const msg of cardBuilderPricingSoftWarnings(cbApi)) {
    warnings.push({
      id: `card-builder-pricing-${msg.slice(0, 40).replace(/\W+/g, "-")}`,
      severity: "warning",
      title: "Создать карточку: тарифы",
      detail: msg,
      tab: "card-builder",
    });
  }

  const pkgPriceWarnings = tokenPackagePriceWarnings(allTokenPackages);
  for (const msg of pkgPriceWarnings) {
    warnings.push({
      id: `token-pkg-price-${msg.slice(0, 40).replace(/\W+/g, "-")}`,
      severity: "warning",
      title: "Пополнение: цена за токен",
      detail: msg,
      tab: "topup",
    });
  }

  if (kaspiSettings.kaspiManualEnabled && tokenPackagesActive.length === 0) {
    warnings.push({
      id: "manual-topup-no-packages",
      severity: "warning",
      title: "Ручное пополнение включено, но нет активных пакетов",
      detail: "Клиенты не смогут выбрать пакет для оплаты.",
      tab: "topup",
    });
  }

  if (kaspiSettings.whatsappEnabled && !kaspiSettings.whatsappPhone) {
    warnings.push({
      id: "whatsapp-no-phone",
      severity: "error",
      title: "WhatsApp включён без номера",
      detail: "Укажите whatsappPhone в KASPI_MANUAL_SETTINGS или отключите WhatsApp.",
      tab: "topup",
    });
  }

  if (cardBuilderResolved?.fallbackFromMarketplaceCard) {
    warnings.push({
      id: "card-builder-fallback-model",
      severity: "warning",
      title: "Создать карточку использует fallback-модель marketplace",
      detail: `Отдельная модель PRODUCT_CARD_BUILDER не найдена; для provider cost reference используется «${cardBuilderResolved.model.name}». Цена слайдов задаётся AppSettings, не моделью.`,
      tab: "card-builder",
    });
  }

  const modelRows: AdminPricingModelRow[] = models.map((m) => {
    const minCredits = getCreditsUiFloor(m);
    let sampleCredits = m.costCredits;
    let marginPercent: number | null = null;
    if (m.scope === "GENERAL" && (m.type === "IMAGE" || m.type === "VIDEO")) {
      const s = generalSampleCredits(m);
      sampleCredits = s.credits;
      marginPercent = s.marginPercent;
    }
    const pinned = isAdminPricingPinned(m.pricingSchema);
    const pCost = schemaProviderCostUsd(m.pricingSchema);

    if (m.isActive && !isRecord(m.pricingSchema)) {
      warnings.push({
        id: `no-schema-${m.slug}`,
        severity: "warning",
        title: `Модель «${m.name}» без pricingSchema`,
        detail: "Используется только costCredits как fallback.",
        tab: "models",
      });
    }
    if (m.isActive && pCost != null && pCost > 0 && sampleCredits <= 0) {
      warnings.push({
        id: `no-client-price-${m.slug}`,
        severity: "error",
        title: `Модель «${m.name}»: есть provider cost, но нет клиентской цены`,
        detail: `providerCostUsd=${pCost}, sampleCredits=${sampleCredits}.`,
        tab: "models",
      });
    }
    if (
      marginPercent != null &&
      marginPercent < 0 &&
      !productSettings.allowNegativeMargin
    ) {
      warnings.push({
        id: `negative-margin-${m.slug}`,
        severity: "error",
        title: `Отрицательная маржа: ${m.name}`,
        detail: `Пример расчёта: ${marginPercent.toFixed(1)}%.`,
        tab: "models",
      });
    }

    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      scope: m.scope,
      type: m.type,
      productCardModelType: m.productCardModelType,
      provider: m.provider,
      isActive: m.isActive,
      pricingSchemaType: schemaType(m.pricingSchema),
      providerCostUsd: pCost,
      minCredits,
      sampleCredits,
      marginPercent,
      pinned,
    };
  });

  const activeGeneralImages = models.filter(
    (m) => m.scope === "GENERAL" && m.type === "IMAGE" && m.isActive,
  );
  const imageCredits = activeGeneralImages.map((m) =>
    getFinalCreditsFromPricingSchema(m, {}),
  );
  const generalImageSample = {
    minCredits: imageCredits.length ? Math.min(...imageCredits) : 0,
    maxCredits: imageCredits.length ? Math.max(...imageCredits) : 0,
    modelCount: activeGeneralImages.length,
  };

  const generalVideoMatrices = models
    .map(extractGeneralVideoMatrix)
    .filter((x): x is GeneralVideoMatrixRow => x != null);

  const cardBuilderSamples: AdminPricingOverviewData["cardBuilderSamples"] = [];
  if (cardBuilderResolved) {
    const p = productSettings.cardBuilderPricing;
    const cbModel = cardBuilderResolved.model;
    const samples = await Promise.all([
      estimateCardBuilderCharge("slide", cbModel, p, "light_marketplace", "medium", "main_photo"),
      estimateCardBuilderCharge("slide", cbModel, p, "premium", "medium", "lifestyle"),
      estimateCardBuilderCharge("gallery6", cbModel, p, "infographic", "infographic", "benefits_infographic", 6),
      estimateCardBuilderCharge("gallery8", cbModel, p, "premium", "heavy", "benefits_infographic", 8),
    ]);
    cardBuilderSamples.push(
      { label: "1 слайд · main_photo · обычный стиль", credits: samples[0].credits, formula: samples[0].formula },
      { label: "1 слайд · lifestyle · premium", credits: samples[1].credits, formula: samples[1].formula },
      { label: "Галерея 6 · bundle", credits: samples[2].credits, formula: samples[2].formula },
      { label: "Галерея 8 · bundle · premium + heavy", credits: samples[3].credits, formula: samples[3].formula },
    );
  }

  const marketplaceSamples: AdminPricingOverviewData["marketplaceSamples"] = [];
  if (marketplaceModel) {
    for (const n of [1, 2, 4, 6]) {
      const per = await calculateProductCardMarketplaceCardCredits(marketplaceModel, {
        cardSize: "square",
      });
      const bundle = resolveMarketplaceVariantBundleTotals(marketplaceModel, n, per);
      marketplaceSamples.push({
        variantCount: n,
        credits: bundle.totalCredits,
        formula: bundle.priceBreakdown.formula,
      });
    }
  }

  let conceptSample: AdminPricingOverviewData["conceptSample"] = null;
  if (conceptModel) {
    const b = await calculateProductCardConceptImageCredits(conceptModel, { size: "1x1" });
    conceptSample = {
      credits: b.credits,
      formula: b.formula,
      minCredits: productSettings.minConceptImageTokens,
    };
    if (b.marginKzt < 0 && !productSettings.allowNegativeMargin) {
      warnings.push({
        id: "concept-negative-margin",
        severity: "error",
        title: "Фото с концепциями: цена ниже себестоимости",
        detail: b.formula,
        tab: "concepts",
      });
    }
  }

  const productVideoSamples: ProductVideoPricingSample[] = [];
  let productVideoFlatPrice = false;
  if (productVideoModel) {
    const combos = [
      { duration: 5, resolution: "720p" },
      { duration: 10, resolution: "720p" },
      { duration: 5, resolution: "1080p" },
      { duration: 10, resolution: "1080p" },
    ];
    for (const c of combos) {
      const b = await calculateProductCardVideoCredits(productVideoModel, {
        duration: c.duration,
        resolution: c.resolution,
        aspectRatio: "16:9",
      });
      productVideoSamples.push({ ...c, credits: b.credits });
    }
    const unique = new Set(productVideoSamples.map((s) => s.credits));
    productVideoFlatPrice = unique.size <= 1 && productSettings.videoPresets.length > 1;
    if (productVideoFlatPrice) {
      warnings.push({
        id: "product-video-flat-matrix",
        severity: "warning",
        title: "Видео товара: UI показывает duration/resolution, но цена не меняется",
        detail: `Все комбинации 5s/10s × 720p/1080p дают ${productVideoSamples[0]?.credits ?? "?"} токенов. Заполните matrix в pricing модели или упростите presets.`,
        tab: "video",
      });
    }
  }

  const scenarioCards: ScenarioOverviewCard[] = [
    {
      id: "ai_image",
      label: "AI-фото",
      status: generalImageSample.modelCount > 0 ? "active" : "missing",
      priceSource: "AiModel.pricingSchema (GENERAL IMAGE)",
      minCredits: generalImageSample.minCredits || null,
      sampleCredits: generalImageSample.maxCredits || null,
      warningCount: countWarningsForTab(warnings, "models"),
      tab: "models",
    },
    {
      id: "ai_video",
      label: "AI-видео",
      status: generalVideoMatrices.length > 0 ? "active" : "partial",
      priceSource: "AiModel.pricingSchema (GENERAL VIDEO)",
      minCredits: generalVideoMatrices.length
        ? Math.min(...generalVideoMatrices.flatMap((m) => m.cells.map((c) => c.credits)))
        : null,
      sampleCredits: generalVideoMatrices.length
        ? Math.max(...generalVideoMatrices.flatMap((m) => m.cells.map((c) => c.credits)))
        : null,
      warningCount: countWarningsForTab(warnings, "video"),
      tab: "video",
    },
    {
      id: "card_builder",
      label: "Создать карточку",
      status: productSettings.scenarios.cardBuilder.enabled
        ? cardBuilderResolved
          ? "active"
          : "partial"
        : "disabled",
      priceSource: "PRODUCT_CARD_CARD_BUILDER_PRICING (AppSettings)",
      minCredits: productSettings.cardBuilderPricing.cardBuilderSingleSlideCredits,
      sampleCredits: cardBuilderSamples[cardBuilderSamples.length - 1]?.credits ?? null,
      warningCount: countWarningsForTab(warnings, "card-builder"),
      tab: "card-builder",
    },
    {
      id: "marketplace_card",
      label: "Карточка товара",
      status: productSettings.scenarios.marketplaceCard.enabled
        ? marketplaceModel
          ? "active"
          : "missing"
        : "disabled",
      priceSource: "Product Card model matrix (marketplace_card)",
      minCredits: productSettings.minMarketplaceCardTokens,
      sampleCredits: marketplaceSamples.find((s) => s.variantCount === 1)?.credits ?? null,
      warningCount: countWarningsForTab(warnings, "marketplace"),
      tab: "marketplace",
    },
    {
      id: "concept_photo",
      label: "Фото с концепциями",
      status: productSettings.scenarios.conceptPhoto.enabled
        ? conceptModel
          ? "active"
          : "missing"
        : "disabled",
      priceSource: "Product Card model matrix (concept_image)",
      minCredits: productSettings.minConceptImageTokens,
      sampleCredits: conceptSample?.credits ?? null,
      warningCount: countWarningsForTab(warnings, "concepts"),
      tab: "concepts",
    },
    {
      id: "product_video",
      label: "Видео товара",
      status: productSettings.scenarios.productVideo.enabled
        ? productVideoModel
          ? "active"
          : "missing"
        : "disabled",
      priceSource: "Product Card model matrix (video)",
      minCredits: productSettings.minVideoTokens,
      sampleCredits: productVideoSamples[0]?.credits ?? null,
      warningCount: countWarningsForTab(warnings, "video"),
      tab: "video",
    },
    {
      id: "topup",
      label: "Пополнение баланса",
      status:
        tokenPackagesActive.length > 0 || kaspiSettings.kaspiManualEnabled ? "active" : "partial",
      priceSource: "TokenPackage + KASPI_MANUAL_SETTINGS",
      minCredits: tokenPackagesActive.length
        ? Math.min(...tokenPackagesActive.map((p) => p.totalTokens))
        : null,
      sampleCredits: tokenPackagesActive.length
        ? Math.max(...tokenPackagesActive.map((p) => p.totalTokens))
        : null,
      warningCount: countWarningsForTab(warnings, "topup"),
      tab: "topup",
    },
  ];

  const notAffectingPrice: AdminPricingOverviewData["notAffectingPrice"] = [
    {
      scenario: "Карточка товара",
      items: ["overlay", "SVG-текст", "typography preset", "category", "benefits/icons в overlay"],
    },
    {
      scenario: "Видео товара",
      items: ["motionStyle", "category"],
    },
    {
      scenario: "Создать карточку",
      items: ["priceSegment", "audience", "category (на цену напрямую)"],
    },
    {
      scenario: "Фото с концепциями",
      items: ["category", "concept text", "количество source images"],
    },
  ];

  return {
    economics: {
      globalTokenValueKzt,
      productCardTokenValueKzt: productSettings.tokenValueKzt,
      usdToKzt:
        typeof globalUsdRaw === "number" && Number.isFinite(globalUsdRaw)
          ? globalUsdRaw
          : 500,
      productCardUsdToKzt: productSettings.usdToKzt,
      defaultMarkupPercent:
        typeof globalMarkupRaw === "number" && Number.isFinite(globalMarkupRaw)
          ? globalMarkupRaw
          : null,
      productCardMarkupPercent: productSettings.markupPercent,
      tokenValuesDiffer,
    },
    scenarioCards,
    models: modelRows,
    productCardSettings: productSettings,
    cardBuilderModel: cardBuilderResolved
      ? {
          id: cardBuilderResolved.model.id,
          name: cardBuilderResolved.model.name,
          slug: cardBuilderResolved.model.slug,
          fallbackFromMarketplaceCard: cardBuilderResolved.fallbackFromMarketplaceCard,
        }
      : null,
    cardBuilderSamples,
    marketplaceModel: marketplaceModel
      ? { id: marketplaceModel.id, name: marketplaceModel.name, slug: marketplaceModel.slug }
      : null,
    marketplaceSamples,
    conceptModel: conceptModel
      ? { id: conceptModel.id, name: conceptModel.name, slug: conceptModel.slug }
      : null,
    conceptSample,
    productVideoModel: productVideoModel
      ? { id: productVideoModel.id, name: productVideoModel.name, slug: productVideoModel.slug }
      : null,
    productVideoSamples,
    productVideoFlatPrice,
    generalVideoMatrices,
    generalImageSample,
    tokenPackages: allTokenPackages.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      priceKzt: p.priceKzt,
      baseTokens: p.baseTokens,
      bonusTokens: p.bonusTokens,
      totalTokens: p.totalTokens,
      pricePerTokenKzt:
        p.totalTokens > 0 ? Math.round((p.priceKzt / p.totalTokens) * 100) / 100 : 0,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      description: p.description,
    })),
    tokenPackagePriceWarnings: pkgPriceWarnings,
    manualTopUp: {
      enabled: kaspiSettings.kaspiManualEnabled,
      recipientName: kaspiSettings.recipientName,
      kaspiPhoneMasked: kaspiSettings.recipientPhone.replace(/\d(?=\d{4})/g, "•"),
      whatsappEnabled: kaspiSettings.whatsappEnabled && Boolean(kaspiSettings.whatsappPhone),
      whatsappPhoneDisplay: kaspiSettings.whatsappPhone,
    },
    warnings,
    notAffectingPrice,
  };
}
