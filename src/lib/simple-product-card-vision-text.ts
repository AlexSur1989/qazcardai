import { SIMPLE_CARD_USER_TEXT_MAX } from "@/config/simple-product-card";

export type SimpleCardVisionSuggestions = {
  productLabel: string;
  suggestedUserText: string;
};

export type SimpleCardVisionAnalysisInput = {
  productNameGuess?: string;
  brandGuess?: string | null;
  productType?: string;
  materialGuess?: string | null;
  visibleText?: string[];
  visibleClaims?: string[];
  suggestedProductFacts?: Array<{
    label: string;
    value: string;
    type: string;
    confidence: number;
  }>;
};

function buildProductLabel(analysis: Pick<
  SimpleCardVisionAnalysisInput,
  "productNameGuess" | "brandGuess" | "productType"
>): string {
  const name = analysis.productNameGuess?.trim() ?? "";
  const brand = analysis.brandGuess?.trim() ?? "";
  if (name && brand && !name.toLowerCase().includes(brand.toLowerCase())) {
    return `${brand} ${name}`.trim().slice(0, 200);
  }
  return (name || brand || analysis.productType?.trim() || "").slice(0, 200);
}

function pushUniqueLine(lines: string[], seen: Set<string>, line: string, exclude?: string) {
  const trimmed = line.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  if (seen.has(key)) return;
  if (exclude && key === exclude.toLowerCase()) return;
  seen.add(key);
  lines.push(trimmed);
}

/** Vision → название товара и черновик текста для карточки (только по видимому на фото). */
export function visionAnalysisToSimpleCardSuggestions(
  analysis: SimpleCardVisionAnalysisInput,
  maxLength = SIMPLE_CARD_USER_TEXT_MAX,
): SimpleCardVisionSuggestions {
  const productLabel = buildProductLabel(analysis);
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const row of analysis.suggestedProductFacts ?? []) {
    if (row.confidence < 0.45) continue;
    const value = row.value.trim();
    if (!value) continue;
    if (row.type === "product_purpose" || row.type === "feature" || row.type === "detail") {
      pushUniqueLine(lines, seen, value, productLabel);
      continue;
    }
    if (row.type === "dimension" || row.type === "material" || row.type === "package") {
      const phrase = row.label.trim() ? `${row.label.trim()}: ${value}` : value;
      pushUniqueLine(lines, seen, phrase, productLabel);
    }
  }

  for (const claim of analysis.visibleClaims ?? []) {
    pushUniqueLine(lines, seen, claim, productLabel);
  }

  for (const text of analysis.visibleText ?? []) {
    if (text.length < 4 || text.length > 120) continue;
    pushUniqueLine(lines, seen, text, productLabel);
  }

  if (analysis.materialGuess?.trim()) {
    pushUniqueLine(lines, seen, `Материал: ${analysis.materialGuess.trim()}`, productLabel);
  }

  if (lines.length === 0 && analysis.productType?.trim()) {
    pushUniqueLine(lines, seen, analysis.productType.trim(), productLabel);
  }

  let suggestedUserText = lines.join("\n");
  if (suggestedUserText.length > maxLength) {
    suggestedUserText = suggestedUserText.slice(0, maxLength).trim();
  }

  return { productLabel, suggestedUserText };
}

/** Объединяет название товара и пользовательский текст для промпта генерации. */
export function mergeSimpleCardProductLabelIntoUserText(
  productLabel: string | null | undefined,
  userText: string,
): string {
  const label = productLabel?.trim() ?? "";
  const text = userText.trim();
  if (!label) return text;
  if (!text) return label;
  const firstLine = text.split(/\n/)[0]?.trim().toLowerCase() ?? "";
  if (firstLine === label.toLowerCase()) return text;
  return `${label}\n${text}`.trim();
}
