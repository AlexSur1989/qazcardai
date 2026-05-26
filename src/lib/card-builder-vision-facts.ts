import {
  confidenceLevelFromNumeric,
  newProductFactId,
  type CardBuilderProductFact,
  type CardBuilderProductFactType,
} from "@/lib/card-builder-product-facts";
import type { CardBuilderUniversalCategoryId } from "@/config/card-builder-universal";

export type VisionAnalysisForFacts = {
  categoryKey: CardBuilderUniversalCategoryId;
  productType: string;
  productNameGuess: string;
  brandGuess: string | null;
  materialGuess: string | null;
  visibleText: string[];
  visibleClaims: string[];
  suggestedProductFacts: Array<{
    label: string;
    value: string;
    type: CardBuilderProductFactType;
    confidence: number;
  }>;
  confidence: number;
};

/** Vision → facts: только видимое на фото + осторожные visual guesses. */
export function visionAnalysisToProductFacts(
  analysis: VisionAnalysisForFacts,
): CardBuilderProductFact[] {
  const out: CardBuilderProductFact[] = [];
  const push = (fact: Omit<CardBuilderProductFact, "id">) => {
    out.push({ id: newProductFactId(), ...fact });
  };

  const visionTypesAllowed = new Set<CardBuilderProductFactType>([
    "detail",
    "package",
    "dimension",
    "material",
    "product_purpose",
    "other",
  ]);

  for (const row of analysis.suggestedProductFacts) {
    if (!visionTypesAllowed.has(row.type) && row.type !== "feature") continue;
    if (row.type === "benefit" || row.type === "effect" || row.type === "ingredient") continue;
    const level = confidenceLevelFromNumeric(row.confidence);
    push({
      label: row.label,
      value: row.value,
      type: row.type,
      source: "vision_ai",
      confidence: row.confidence,
      confidenceLevel: level,
      needsReview: level === "low" || level === "medium",
      verifiedByUser: level === "high",
      lockedText: true,
      visibleOnCard: true,
      evidence: "visible_on_image",
    });
  }

  if (analysis.brandGuess) {
    push({
      label: "Бренд",
      value: analysis.brandGuess,
      type: "detail",
      source: "vision_ai",
      confidence: analysis.confidence,
      confidenceLevel: confidenceLevelFromNumeric(analysis.confidence),
      needsReview: false,
      verifiedByUser: true,
      lockedText: true,
      visibleOnCard: true,
      evidence: "visible_on_image",
    });
  }

  if (analysis.materialGuess) {
    const level = confidenceLevelFromNumeric(analysis.confidence);
    push({
      label: "Материал",
      value: analysis.materialGuess,
      type: "material",
      source: "vision_ai",
      confidence: analysis.confidence,
      confidenceLevel: level,
      needsReview: level !== "high",
      verifiedByUser: level === "high",
      lockedText: true,
      visibleOnCard: true,
      evidence: "visible_on_image",
    });
  }

  for (const line of analysis.visibleText) {
    push({
      label: "Текст на упаковке",
      value: line,
      type: "detail",
      source: "vision_ai",
      confidence: 0.85,
      confidenceLevel: "high",
      needsReview: false,
      verifiedByUser: true,
      lockedText: true,
      visibleOnCard: true,
      evidence: "visible_on_image",
    });
  }

  for (const claim of analysis.visibleClaims) {
    push({
      label: "Заявление на упаковке",
      value: claim,
      type: "detail",
      source: "vision_ai",
      confidence: 0.7,
      confidenceLevel: "medium",
      needsReview: true,
      verifiedByUser: false,
      lockedText: true,
      visibleOnCard: false,
      evidence: "visible_on_image",
    });
  }

  return out.slice(0, 24);
}
