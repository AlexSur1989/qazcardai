import { getCardBuilderTemplate } from "@/config/card-builder-templates";
import type { CardBuilderGallerySlide, CardBuilderPlanInput } from "@/server/services/productCardBuilderPlan";
import {
  buildMarketplaceCardOverlaySpec,
  type ProductCardOverlayInput,
} from "@/server/services/productCardOverlayRenderer";

export function cardBuilderSalesStyleToMarketplaceVisualStyle(salesStyleId: string): string {
  const id = salesStyleId.trim();
  const m: Record<string, string> = {
    clean_catalog: "clean_marketplace",
    light_marketplace: "clean_marketplace",
    premium: "premium",
    cozy_lifestyle: "premium",
    minimalism: "minimalist",
    bold_ad: "bright_advertising",
    infographic: "infographic",
    editorial: "premium",
  };
  return m[id] ?? "clean_marketplace";
}

export function normalizeCardBuilderBenefitIconId(id: string): string {
  const x = id.trim();
  if (x === "ruler") return "size";
  if (x === "sparkle") return "star";
  return x;
}

/** Overlay после Kie: русский текст и иконки поверх базового изображения. */
export function buildCardBuilderOverlayParts(
  slide: CardBuilderGallerySlide,
  planInput: CardBuilderPlanInput,
): {
  overlaySpec: ReturnType<typeof buildMarketplaceCardOverlaySpec>;
  overlayInput: ProductCardOverlayInput;
  benefitIconIds: string[];
} | null {
  if (!slide.overlayRequired) return null;
  const def = getCardBuilderTemplate(slide.templateId);
  if (!def) return null;

  const texts = slide.overlayTexts ?? {};
  const benefits: string[] = [];
  const icons: string[] = [];
  const rawIcons = slide.overlayBenefitIcons ?? [];

  for (let i = 1; i <= def.maxBenefits; i++) {
    const line = texts[`benefit_${i}`]?.trim();
    if (!line) continue;
    benefits.push(line);
    const ic = rawIcons[i - 1] ?? def.iconSlots[i - 1] ?? "check";
    icons.push(normalizeCardBuilderBenefitIconId(ic));
  }

  const overlayInput: ProductCardOverlayInput = {
    template: def.overlayTemplate,
    cardSize: "square",
    outputWidth: 1024,
    outputHeight: 1024,
    aspectRatio: "1:1",
    productTitle: texts.title?.trim() || "Товар",
    subtitle: texts.subtitle?.trim() ?? "",
    benefits,
    extraText: texts.extraText?.trim() ?? "",
    statsText: texts.statsText?.trim() ?? "",
    sizeText: texts.size_line?.trim() ?? "",
    style: cardBuilderSalesStyleToMarketplaceVisualStyle(planInput.salesStyle),
    templatePreset: def.overlayTemplatePreset,
    typographyPreset: def.typographyPreset ?? "marketplace",
    overlayVersion: "v2",
    useIcons: true,
    useArrows: false,
    useShadows: true,
    preserveProductLabel: planInput.preserveProduct === true,
    benefitIconIds: icons.length ? icons : undefined,
  };

  const overlaySpec = buildMarketplaceCardOverlaySpec(overlayInput);
  return { overlaySpec, overlayInput, benefitIconIds: icons };
}
