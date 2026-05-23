/**
 * Преобразование пользовательского «Стиля карточки» и простого toggle текста
 * во внутренние rawSalesStyle / rawTextDensity / rawVisualStyle.
 */
import type { CardBuilderVisualStyleId } from "@/config/card-builder-universal";

export type CardBuilderTextAmountToggle = "less" | "more";

export type DerivedCardBuilderRawStyle = {
  rawVisualStyle: CardBuilderVisualStyleId | string;
  rawSalesStyle: string;
  rawTextDensity: string;
};

const VISUAL_TO_RAW: Record<string, Omit<DerivedCardBuilderRawStyle, "rawVisualStyle">> = {
  auto: { rawSalesStyle: "light_marketplace", rawTextDensity: "medium" },
  minimalism: { rawSalesStyle: "minimalism", rawTextDensity: "minimal" },
  premium: { rawSalesStyle: "premium", rawTextDensity: "medium" },
  bold_ad: { rawSalesStyle: "bold_ad", rawTextDensity: "medium" },
  lifestyle: { rawSalesStyle: "cozy_lifestyle", rawTextDensity: "minimal" },
  infographic: { rawSalesStyle: "infographic", rawTextDensity: "infographic" },
};

export function deriveRawStyleFromVisualChoice(
  visualStyle: string | undefined,
): DerivedCardBuilderRawStyle {
  const id = (visualStyle?.trim() || "auto") as CardBuilderVisualStyleId;
  const mapped = VISUAL_TO_RAW[id] ?? VISUAL_TO_RAW.auto!;
  return {
    rawVisualStyle: id,
    rawSalesStyle: mapped.rawSalesStyle,
    rawTextDensity: mapped.rawTextDensity,
  };
}

/** Простой UI-toggle «меньше / больше текста» поверх базы от visualStyle. */
export function applyTextAmountToggle(
  baseDensity: string,
  toggle: CardBuilderTextAmountToggle,
): string {
  const base = baseDensity.trim() || "medium";
  if (toggle === "less") {
    if (base === "infographic" || base === "heavy") return "medium";
    if (base === "medium") return "minimal";
    return "none";
  }
  // more
  if (base === "none") return "minimal";
  if (base === "minimal") return "medium";
  if (base === "medium") return "heavy";
  if (base === "infographic") return "infographic";
  return "heavy";
}

export function derivePlanStyleFields(input: {
  visualStyle?: string;
  textAmountToggle?: CardBuilderTextAmountToggle;
  /** Legacy saved plan — используется только если visualStyle не задан явно. */
  legacySalesStyle?: string;
  legacyTextDensity?: string;
}): DerivedCardBuilderRawStyle & { textDensity: string; salesStyle: string } {
  const fromVisual = deriveRawStyleFromVisualChoice(input.visualStyle);
  const salesStyle =
    input.legacySalesStyle?.trim() && !input.visualStyle?.trim()
      ? input.legacySalesStyle.trim()
      : fromVisual.rawSalesStyle;
  const baseDensity =
    input.legacyTextDensity?.trim() && !input.visualStyle?.trim()
      ? input.legacyTextDensity.trim()
      : fromVisual.rawTextDensity;
  const textDensity = applyTextAmountToggle(baseDensity, input.textAmountToggle ?? "more");
  return {
    ...fromVisual,
    salesStyle,
    textDensity,
  };
}

/** textDensity → toggle для гидратации старых планов. */
export function textDensityToToggle(textDensity: string): CardBuilderTextAmountToggle {
  const d = textDensity.trim();
  if (d === "none" || d === "minimal") return "less";
  return "more";
}
