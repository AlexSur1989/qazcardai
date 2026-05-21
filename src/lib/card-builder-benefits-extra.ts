import type { ProductCardMarketplaceProfile } from "@/config/product-card-marketplace-profiles";
import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
import { CATEGORY_FIELD_VALUE_MAX_CHARS } from "@/lib/card-builder-category-fields-runtime";

export type BenefitsExtraPlanSlice = {
  benefitsExtra?: string | null;
  additionalBenefits?: string | null;
};

export type MarketplacePlannerCluster =
  | "classified_mp"
  | "amazon"
  | "lamoda"
  | "classified_listings"
  | "brand_ecom"
  | "social"
  | "neutral";

export function plannerClusterFromMarketplaceId(marketplaceId: string): MarketplacePlannerCluster {
  switch (marketplaceId) {
    case "kaspi":
    case "wildberries":
    case "ozon":
    case "yandex_market":
    case "halyk_market":
      return "classified_mp";
    case "amazon":
      return "amazon";
    case "lamoda":
      return "lamoda";
    case "olx":
    case "avito":
      return "classified_listings";
    case "shopify":
    case "own_site":
      return "brand_ecom";
    case "instagram_vk":
      return "social";
    default:
      return "neutral";
  }
}

export function mergedBenefitsExtraText(input: BenefitsExtraPlanSlice): string {
  return (input.benefitsExtra?.trim() || input.additionalBenefits?.trim() || "").trim();
}

/** Непустые строки из «Дополнительные преимущества» (по переводу строки). */
export function parseBenefitsExtraLines(input: BenefitsExtraPlanSlice): string[] {
  const extra = mergedBenefitsExtraText(input);
  if (!extra) return [];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const part of extra.split(/\r?\n/)) {
    const x = part
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, CATEGORY_FIELD_VALUE_MAX_CHARS);
    if (!x) continue;
    const key = x.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(x);
  }
  return lines;
}

/** Шаблон кадра преимуществ с учётом площадки (до coerce в планировщике). */
export function pickBenefitsInfographicTemplateId(
  cluster: MarketplacePlannerCluster,
  profile: ProductCardMarketplaceProfile,
  lineCount: number,
): "benefits_grid" | "benefits_left_column" {
  if (cluster === "social" || cluster === "brand_ecom") {
    return lineCount >= 4 ? "benefits_grid" : "benefits_left_column";
  }
  if (cluster === "classified_listings") {
    return "benefits_grid";
  }
  if (cluster === "lamoda") {
    return "benefits_left_column";
  }
  if (profile.infographicAllowed) {
    return "benefits_grid";
  }
  return "benefits_left_column";
}

/** Индекс вставки: не в первых кадрах на Lamoda / строгих МП. */
export function benefitsSlideInsertIndex(
  cluster: MarketplacePlannerCluster,
  galleryLength: number,
): number {
  if (galleryLength <= 0) return 0;
  if (cluster === "lamoda") return Math.min(3, galleryLength);
  if (cluster === "classified_mp" || cluster === "amazon") return Math.min(2, galleryLength);
  return Math.min(2, galleryLength);
}

/**
 * Locked-фразы из benefitsExtra только для релевантных слайдов (не на main_photo строгих МП).
 */
export function benefitsExtraPhrasesForSlideRole(
  slideRole: CardBuilderTemplateSlideRole | string,
  extraLines: string[],
  cluster: MarketplacePlannerCluster,
  profile: ProductCardMarketplaceProfile | null,
  options?: { mainPhotoOmitsUserText?: boolean },
): string[] {
  if (extraLines.length === 0) return [];

  if (slideRole === "benefits_infographic") {
    return [...extraLines];
  }

  if (extraLines.length === 1) {
    if (slideRole === "premium_poster" || slideRole === "ad_banner") {
      return [extraLines[0]!];
    }
    return [];
  }

  if (slideRole === "main_photo") {
    const strictMain =
      options?.mainPhotoOmitsUserText ||
      (profile != null && !profile.mainPhotoTextAllowed) ||
      cluster === "classified_mp" ||
      cluster === "amazon" ||
      cluster === "lamoda";
    if (strictMain) return [];
  }

  return [];
}
