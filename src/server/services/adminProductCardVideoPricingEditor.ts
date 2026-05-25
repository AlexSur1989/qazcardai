import { revalidatePath } from "next/cache";

import type { UserRole } from "@/generated/prisma/enums";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { validateAdminPricingSchema } from "@/lib/admin-pricing-validation";
import { withAdminPricingPinned } from "@/lib/admin-pricing-pinned";
import { isRecord } from "@/lib/model-pricing-shared";
import {
  buildProductCardVideoFormulaText,
  buildProductCardVideoMatrixCells,
  durationResolutionOptionsFromPresets,
  hasProductCardVideoMultipliers,
  productCardVideoMatrixCellsToSchemaMatrix,
  productCardVideoPricingPatchSchema,
  productCardVideoPricingSoftWarnings,
  validateProductCardVideoPatchCells,
  type ProductCardVideoMatrixCell,
  type ProductCardVideoPricingApi,
} from "@/lib/pricing-admin/product-card-video";
import { prisma } from "@/lib/prisma";
import { calculateProductCardVideoCredits } from "@/server/services/productCardPricing";
import { resolveDefaultProductVideoModel } from "@/server/services/productCardModelResolver";
import { getProductCardSettings } from "@/server/services/productCardSettings";

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function listActiveProductVideoModels() {
  return prisma.aiModel.findMany({
    where: {
      scope: "PRODUCT_CARD",
      productCardModelType: "PRODUCT_VIDEO",
      isActive: true,
    },
    select: { id: true, slug: true, name: true },
    orderBy: { slug: "asc" },
  });
}

async function buildProductCardVideoPricingPayload(
  model: Awaited<ReturnType<typeof prisma.aiModel.findUnique>>,
  productSettings: Awaited<ReturnType<typeof getProductCardSettings>>,
  resolverModel: Awaited<ReturnType<typeof resolveDefaultProductVideoModel>>,
  activeVideoModels: Awaited<ReturnType<typeof listActiveProductVideoModels>>,
): Promise<ProductCardVideoPricingApi | null> {
  if (!model) return null;

  const schemaRaw = isRecord(model.pricingSchema) ? model.pricingSchema : {};
  const baseTokens = asNumber(schemaRaw.baseTokens ?? schemaRaw.fallbackTokens, model.costCredits);
  const minVideoTokens = Math.round(
    asNumber(schemaRaw.minVideoTokens, productSettings.minVideoTokens),
  );
  const { durationOptions, resolutionOptions } = durationResolutionOptionsFromPresets(
    productSettings.videoPresets,
  );
  const matrixObj = isRecord(schemaRaw.matrix) ? schemaRaw.matrix : {};
  const cells = buildProductCardVideoMatrixCells({
    matrix: matrixObj,
    durationOptions,
    resolutionOptions,
    baseTokens,
    minVideoTokens,
    pricingSchema: schemaRaw,
  });
  const hasMultipliers = hasProductCardVideoMultipliers(schemaRaw);

  const warnings = productCardVideoPricingSoftWarnings({
    cells,
    minVideoTokens,
    durationOptions,
    resolutionOptions,
    modelFound: true,
    modelActive: model.isActive,
    multipleActiveModels: activeVideoModels.length > 1,
    resolverModelSlug: resolverModel?.slug ?? null,
  });

  return {
    modelId: model.id,
    modelSlug: model.slug,
    modelName: model.name,
    isActive: model.isActive,
    productCardModelType: model.productCardModelType,
    pricingSchemaType: typeof schemaRaw.type === "string" ? schemaRaw.type : null,
    durationOptions,
    resolutionOptions,
    matrix: cells.map(({ duration, resolution, credits }) => ({ duration, resolution, credits })),
    minVideoTokens,
    hasMultipliers,
    appliedMultiplierSummary: hasMultipliers ? "Есть multipliers в pricingSchema" : null,
    warnings,
  };
}

export async function loadProductCardVideoPricingForAdmin(): Promise<{
  pricing: ProductCardVideoPricingApi | null;
  formula: string;
  cellPreviews: ReturnType<typeof buildProductCardVideoMatrixCells>;
}> {
  const [productSettings, resolverModel, activeVideoModels] = await Promise.all([
    getProductCardSettings(),
    resolveDefaultProductVideoModel(),
    listActiveProductVideoModels(),
  ]);

  const model =
    resolverModel ??
    (activeVideoModels[0]
      ? await prisma.aiModel.findUnique({ where: { id: activeVideoModels[0].id } })
      : null);

  const schemaRaw = model && isRecord(model.pricingSchema) ? model.pricingSchema : {};
  const baseTokens = model
    ? asNumber(schemaRaw.baseTokens ?? schemaRaw.fallbackTokens, model.costCredits)
    : 0;
  const minVideoTokens = Math.round(
    asNumber(schemaRaw.minVideoTokens, productSettings.minVideoTokens),
  );
  const { durationOptions, resolutionOptions } = durationResolutionOptionsFromPresets(
    productSettings.videoPresets,
  );
  const matrixObj = isRecord(schemaRaw.matrix) ? schemaRaw.matrix : {};
  const cellPreviews = model
    ? buildProductCardVideoMatrixCells({
        matrix: matrixObj,
        durationOptions,
        resolutionOptions,
        baseTokens,
        minVideoTokens,
        pricingSchema: schemaRaw,
      })
    : [];

  const pricing = model
    ? await buildProductCardVideoPricingPayload(
        model,
        productSettings,
        resolverModel,
        activeVideoModels,
      )
    : null;

  const formula = buildProductCardVideoFormulaText({
    hasMultipliers: pricing?.hasMultipliers ?? false,
    minVideoTokens: pricing?.minVideoTokens ?? productSettings.minVideoTokens,
  });

  if (!model) {
    return {
      pricing: null,
      formula,
      cellPreviews: [],
    };
  }

  return { pricing, formula, cellPreviews };
}

export async function saveProductCardVideoPricing(args: {
  input: unknown;
  adminUserId: string;
  adminRole: UserRole;
}): Promise<
  | {
      ok: true;
      pricing: ProductCardVideoPricingApi;
      formula: string;
      estimateSamples: Array<{ duration: number; resolution: string; credits: number }>;
    }
  | { ok: false; error: string; status: number }
> {
  const parsed = productCardVideoPricingPatchSchema.safeParse(args.input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      status: 400,
    };
  }

  const model = await prisma.aiModel.findUnique({ where: { id: parsed.data.modelId } });
  if (!model) {
    return { ok: false, error: "Модель не найдена", status: 404 };
  }
  if (model.scope !== "PRODUCT_CARD") {
    return { ok: false, error: "Можно редактировать только модели PRODUCT_CARD", status: 403 };
  }
  if (model.productCardModelType !== "PRODUCT_VIDEO") {
    return {
      ok: false,
      error: "API редактирует только модели PRODUCT_VIDEO",
      status: 403,
    };
  }

  const [productSettings, activeVideoModels, resolverModel] = await Promise.all([
    getProductCardSettings(),
    listActiveProductVideoModels(),
    resolveDefaultProductVideoModel(),
  ]);

  const { durationOptions, resolutionOptions } = durationResolutionOptionsFromPresets(
    productSettings.videoPresets,
  );
  const minVideoTokens = Math.round(
    asNumber(
      isRecord(model.pricingSchema) ? model.pricingSchema.minVideoTokens : undefined,
      productSettings.minVideoTokens,
    ),
  );

  const cellValidation = validateProductCardVideoPatchCells({
    matrix: parsed.data.matrix as ProductCardVideoMatrixCell[],
    durationOptions,
    resolutionOptions,
    minVideoTokens,
  });
  if (!cellValidation.ok) {
    return { ok: false, error: cellValidation.error, status: 400 };
  }

  const existingSchema = isRecord(model.pricingSchema) ? { ...model.pricingSchema } : {};
  const baseTokens = asNumber(
    existingSchema.baseTokens ?? existingSchema.fallbackTokens,
    model.costCredits,
  );
  const baseProviderCostUsd = asNumber(
    existingSchema.providerCostUsd ?? existingSchema.providerCost,
    0,
  );
  const existingMatrix = isRecord(existingSchema.matrix) ? existingSchema.matrix : {};

  const nextMatrix = productCardVideoMatrixCellsToSchemaMatrix(
    parsed.data.matrix,
    existingMatrix,
    baseTokens,
    baseProviderCostUsd,
  );

  const nextCore = {
    ...existingSchema,
    matrix: nextMatrix,
  };

  const validated = validateAdminPricingSchema(nextCore);
  if (!validated.ok) {
    return { ok: false, error: validated.error, status: 400 };
  }

  const newValueRaw = withAdminPricingPinned(validated.pricingSchema);

  await prisma.aiModel.update({
    where: { id: model.id },
    data: { pricingSchema: newValueRaw as object },
  });

  await writeAdminAuditLog({
    adminUserId: args.adminUserId,
    adminRole: args.adminRole,
    action: "product_card_video_pricing_changed",
    targetType: "AiModel",
    targetId: model.id,
    oldValue: model.pricingSchema,
    newValue: newValueRaw,
    metadata: {
      modelSlug: model.slug,
      matrixCells: parsed.data.matrix.length,
    },
  });

  revalidatePath("/admin/pricing");
  revalidatePath("/admin/models");
  revalidatePath("/admin/product-card");

  const updatedModel = { ...model, pricingSchema: newValueRaw as typeof model.pricingSchema };
  const pricing = await buildProductCardVideoPricingPayload(
    updatedModel,
    productSettings,
    resolverModel,
    activeVideoModels,
  );
  if (!pricing) {
    return { ok: false, error: "Не удалось собрать ответ", status: 500 };
  }

  const estimateSamples: Array<{ duration: number; resolution: string; credits: number }> = [];
  for (const sample of [
    { duration: 5, resolution: "720p" },
    { duration: 10, resolution: "1080p" },
  ] as const) {
    if (
      !durationOptions.includes(sample.duration) ||
      !resolutionOptions.includes(sample.resolution)
    ) {
      continue;
    }
    const b = await calculateProductCardVideoCredits(updatedModel, {
      duration: sample.duration,
      resolution: sample.resolution,
      aspectRatio: "16:9",
    });
    estimateSamples.push({ ...sample, credits: b.credits });
  }

  const formula = buildProductCardVideoFormulaText({
    hasMultipliers: pricing.hasMultipliers,
    minVideoTokens: pricing.minVideoTokens,
  });

  return { ok: true, pricing, formula, estimateSamples };
}

export async function resetProductCardVideoPricingDraft(args: {
  modelId: string;
}): Promise<
  | { ok: true; pricing: ProductCardVideoPricingApi; formula: string }
  | { ok: false; error: string; status: number }
> {
  const model = await prisma.aiModel.findUnique({ where: { id: args.modelId } });
  if (!model) {
    return { ok: false, error: "Модель не найдена", status: 404 };
  }
  if (model.productCardModelType !== "PRODUCT_VIDEO" || model.scope !== "PRODUCT_CARD") {
    return { ok: false, error: "Неверная модель", status: 403 };
  }

  const [productSettings, resolverModel, activeVideoModels] = await Promise.all([
    getProductCardSettings(),
    resolveDefaultProductVideoModel(),
    listActiveProductVideoModels(),
  ]);

  const pricing = await buildProductCardVideoPricingPayload(
    model,
    productSettings,
    resolverModel,
    activeVideoModels,
  );
  if (!pricing) {
    return { ok: false, error: "Не удалось загрузить pricing", status: 500 };
  }

  const formula = buildProductCardVideoFormulaText({
    hasMultipliers: pricing.hasMultipliers,
    minVideoTokens: pricing.minVideoTokens,
  });

  return { ok: true, pricing, formula };
}
