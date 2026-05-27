import type { SimpleProductCardCreativityBand } from "@/config/simple-product-card-prompts-defaults";
import { SIMPLE_CARD_CREATIVITY_DEFAULT } from "@/config/simple-product-card";

export function creativityInstructionFromValue(
  value: number | null | undefined,
  bands: readonly SimpleProductCardCreativityBand[],
): string {
  const v = Number.isFinite(value) ? Math.round(value as number) : SIMPLE_CARD_CREATIVITY_DEFAULT;
  const clamped = Math.max(0, Math.min(100, v));
  const band =
    bands.find((b) => clamped >= b.min && clamped <= b.max) ?? bands[Math.floor(bands.length / 2)];
  return band?.instruction ?? bands[0]!.instruction;
}

export type DimensionSpecEntry = {
  label: string;
  value: string;
  raw: string;
};

export type SimpleCardSemanticText = {
  headline: string | null;
  subtitle: string | null;
  benefits: string[];
  dimensions: DimensionSpecEntry[];
  specs: DimensionSpecEntry[];
  materials: string[];
  packageKit: string[];
  usage: string[];
  offerPromo: string[];
  otherText: string[];
  raw: string;
  hasDimensionsOrSpecs: boolean;
};

/** @deprecated use SimpleCardSemanticText */
export type StructuredUserText = {
  headline: string | null;
  subtitle: string | null;
  keyPhrases: string[];
  raw: string;
};

type SegmentKind =
  | "dimension"
  | "spec"
  | "material"
  | "package"
  | "usage"
  | "offer"
  | "benefit";

type ClassifiedSegment = {
  kind: SegmentKind;
  raw: string;
  entry?: DimensionSpecEntry;
};

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const UNIT = String.raw`(?:см|cm|мм|mm|м|m|мл|ml|л|l|кг|kg|г|g|кВт|kW|Вт|W|Вт\.|шт\.?|pcs?)`;

const DIMENSION_RULES: Array<{ label: string; re: RegExp }> = [
  {
    label: "Size (WxH)",
    re: new RegExp(`^(?:размер|size)\\s*[:\\-]?\\s*(${NUM}\\s*[×xXх*\\*]\\s*${NUM}\\s*${UNIT})`, "iu"),
  },
  { label: "Height", re: /^(?:высота|height)\s*[:\-]?\s*(.+)$/iu },
  { label: "Width", re: /^(?:ширина|width)\s*[:\-]?\s*(.+)$/iu },
  { label: "Depth", re: /^(?:глубина|depth)\s*[:\-]?\s*(.+)$/iu },
  { label: "Length", re: /^(?:длина(?:\s+кабеля|\s+изделия|\s+товара)?|length)\s*[:\-]?\s*(.+)$/iu },
  { label: "Diameter", re: /^(?:диаметр|diameter)\s*[:\-]?\s*(.+)$/iu },
  { label: "Thickness", re: /^(?:толщина|thickness)\s*[:\-]?\s*(.+)$/iu },
  { label: "Format", re: /^(?:формат|format)\s*[:\-]?\s*(.+)$/iu },
  {
    label: "Clothing size",
    re: /^(?:размер\s+(?:одежды|обуви)?|size)\s*[:\-]?\s*([SMLXxl\d]+(?:\s*[/\\]\s*[SMLXxl\d]+)*)$/iu,
  },
];

const SPEC_RULES: Array<{ label: string; re: RegExp }> = [
  { label: "Volume", re: /^(?:объ[её]м|volume)\s*[:\-]?\s*(.+)$/iu },
  { label: "Weight", re: /^(?:вес|weight|масса)\s*[:\-]?\s*(.+)$/iu },
  { label: "Capacity", re: /^(?:вместимость|capacity)\s*[:\-]?\s*(.+)$/iu },
  { label: "Power", re: /^(?:мощность|power)\s*[:\-]?\s*(.+)$/iu },
];

const INLINE_DIMENSION = new RegExp(
  `(?:размер|size)\\s*[:\\-]?\\s*(${NUM}\\s*[×xXх*\\*]\\s*${NUM}\\s*${UNIT})|` +
    `(?:высота|height)\\s*[:\\-]?\\s*(${NUM}\\s*${UNIT})|` +
    `(?:ширина|width)\\s*[:\\-]?\\s*(${NUM}\\s*${UNIT})|` +
    `(?:глубина|depth)\\s*[:\\-]?\\s*(${NUM}\\s*${UNIT})|` +
    `(?:диаметр|diameter)\\s*[:\\-]?\\s*(${NUM}\\s*${UNIT})|` +
    `(?:длина|length)\\s*[:\\-]?\\s*(${NUM}\\s*${UNIT})|` +
    `(?:толщина|thickness)\\s*[:\\-]?\\s*(${NUM}\\s*${UNIT})`,
  "iu",
);

const INLINE_SPEC = new RegExp(
  `(?:объ[её]м|volume)\\s*[:\\-]?\\s*(${NUM}\\s*${UNIT})|` +
    `(?:вес|weight|масса)\\s*[:\\-]?\\s*(${NUM}\\s*${UNIT})|` +
    `(?:вместимость|capacity)\\s*[:\\-]?\\s*(${NUM}\\s*${UNIT})|` +
    `(?:мощность|power)\\s*[:\\-]?\\s*(${NUM}\\s*(?:${UNIT}|Вт|W|кВт|kW))|` +
    `(${NUM}\\s*(?:мл|ml|л|l|кг|kg|г|g|Вт|W|кВт|kW))`,
  "iu",
);

const MATERIAL_RE = /^(?:материал|material|из\s+[а-яёa-z])/iu;
const PACKAGE_RE = /^(?:комплект|набор|в\s+упаковке|состав\s+набора|kit|set|bundle)/iu;
const USAGE_RE = /^(?:для\s+|подходит\s+|использован|применени|идеален\s+для)/iu;
const OFFER_RE = /^(?:скидк|акци|промо|%-?\s*off|распродаж)/iu;

function splitSegments(text: string): string[] {
  return text
    .split(/\r?\n|[•·]|;\s*|,\s+|\.\s+/)
    .map((s) => s.replace(/^[\s\-–—*]+/, "").trim())
    .filter(Boolean);
}

function extractInlineDimension(segment: string): DimensionSpecEntry | null {
  const sizeMatch = segment.match(
    new RegExp(`(?:размер|size)\\s*[:\\-]?\\s*(${NUM}\\s*[×xXх*\\*]\\s*${NUM}\\s*${UNIT})`, "iu"),
  );
  if (sizeMatch?.[1]) {
    return { label: "Size (WxH)", value: sizeMatch[1].trim(), raw: segment };
  }
  for (const rule of DIMENSION_RULES) {
    const m = segment.match(rule.re);
    if (m?.[1]) {
      return { label: rule.label, value: m[1].trim(), raw: segment };
    }
  }
  if (INLINE_DIMENSION.test(segment)) {
    const cleaned = segment.match(INLINE_DIMENSION)?.[0]?.trim();
    if (cleaned) return { label: "Dimension", value: cleaned, raw: segment };
  }
  return null;
}

function extractInlineSpec(segment: string): DimensionSpecEntry | null {
  for (const rule of SPEC_RULES) {
    const m = segment.match(rule.re);
    if (m?.[1]) {
      return { label: rule.label, value: m[1].trim(), raw: segment };
    }
  }
  const inline = segment.match(INLINE_SPEC);
  if (inline) {
    const val = inline.slice(1).find(Boolean)?.trim();
    if (val) {
      let label = "Spec";
      if (/мл|ml|л|l/i.test(val) && !/кг|kg|г|g/i.test(val)) label = "Volume";
      else if (/кг|kg|г|g/i.test(val)) label = "Weight";
      else if (/Вт|W|кВт|kW/i.test(val)) label = "Power";
      return { label, value: val, raw: segment };
    }
  }
  return null;
}

function classifySegment(segment: string): ClassifiedSegment {
  for (const rule of DIMENSION_RULES) {
    const m = segment.match(rule.re);
    if (m?.[1]) {
      return {
        kind: "dimension",
        raw: segment,
        entry: { label: rule.label, value: m[1].trim(), raw: segment },
      };
    }
  }
  const inlineDim = extractInlineDimension(segment);
  if (inlineDim) return { kind: "dimension", raw: segment, entry: inlineDim };

  for (const rule of SPEC_RULES) {
    const m = segment.match(rule.re);
    if (m?.[1]) {
      return {
        kind: "spec",
        raw: segment,
        entry: { label: rule.label, value: m[1].trim(), raw: segment },
      };
    }
  }
  const inlineSpec = extractInlineSpec(segment);
  if (inlineSpec) return { kind: "spec", raw: segment, entry: inlineSpec };

  if (MATERIAL_RE.test(segment)) return { kind: "material", raw: segment };
  if (PACKAGE_RE.test(segment)) return { kind: "package", raw: segment };
  if (USAGE_RE.test(segment)) return { kind: "usage", raw: segment };
  if (OFFER_RE.test(segment)) return { kind: "offer", raw: segment };
  return { kind: "benefit", raw: segment };
}

function isDimensionOrSpecSegment(segment: string): boolean {
  const c = classifySegment(segment);
  return c.kind === "dimension" || c.kind === "spec";
}

function dedupeEntries(entries: DimensionSpecEntry[]): DimensionSpecEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.label.toLowerCase()}::${e.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Парсит свободный текст пользователя на смысловые блоки без выдумывания новых фраз.
 */
export function parseSimpleCardUserText(userText: string, maxBenefits: number): SimpleCardSemanticText {
  const raw = userText.trim();
  const segments = splitSegments(raw);

  const empty: SimpleCardSemanticText = {
    headline: null,
    subtitle: null,
    benefits: [],
    dimensions: [],
    specs: [],
    materials: [],
    packageKit: [],
    usage: [],
    offerPromo: [],
    otherText: [],
    raw,
    hasDimensionsOrSpecs: false,
  };

  if (segments.length === 0) return empty;

  const classified = segments.map(classifySegment);
  let headline: string | null = null;
  let subtitle: string | null = null;
  let idx = 0;

  while (idx < classified.length && !headline) {
    const c = classified[idx]!;
    if (c.kind === "benefit" || c.kind === "usage") {
      headline = c.raw;
      idx += 1;
      break;
    }
    if (c.kind === "dimension" || c.kind === "spec") break;
    headline = c.raw;
    idx += 1;
    break;
  }

  while (idx < classified.length && !subtitle) {
    const c = classified[idx]!;
    if (c.kind === "dimension" || c.kind === "spec") break;
    if (c.kind === "benefit" || c.kind === "usage") {
      if (c.raw.length <= 120 && c.raw.split(/\s+/).length <= 16) {
        subtitle = c.raw;
        idx += 1;
        break;
      }
      break;
    }
    break;
  }

  const dimensions: DimensionSpecEntry[] = [];
  const specs: DimensionSpecEntry[] = [];
  const materials: string[] = [];
  const packageKit: string[] = [];
  const usage: string[] = [];
  const offerPromo: string[] = [];
  const benefits: string[] = [];
  const otherText: string[] = [];

  for (let i = idx; i < classified.length; i++) {
    const c = classified[i]!;
    switch (c.kind) {
      case "dimension":
        if (c.entry) dimensions.push(c.entry);
        break;
      case "spec":
        if (c.entry) specs.push(c.entry);
        break;
      case "material":
        materials.push(c.raw);
        break;
      case "package":
        packageKit.push(c.raw);
        break;
      case "usage":
        usage.push(c.raw);
        break;
      case "offer":
        offerPromo.push(c.raw);
        break;
      case "benefit":
        if (c.raw !== headline && c.raw !== subtitle) benefits.push(c.raw);
        break;
      default:
        otherText.push(c.raw);
    }
  }

  for (let i = 0; i < idx; i++) {
    const c = classified[i]!;
    if (c.kind === "dimension" && c.entry) dimensions.push(c.entry);
    if (c.kind === "spec" && c.entry) specs.push(c.entry);
  }

  if (headline && isDimensionOrSpecSegment(headline)) {
    const c = classifySegment(headline);
    if (c.entry) {
      if (c.kind === "dimension") dimensions.unshift(c.entry);
      else specs.unshift(c.entry);
    }
    headline = benefits.shift() ?? null;
  }

  return {
    headline,
    subtitle,
    benefits: benefits.slice(0, maxBenefits),
    dimensions: dedupeEntries(dimensions),
    specs: dedupeEntries(specs),
    materials,
    packageKit,
    usage,
    offerPromo,
    otherText,
    raw,
    hasDimensionsOrSpecs: dimensions.length > 0 || specs.length > 0,
  };
}

export function hasDimensionsOrSpecs(parsed: SimpleCardSemanticText): boolean {
  return parsed.hasDimensionsOrSpecs;
}

export function formatConfirmedDimensionsBlock(parsed: SimpleCardSemanticText): string | null {
  const lines: string[] = [];
  for (const d of parsed.dimensions) {
    lines.push(`- ${d.label}: ${d.value}`);
  }
  for (const s of parsed.specs) {
    lines.push(`- ${s.label}: ${s.value}`);
  }
  if (!lines.length) return null;
  return `CONFIRMED DIMENSIONS / SPECS:\n${lines.join("\n")}`;
}

export const NO_DIMENSIONS_RULE =
  "No confirmed dimensions were provided. Do not create measurement lines or numeric specs.";

/** @deprecated use parseSimpleCardUserText */
export function structureSimpleCardUserText(
  userText: string,
  maxKeyPhrases: number,
): StructuredUserText {
  const parsed = parseSimpleCardUserText(userText, maxKeyPhrases);
  return {
    headline: parsed.headline,
    subtitle: parsed.subtitle,
    keyPhrases: parsed.benefits,
    raw: parsed.raw,
  };
}

export function formatStructuredUserTextForPrompt(parsed: SimpleCardSemanticText): string {
  const lines: string[] = [];
  if (parsed.headline) lines.push(`Headline: ${parsed.headline}`);
  if (parsed.subtitle) lines.push(`Subtitle: ${parsed.subtitle}`);
  if (parsed.benefits.length) {
    lines.push("Benefits:");
    for (const p of parsed.benefits) lines.push(`- ${p}`);
  }
  if (parsed.materials.length) {
    lines.push("Materials:");
    for (const p of parsed.materials) lines.push(`- ${p}`);
  }
  if (parsed.packageKit.length) {
    lines.push("Package / kit:");
    for (const p of parsed.packageKit) lines.push(`- ${p}`);
  }
  if (parsed.usage.length) {
    lines.push("Usage:");
    for (const p of parsed.usage) lines.push(`- ${p}`);
  }
  if (parsed.offerPromo.length) {
    lines.push("Offer / promo:");
    for (const p of parsed.offerPromo) lines.push(`- ${p}`);
  }
  if (parsed.otherText.length) {
    lines.push("Other text:");
    for (const p of parsed.otherText) lines.push(`- ${p}`);
  }
  if (!lines.length) lines.push(parsed.raw);
  return lines.join("\n");
}

export function exactTextPhrasesFromSemantic(parsed: SimpleCardSemanticText): string[] {
  const out: string[] = [];
  if (parsed.headline?.trim()) out.push(parsed.headline.trim());
  if (parsed.subtitle?.trim()) out.push(parsed.subtitle.trim());
  for (const p of parsed.benefits) {
    const t = p.trim();
    if (t) out.push(t);
  }
  for (const d of [...parsed.dimensions, ...parsed.specs]) {
    out.push(`${d.label}: ${d.value}`);
  }
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** @deprecated */
export function exactTextPhrasesFromStructured(structured: StructuredUserText): string[] {
  return exactTextPhrasesFromSemantic({
    headline: structured.headline,
    subtitle: structured.subtitle,
    benefits: structured.keyPhrases,
    dimensions: [],
    specs: [],
    materials: [],
    packageKit: [],
    usage: [],
    offerPromo: [],
    otherText: [],
    raw: structured.raw,
    hasDimensionsOrSpecs: false,
  });
}
