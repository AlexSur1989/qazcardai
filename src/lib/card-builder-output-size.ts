import {
  getCardBuilderOutputSizePreset,
  type CardBuilderOutputSizeId,
} from "@/config/card-builder-output-sizes";
import {
  resolveMarketplaceCardSize,
  type MarketplaceCardResolvedSize,
} from "@/server/services/marketplaceCardSizing";
import type { ProductCardSizePreset } from "@/server/services/productCardSettings";

const PRESETS: ProductCardSizePreset[] = [
  { id: "1x1", label: "1:1 · 1500×1500", width: 1500, height: 1500, aspectRatio: "1:1" },
  { id: "4x3", label: "4:3 · 1600×1200", width: 1600, height: 1200, aspectRatio: "4:3" },
  { id: "3x4", label: "3:4 · 1200×1600", width: 1200, height: 1600, aspectRatio: "3:4" },
  { id: "16x9", label: "16:9 · 1344×768", width: 1344, height: 768, aspectRatio: "16:9" },
  { id: "9x16", label: "9:16 · 768×1344", width: 768, height: 1344, aspectRatio: "9:16" },
];

/** Разрешённый выходной размер card_builder → Kie aspect_ratio + resolution. */
export function resolveCardBuilderOutputSize(
  id: string | null | undefined,
): MarketplaceCardResolvedSize {
  const normalized = getCardBuilderOutputSizePreset(id).id;
  const result = resolveMarketplaceCardSize(PRESETS, normalized);
  if (result.ok) return result.size;
  const fallback = resolveMarketplaceCardSize(PRESETS, "1x1");
  if (fallback.ok) return fallback.size;
  return {
    id: "1x1",
    label: "1:1 · 1500×1500",
    width: 1500,
    height: 1500,
    aspectRatio: "1:1",
    kieAspectRatio: "1:1",
    kieResolution: "2K",
  };
}

export function cardBuilderTargetSizeLabel(size: MarketplaceCardResolvedSize): string {
  return `${size.width}x${size.height}`;
}

export function cardBuilderOutputSizeFields(id: CardBuilderOutputSizeId | string | undefined): {
  cardBuilderOutputSizeId: CardBuilderOutputSizeId;
  cardBuilderTargetAspectRatio: string;
  cardBuilderTargetSize: string;
} {
  const preset = getCardBuilderOutputSizePreset(id);
  const resolved = resolveCardBuilderOutputSize(preset.id);
  return {
    cardBuilderOutputSizeId: preset.id,
    cardBuilderTargetAspectRatio: resolved.aspectRatio,
    cardBuilderTargetSize: cardBuilderTargetSizeLabel(resolved),
  };
}
