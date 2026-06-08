import type { SimpleCardAspectRatio } from "@/config/simple-product-card";
import { getManualProductCategoryLabel } from "@/config/product-card-manual-categories";
import { getProductCategoryById } from "@/config/product-card-categories";
import {
  hasEnoughProductBenefits,
  SIMPLE_CARD_BENEFITS_REQUIRED_MESSAGE,
} from "@/lib/simple-product-card-benefits";
import { mapProductCardModelErrorForUser } from "@/lib/product-card-scenario-setup-copy";
import type { SimpleProductCardRequest } from "@/lib/validations/simple-product-card";
import {
  aspectRatioToSimpleCardSizeId,
  normalizeSimpleCardPayload,
  simpleCardUsesReference,
  simpleProductCardRequestSchema,
} from "@/lib/validations/simple-product-card";
import { mergeSimpleCardProductLabelIntoUserText } from "@/lib/simple-product-card-vision-text";
import { assertMarketplaceCardScenarioEnabled } from "@/server/services/productCardScenarios";
import { getProductCardModelSetupOverview } from "@/server/services/productCardModelSetup";
import {
  calculateProductCardMarketplaceCardCredits,
} from "@/server/services/productCardPricing";
import { assertUserOwnsFileUrl, getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { computeSimpleCardPlanHash } from "@/server/services/simpleProductCardGeneration";
import {
  getSimpleProductCardRuntimeSettings,
  resolveSimpleProductCardImageModel,
} from "@/server/services/simpleProductCardSettings";
import { prisma } from "@/lib/prisma";

const OUTPUT_RESOLUTION: Record<SimpleCardAspectRatio, string> = {
  "1:1": "1K",
  "4:3": "1K",
  "3:4": "1K",
  "16:9": "1K",
  "9:16": "1K",
};

export type SimpleCardPlanPreview = {
  ok: true;
  ready: boolean;
  readinessStatus: "Ready" | "Not ready";
  userMessage: string;
  categoryLabel: string | null;
  categorySource: string | null;
  productLabel: string | null;
  benefitsText: string;
  aspectRatio: SimpleCardAspectRatio;
  resolution: string;
  styleMode: SimpleProductCardRequest["styleMode"];
  credits: number;
  planHash: string;
  issues: string[];
  admin?: {
    modelSlug: string;
    modelId: string;
    apiModelId: string;
    adminModelEditUrl: string;
    payloadDryRunUrl: string;
  };
};

function categoryLabelFor(id: string | null | undefined): string | null {
  if (!id?.trim()) return null;
  return getManualProductCategoryLabel(id) ?? getProductCategoryById(id)?.label ?? id;
}

export async function previewSimpleProductCardPlan(
  userId: string,
  projectId: string,
  rawPayload: unknown,
  options: {
    productLabel?: string;
    isAdmin?: boolean;
  } = {},
): Promise<SimpleCardPlanPreview | { ok: false; error: string; status: number; code?: string }> {
  const gate = await assertMarketplaceCardScenarioEnabled();
  if (!gate.ok) return gate;

  const parsedBody = simpleProductCardRequestSchema.safeParse(rawPayload);
  if (!parsedBody.success) {
    return {
      ok: false,
      error: parsedBody.error.issues[0]?.message ?? "Некорректные данные",
      status: 400,
    };
  }

  const project = await getOwnedProjectOrNull(userId, projectId);
  if (!project) return { ok: false, error: "Проект не найден", status: 404 };

  const parsed = normalizeSimpleCardPayload(parsedBody.data);

  const issues: string[] = [];
  const productLabel = options.productLabel?.trim() || null;
  const benefitsText = parsed.userText?.trim() ?? "";

  if (!parsed.productPhotoId?.trim()) {
    issues.push("Выберите фото товара.");
  } else {
    const row = await prisma.uploadedFile.findFirst({
      where: { id: parsed.productPhotoId.trim(), userId },
      select: { url: true },
    });
    const url = row?.url?.trim();
    if (!url || !(await assertUserOwnsFileUrl(userId, url))) {
      issues.push("Фото товара не найдено.");
    }
  }

  if (!project.selectedCategory?.trim()) {
    issues.push("Выберите категорию товара.");
  }

  if (!hasEnoughProductBenefits(benefitsText)) {
    issues.push(SIMPLE_CARD_BENEFITS_REQUIRED_MESSAGE);
  }

  const usesRef = simpleCardUsesReference(parsed);
  const runtime = await getSimpleProductCardRuntimeSettings();
  if (!runtime.enabled) {
    issues.push("Сценарий временно недоступен.");
  }
  if (usesRef && !runtime.referenceEnabled) {
    issues.push("Режим с референсом отключён.");
  }

  const modelRes = await resolveSimpleProductCardImageModel({ needsReference: usesRef, settings: runtime });
  let credits = 12;
  let modelSlug = "";
  let modelId = "";
  let apiModelId = "";

  if (!modelRes) {
    issues.push(
      mapProductCardModelErrorForUser("Модель карточки не настроена") ??
        "Карточка товара временно недоступна.",
    );
  } else {
    modelSlug = modelRes.model.slug;
    modelId = modelRes.model.id;
    apiModelId = modelRes.model.apiModelId;
    const br = await calculateProductCardMarketplaceCardCredits(modelRes.model, {
      cardSize: aspectRatioToSimpleCardSizeId(parsed.aspectRatio),
      styleMode: parsed.styleMode,
    });
    credits = br.credits;
  }

  const overview = await getProductCardModelSetupOverview();
  const marketplaceSlot = overview.byType.PRODUCT_MARKETPLACE_CARD;
  const marketplaceReady = marketplaceSlot?.generationReady === true;

  if (!marketplaceReady) {
    issues.push("Модель карточки ещё настраивается.");
  }

  const ready = issues.length === 0 && marketplaceReady;
  const readinessStatus = ready ? "Ready" : "Not ready";

  const preview: SimpleCardPlanPreview = {
    ok: true,
    ready,
    readinessStatus,
    userMessage: ready ? "Карточка готова к созданию" : "Проверьте данные перед созданием",
    categoryLabel: categoryLabelFor(project.selectedCategory),
    categorySource: project.categorySource,
    productLabel,
    benefitsText: mergeSimpleCardProductLabelIntoUserText(productLabel ?? "", benefitsText),
    aspectRatio: parsed.aspectRatio,
    resolution: OUTPUT_RESOLUTION[parsed.aspectRatio] ?? "1K",
    styleMode: parsed.styleMode,
    credits,
    planHash: computeSimpleCardPlanHash(parsed),
    issues,
  };

  if (options.isAdmin && modelRes) {
    preview.admin = {
      modelSlug,
      modelId,
      apiModelId,
      adminModelEditUrl: `/admin/models/${modelId}/edit`,
      payloadDryRunUrl: `/api/admin/models/${modelId}/test/payload-dry-run`,
    };
  }

  return preview;
}
