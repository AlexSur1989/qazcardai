import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";

export const CARD_BUILDER_PRODUCT_FACT_TYPES = [
  "benefit",
  "product_purpose",
  "material",
  "dimension",
  "usage",
  "detail",
  "package",
  "feature",
  "ingredient",
  "effect",
  "compatibility",
  "care",
  "other",
] as const;

export type CardBuilderProductFactType = (typeof CARD_BUILDER_PRODUCT_FACT_TYPES)[number];

export const CARD_BUILDER_PRODUCT_FACT_SOURCES = [
  "vision_ai",
  "web_suggested",
  "user",
  "category_field",
] as const;

export type CardBuilderProductFactSource =
  (typeof CARD_BUILDER_PRODUCT_FACT_SOURCES)[number];

export const CARD_BUILDER_FACT_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export type CardBuilderFactConfidenceLevel =
  (typeof CARD_BUILDER_FACT_CONFIDENCE_LEVELS)[number];

export const CARD_BUILDER_FACT_EVIDENCE_KINDS = [
  "visible_on_image",
  "web_page",
  "user_input",
] as const;

export type CardBuilderFactEvidenceKind =
  (typeof CARD_BUILDER_FACT_EVIDENCE_KINDS)[number];

export type CardBuilderProductFact = {
  /** Стабильный ключ fact (slug), опционально. */
  key?: string;
  id: string;
  label: string;
  value: string;
  type: CardBuilderProductFactType;
  visibleOnCard?: boolean;
  lockedText?: boolean;
  source: CardBuilderProductFactSource;
  /** 0..1 legacy numeric confidence from vision. */
  confidence?: number;
  confidenceLevel?: CardBuilderFactConfidenceLevel;
  needsReview?: boolean;
  verifiedByUser?: boolean;
  evidence?: CardBuilderFactEvidenceKind;
  evidenceUrl?: string;
  evidenceTitle?: string;
};

const LOW_CONFIDENCE_THRESHOLD = 0.55;

export function confidenceLevelFromNumeric(n: number): CardBuilderFactConfidenceLevel {
  if (n >= 0.75) return "high";
  if (n >= 0.55) return "medium";
  return "low";
}

export function numericConfidenceFromLevel(
  level: CardBuilderFactConfidenceLevel | undefined,
): number | undefined {
  if (!level) return undefined;
  if (level === "high") return 0.85;
  if (level === "medium") return 0.65;
  return 0.4;
}

export function isWebSuggestedFact(fact: CardBuilderProductFact): boolean {
  return fact.source === "web_suggested";
}

export function productFactSourceLabel(source: CardBuilderProductFactSource): string {
  switch (source) {
    case "vision_ai":
      return "С фото";
    case "web_suggested":
      return "Найдено в интернете";
    case "user":
      return "Добавлено вами";
    case "category_field":
      return "Категория";
    default:
      return source;
  }
}

export function newProductFactId(): string {
  return `pf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function sanitizeProductFact(raw: unknown): CardBuilderProductFact | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 120) : "";
  const value = typeof o.value === "string" ? o.value.trim().slice(0, 400) : "";
  if (!label || !value) return null;
  const typeRaw = typeof o.type === "string" ? o.type.trim() : "other";
  const type = (CARD_BUILDER_PRODUCT_FACT_TYPES as readonly string[]).includes(typeRaw)
    ? (typeRaw as CardBuilderProductFactType)
    : "other";
  const sourceRaw = typeof o.source === "string" ? o.source.trim() : "user";
  const source = (CARD_BUILDER_PRODUCT_FACT_SOURCES as readonly string[]).includes(sourceRaw)
    ? (sourceRaw as CardBuilderProductFactSource)
    : "user";
  const id =
    typeof o.id === "string" && o.id.trim().length >= 4
      ? o.id.trim().slice(0, 64)
      : newProductFactId();
  const key =
    typeof o.key === "string" && o.key.trim().length >= 2
      ? o.key.trim().slice(0, 64)
      : undefined;
  let confidence: number | undefined;
  if (typeof o.confidence === "number" && Number.isFinite(o.confidence)) {
    confidence = Math.min(1, Math.max(0, o.confidence));
  }
  let confidenceLevel: CardBuilderFactConfidenceLevel | undefined;
  if (
    typeof o.confidenceLevel === "string" &&
    (CARD_BUILDER_FACT_CONFIDENCE_LEVELS as readonly string[]).includes(o.confidenceLevel)
  ) {
    confidenceLevel = o.confidenceLevel as CardBuilderFactConfidenceLevel;
  } else if (confidence != null) {
    confidenceLevel = confidenceLevelFromNumeric(confidence);
  }
  const evidenceRaw = typeof o.evidence === "string" ? o.evidence.trim() : "";
  const evidence = (CARD_BUILDER_FACT_EVIDENCE_KINDS as readonly string[]).includes(
    evidenceRaw,
  )
    ? (evidenceRaw as CardBuilderFactEvidenceKind)
    : source === "vision_ai"
      ? "visible_on_image"
      : source === "user"
        ? "user_input"
        : undefined;
  const evidenceUrl =
    typeof o.evidenceUrl === "string" && o.evidenceUrl.trim()
      ? o.evidenceUrl.trim().slice(0, 2048)
      : undefined;
  const evidenceTitle =
    typeof o.evidenceTitle === "string" && o.evidenceTitle.trim()
      ? o.evidenceTitle.trim().slice(0, 200)
      : undefined;
  const verifiedByUser = o.verifiedByUser === true;
  const needsReview =
    o.needsReview === true ||
    (source === "web_suggested" && !verifiedByUser) ||
    (source === "vision_ai" &&
      confidenceLevel === "low") ||
    (source === "vision_ai" && confidence != null && confidence < LOW_CONFIDENCE_THRESHOLD);
  return {
    key,
    id,
    label,
    value,
    type,
    visibleOnCard: o.visibleOnCard !== false,
    lockedText: o.lockedText !== false,
    source,
    confidence,
    confidenceLevel,
    needsReview,
    verifiedByUser: verifiedByUser || source === "user" || source === "category_field",
    evidence,
    evidenceUrl,
    evidenceTitle,
  };
}

export function normalizeProductFactsList(raw: unknown): CardBuilderProductFact[] {
  if (!Array.isArray(raw)) return [];
  const out: CardBuilderProductFact[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const f = sanitizeProductFact(row);
    if (!f) continue;
    const key = `${f.label.toLowerCase()}|${f.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
    if (out.length >= 32) break;
  }
  return out;
}

const SLIDE_FACT_TYPES: Partial<Record<CardBuilderTemplateSlideRole, CardBuilderProductFactType[]>> =
  {
    main_photo: ["product_purpose"],
    benefits_infographic: ["benefit", "feature"],
    detail_closeup: ["detail", "feature"],
    materials: ["material"],
    dimensions: ["dimension"],
    lifestyle: ["usage", "product_purpose"],
    packaging: ["package"],
    premium_poster: ["benefit", "feature", "product_purpose"],
    ad_banner: ["benefit", "feature"],
  };

export function productFactsForSlideRole(
  facts: readonly CardBuilderProductFact[],
  slideRole: CardBuilderTemplateSlideRole,
): CardBuilderProductFact[] {
  const allowed = SLIDE_FACT_TYPES[slideRole] ?? ["other", "detail"];
  return facts.filter(
    (f) =>
      f.visibleOnCard !== false &&
      (allowed.includes(f.type) || (slideRole === "benefits_infographic" && f.type === "other")),
  );
}

/** Есть ли видимые преимущества для слайда benefits_infographic. */
export function hasBenefitProductFacts(facts: readonly CardBuilderProductFact[]): boolean {
  return facts.some(
    (f) =>
      f.type === "benefit" &&
      f.visibleOnCard !== false &&
      f.value.trim().length > 0,
  );
}

export const CARD_BUILDER_PRODUCT_FACT_TYPE_LABELS: Record<CardBuilderProductFactType, string> = {
  benefit: "Преимущество",
  product_purpose: "Назначение / описание товара",
  material: "Материал",
  dimension: "Размер / объём / вес",
  usage: "Использование",
  detail: "Деталь",
  package: "Упаковка / комплект",
  feature: "Функция",
  ingredient: "Состав",
  effect: "Эффект",
  compatibility: "Совместимость",
  care: "Уход",
  other: "Другое",
};

export function benefitLinesFromProductFacts(
  facts: readonly CardBuilderProductFact[],
): string[] {
  return facts
    .filter((f) => f.type === "benefit" && f.value.trim())
    .map((f) => f.value.trim());
}

export function benefitTextareaValue(facts: readonly CardBuilderProductFact[]): string {
  return benefitLinesFromProductFacts(facts).join("\n");
}

/** Заменяет benefit-факты строками из textarea; остальные facts не трогает. */
export function mergeBenefitFactsFromTextarea(
  facts: readonly CardBuilderProductFact[],
  textarea: string,
): CardBuilderProductFact[] {
  const others = facts.filter((f) => f.type !== "benefit");
  const lines: string[] = [];
  for (const part of textarea.split(/\r?\n/)) {
    const v = part.trim();
    if (!v) continue;
    lines.push(v.slice(0, 400));
    if (lines.length >= 12) break;
  }
  const benefits: CardBuilderProductFact[] = lines.map((value) => ({
    id: newProductFactId(),
    label: "Преимущество",
    value,
    type: "benefit",
    source: "user",
    visibleOnCard: true,
    lockedText: true,
  }));
  return [...others, ...benefits];
}

export function nonBenefitProductFacts(
  facts: readonly CardBuilderProductFact[],
): CardBuilderProductFact[] {
  return facts.filter((f) => f.type !== "benefit");
}

export function productPurposeTextareaValue(facts: readonly CardBuilderProductFact[]): string {
  return facts
    .filter((f) => f.type === "product_purpose" && f.value.trim())
    .map((f) => f.value.trim())
    .join("\n");
}

/** Заменяет product_purpose-факты одной строкой из textarea «Краткое описание»; остальные facts не трогает. */
export function mergeProductPurposeFromTextarea(
  facts: readonly CardBuilderProductFact[],
  textarea: string,
): CardBuilderProductFact[] {
  const others = facts.filter((f) => f.type !== "product_purpose");
  const line = textarea
    .split(/\r?\n/)
    .map((p) => p.trim())
    .find(Boolean);
  if (!line) return others;
  const purpose: CardBuilderProductFact = {
    id: newProductFactId(),
    label: "Назначение",
    value: line.slice(0, 400),
    type: "product_purpose",
    source: "user",
    visibleOnCard: true,
    lockedText: true,
  };
  return [...others, purpose];
}

/** Назначение/описание товара — не benefit и не usage. */
export function isProductPurposeFact(fact: CardBuilderProductFact): boolean {
  return fact.type === "product_purpose";
}

export function hasDimensionProductFacts(facts: readonly CardBuilderProductFact[]): boolean {
  return facts.some(
    (f) => f.type === "dimension" && f.visibleOnCard !== false && f.value.trim().length > 0,
  );
}

export function hasPackageProductFacts(facts: readonly CardBuilderProductFact[]): boolean {
  return facts.some(
    (f) => f.type === "package" && f.visibleOnCard !== false && f.value.trim().length > 0,
  );
}

export function lockedTextPhrasesFromFacts(
  facts: readonly CardBuilderProductFact[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const f of facts) {
    if (f.lockedText === false || !f.value.trim()) continue;
    const v = f.value.trim();
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function benefitLinesFromFacts(facts: readonly CardBuilderProductFact[]): string[] {
  return productFactsForSlideRole(facts, "benefits_infographic")
    .filter((f) => f.lockedText !== false)
    .map((f) => f.value.trim())
    .filter(Boolean);
}
