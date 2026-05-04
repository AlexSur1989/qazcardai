import type { ProductCardSizePreset } from "@/server/services/productCardSettings";

const KIE_SUPPORTED_ASPECT_RATIOS = ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"] as const;

export type KieSupportedAspectRatio = (typeof KIE_SUPPORTED_ASPECT_RATIOS)[number];
export type KieSupportedResolution = "1K" | "2K" | "4K";

export type MarketplaceCardResolvedSize = {
  id: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
  kieAspectRatio: KieSupportedAspectRatio;
  kieResolution: KieSupportedResolution;
};

function ratioFromAspect(aspectRatio: string): number | null {
  const [rawW, rawH] = aspectRatio.split(":");
  const w = Number(rawW);
  const h = Number(rawH);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w / h : null;
}

function closestKieAspectRatio(preset: ProductCardSizePreset): KieSupportedAspectRatio {
  const exact = KIE_SUPPORTED_ASPECT_RATIOS.find((item) => item === preset.aspectRatio);
  if (exact) return exact;

  const target = preset.width / preset.height;
  const candidates: Exclude<KieSupportedAspectRatio, "auto">[] = ["1:1", "9:16", "16:9", "4:3", "3:4"];
  return candidates.reduce((best, current) => {
    const currentRatio = ratioFromAspect(current) ?? 1;
    const bestRatio = ratioFromAspect(best) ?? 1;
    return Math.abs(currentRatio - target) < Math.abs(bestRatio - target) ? current : best;
  }, "1:1" as Exclude<KieSupportedAspectRatio, "auto">);
}

function pickKieResolution(
  width: number,
  height: number,
  aspectRatio: KieSupportedAspectRatio,
): KieSupportedResolution {
  const longest = Math.max(width, height);
  const resolution: KieSupportedResolution = longest > 2200 ? "4K" : longest > 1300 ? "2K" : "1K";
  // Kie rejects GPT Image 2 1:1 generations with 4K.
  return aspectRatio === "1:1" && resolution === "4K" ? "2K" : resolution;
}

const FALLBACK_MARKETPLACE_CARD_SIZE: ProductCardSizePreset = {
  id: "square",
  label: "Квадрат 1000x1000",
  width: 1000,
  height: 1000,
  aspectRatio: "1:1",
};

export function resolveMarketplaceCardSize(
  presets: ProductCardSizePreset[],
  cardSize?: string | null,
): { ok: true; size: MarketplaceCardResolvedSize } | { ok: false; error: string } {
  const list = presets.length > 0 ? presets : [FALLBACK_MARKETPLACE_CARD_SIZE];
  const wanted = cardSize?.trim() || list[0]?.id || FALLBACK_MARKETPLACE_CARD_SIZE.id;
  const preset = list.find((item) => item.id === wanted);
  if (!preset) {
    return { ok: false, error: "Некорректный размер карточки" };
  }

  const kieAspectRatio = closestKieAspectRatio(preset);
  return {
    ok: true,
    size: {
      ...preset,
      kieAspectRatio,
      kieResolution: pickKieResolution(preset.width, preset.height, kieAspectRatio),
    },
  };
}
