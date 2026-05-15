import { createHash } from "node:crypto";

import type { ProductCategoryId } from "@/config/product-card-categories";
import { PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION } from "@/config/product-card-marketplace-profiles";
import { normalizeFlatCategoryFieldRecord } from "@/lib/card-builder-category-fields-runtime";
import { styleReferenceFingerprintPayload } from "@/lib/card-builder-style-reference";

import type { CardBuilderGallerySlide, CardBuilderPlanInput } from "@/server/services/productCardBuilderPlan";

export type CardBuilderPlanFingerprintInput = {
  selectedCategory: string;
  marketplace: string;
  goal: string;
  preserveProduct?: boolean;
  preserveAspects: string[];
  allowCreativeStylization?: boolean;
  benefits: string[];
  benefitsExtra?: string;
  subtitle?: string;
  dimensions?: string;
  languageMode?: string;
  mustShow: string[];
  audience: string;
  priceSegment: string;
  salesStyle: string;
  textDensity: string;
  marketplaceProfileId?: string;
  marketplaceProfileVersion?: string;
  categoryFieldsFingerprint?: Record<string, unknown>;
  styleReferenceFingerprint?: Record<string, unknown>;
};

function sortRecordKeys(m: Record<string, string>): Record<string, string> {
  return [...Object.keys(m)].sort().reduce<Record<string, string>>((acc, key) => {
    acc[key] = m[key]!;
    return acc;
  }, {});
}

function buildCategoryFieldsFingerprint(plan: CardBuilderPlanInput): Record<string, unknown> | undefined {
  type CatKey = Extract<ProductCategoryId, string>;

  const snap = plan.categoryFields;
  const snapNorm =
    snap?.categoryKey && snap.values && typeof snap.values === "object"
      ? {
          categoryKey: String(snap.categoryKey).trim(),
          values: sortRecordKeys(normalizeFlatCategoryFieldRecord(snap.values as Record<string, unknown>)),
        }
      : null;

  const by = plan.categoryFieldsByCategory;
  const byOut: Record<string, Record<string, string>> = {};

  if (by && typeof by === "object") {
    for (const k of [...Object.keys(by)].sort()) {
      const m = by[k as CatKey];
      if (!m || typeof m !== "object") continue;
      const norm = normalizeFlatCategoryFieldRecord(m as Record<string, unknown>);
      if (Object.keys(norm).length) byOut[String(k)] = sortRecordKeys(norm);
    }
  }

  const hasBy = Object.keys(byOut).length > 0;
  if (!snapNorm && !hasBy) return undefined;

  const out: Record<string, unknown> = {};
  if (snapNorm) out.snapshot = snapNorm;
  if (hasBy) out.byCategory = byOut;
  return out;
}

function slideStrip(slides: CardBuilderGallerySlide[]) {
  return slides.map((s) => ({
    slideId: s.slideId,
    imageRole: s.imageRole,
    templateId: s.templateId,
    layoutPreset: s.layoutPreset,
    sourceImageMode: s.sourceImageMode,
  }));
}

/** Детеминированный отпечаток плана: estimate отдаёт hash, generate сверяет до reserveCredits. */
export function computeCardBuilderPlanFingerprint(
  plan: CardBuilderPlanFingerprintInput,
  slides: CardBuilderGallerySlide[],
): string {
  const planNorm: CardBuilderPlanFingerprintInput = {
    selectedCategory: plan.selectedCategory,
    marketplace: plan.marketplace,
    goal: plan.goal,
    preserveProduct: plan.preserveProduct ?? true,
    preserveAspects: [...plan.preserveAspects].sort(),
    allowCreativeStylization: Boolean(plan.allowCreativeStylization),
    benefits: [...plan.benefits].sort(),
    benefitsExtra: (plan.benefitsExtra ?? "").trim(),
    subtitle: (plan.subtitle ?? "").trim(),
    dimensions: (plan.dimensions ?? "").trim(),
    languageMode: plan.languageMode ?? "auto",
    mustShow: [...plan.mustShow].sort(),
    audience: plan.audience,
    priceSegment: plan.priceSegment,
    salesStyle: plan.salesStyle,
    textDensity: plan.textDensity,
    ...(plan.marketplaceProfileId ? { marketplaceProfileId: plan.marketplaceProfileId } : {}),
    ...(plan.marketplaceProfileVersion ? { marketplaceProfileVersion: plan.marketplaceProfileVersion } : {}),
    ...(plan.categoryFieldsFingerprint && Object.keys(plan.categoryFieldsFingerprint).length
      ? { categoryFieldsFingerprint: plan.categoryFieldsFingerprint }
      : {}),
    ...(plan.styleReferenceFingerprint && Object.keys(plan.styleReferenceFingerprint).length
      ? { styleReferenceFingerprint: plan.styleReferenceFingerprint }
      : {}),
  };

  const body = JSON.stringify({
    plan: planNorm,
    slides: slideStrip(slides),
  });
  return createHash("sha256").update(body).digest("hex");
}

/** Вход fingerprint из актуального плана + id профиля (merge из AppSetting уже в planInput.marketplaceProfileId если сохранено). */
export function cardBuilderLivePlanFingerprintInputs(
  plan: CardBuilderPlanInput,
  profileId: string,
): CardBuilderPlanFingerprintInput {
  const categoryFieldsFingerprint = buildCategoryFieldsFingerprint(plan);
  const styleReferenceFingerprint = styleReferenceFingerprintPayload(plan.styleReference);
  return {
    selectedCategory: plan.selectedCategory,
    marketplace: plan.marketplace,
    goal: plan.goal,
    preserveProduct: plan.preserveProduct ?? true,
    preserveAspects: plan.preserveAspects ?? [],
    allowCreativeStylization: plan.allowCreativeStylization,
    benefits: plan.benefits ?? [],
    benefitsExtra: plan.benefitsExtra,
    subtitle: plan.subtitle,
    dimensions: plan.dimensions,
    languageMode: plan.languageMode,
    mustShow: plan.mustShow ?? [],
    audience: plan.audience,
    priceSegment: plan.priceSegment,
    salesStyle: plan.salesStyle,
    textDensity: plan.textDensity,
    marketplaceProfileId: profileId,
    marketplaceProfileVersion: PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION,
    ...(categoryFieldsFingerprint ? { categoryFieldsFingerprint } : {}),
    ...(styleReferenceFingerprint ? { styleReferenceFingerprint } : {}),
  };
}
