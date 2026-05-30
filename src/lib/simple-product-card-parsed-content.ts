/**
 * Парсер свободного userText → structured content для MEGA PROMPT (simple product card).
 * Не выдумывает факты — только классифицирует то, что написал клиент.
 */

export type SimpleProductCardMeasurements = {
  width?: string;
  height?: string;
  depth?: string;
  length?: string;
  diameter?: string;
  thickness?: string;
};

export type SimpleProductCardSpecs = {
  volume?: string;
  weight?: string;
  power?: string;
  capacity?: string;
  battery?: string;
  memory?: string;
  connectivity?: string[];
  compatibility?: string[];
  other?: string[];
};

export type SimpleProductCardOffer = {
  price?: string;
  discount?: string;
  promo?: string;
  deadline?: string;
  gift?: string;
};

export type SimpleProductCardParsedContent = {
  headline?: string;
  subtitle?: string;
  benefits: string[];
  measurements: SimpleProductCardMeasurements;
  specs: SimpleProductCardSpecs;
  materials: string[];
  packageContents: string[];
  usageSteps: string[];
  targetAudience: string[];
  offer: SimpleProductCardOffer;
  delivery: string[];
  warrantyTrust: string[];
  warnings: string[];
  otherPhrases: string[];
};

export type SimpleProductCardParseLimits = {
  maxBenefits: number;
  maxSpecs: number;
  maxPackageItems: number;
  maxUsageSteps: number;
  maxTargetAudience: number;
  maxDelivery: number;
  maxWarrantyTrust: number;
  maxOtherPhrases: number;
};

export const SIMPLE_CARD_PARSE_DEFAULT_LIMITS: SimpleProductCardParseLimits = {
  maxBenefits: 3,
  maxSpecs: 4,
  maxPackageItems: 4,
  maxUsageSteps: 3,
  maxTargetAudience: 3,
  maxDelivery: 2,
  maxWarrantyTrust: 2,
  maxOtherPhrases: 2,
};

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const UNIT = String.raw`(см|cm|мм|mm|м|m|мл|ml|л|l|кг|kg|г|g|кВт|kW|Вт|W|Вт\.|шт\.?|pcs?|mAh|МБ|MB|ГБ|GB|ТБ|TB|Hz|Гц|V|В)`;

type SegmentKind =
  | "headline_candidate"
  | "subtitle_candidate"
  | "benefit"
  | "measurement"
  | "spec"
  | "material"
  | "package"
  | "usage"
  | "target_audience"
  | "offer"
  | "delivery"
  | "warranty"
  | "other";

type ParsedSegment = {
  kind: SegmentKind;
  raw: string;
  consumed: boolean;
};

const BENEFIT_HINTS =
  /(?:удобн|лёгк|легк|прочн|стильн|современ|компакт|крут|мягк|практич|надёжн|надежн|не\s+боится|легко\s+чист|быстро\s+заряж|подходит\s+каждый|экономит|премиальн|нежн(?:ая|ый|ое)?\s+текстур|прочный\s+корпус|ежедневн)/iu;

const DELIVERY_RE =
  /(?:доставк|самовывоз|курьер|быстрая\s+отправк|shipping|delivery)/iu;

const WARRANTY_RE =
  /(?:гарант|сертификат|оригинал|официальн(?:ый|ая|ое)?\s+товар|проверен|качество\s+подтверж|100%\s*оригинал|trust|warranty)/iu;

const TARGET_AUDIENCE_RE =
  /^(?:для\s+(?:детей|взрослых|дома|кухни|автомобил|спорт|школ|офис|подарк|путешеств|ежедневн|уход|игр|playstation|телефон|ноутбук)|для\s+[а-яёa-z\s]{2,40})$/iu;

const PACKAGE_RE =
  /(?:в\s+комплекте|комплект(?:ация)?|набор|в\s+наборе|included|bundle|комплектация)/iu;

const USAGE_STEP_RE =
  /(?:нанесите|подключите|зарядите|закрепите|установите|используйте|промойте|включите|откройте|способ\s+применени|инструкци|подключите\s+через)/iu;

const OFFER_PRICE_RE = /(?:цена|price|стоимость)\s*[:\-]?\s*(\d[\d\s.,]*\s*(?:₸|тг|тенге|kzt|₽|руб)?)/iu;
const OFFER_DISCOUNT_RE = /(?:скидк|discount|-\s*\d+\s*%|\d+\s*%\s*(?:скидк|off))/iu;
const OFFER_PROMO_RE = /(?:акци|промокод|promo|sale|special\s+offer|2\s+по\s+цене\s+1)/iu;
const OFFER_DEADLINE_RE = /(?:до\s+конца|до\s+\d|limited\s+time|only\s+today)/iu;
const OFFER_GIFT_RE = /(?:подарок|бесплатный\s+подарок|gift)/iu;

const MATERIAL_WORDS =
  /(?:натуральн(?:ая|ый|ое)?\s+кож|искусственн(?:ая|ый|ое)?\s+кож|экокож|хлопок|100%\s*хлопок|металл|дерев|стекл|силикон|пластик|нержавеющ(?:ая|ий)?\s+стал|керамик|алюмини|ткан)/iu;

const CONNECTIVITY_SPECS =
  /\b(?:bluetooth\s*[\d.]+\s*|usb-?c|type-?c|wi-?fi|4k|60\s*hz|120\s*гц|120\s*hz|12\s*v|220\s*v|hdmi)\b/iu;

function splitSegments(text: string): string[] {
  return text
    .split(/\r?\n|[•·]|;\s*|\.\s+/)
    .map((s) => s.replace(/^[\s\-–—*,]+/, "").trim())
    .filter(Boolean);
}

function parseTripleDimension(
  segment: string,
): { measurements: SimpleProductCardMeasurements; matched: boolean } {
  const triple =
    segment.match(
      new RegExp(
        `(?:размер|size|габарит(?:ы)?)\\s*[:\\-]?\\s*(${NUM})\\s*[×xXх*]\\s*(${NUM})\\s*[×xXх*]\\s*(${NUM})\\s*(${UNIT})`,
        "iu",
      ),
    ) ??
    segment.match(
      new RegExp(`(${NUM})\\s*[×xXх*]\\s*(${NUM})\\s*[×xXх*]\\s*(${NUM})\\s*(${UNIT})`, "iu"),
    ) ??
    segment.match(
      new RegExp(`(${NUM})\\s+на\\s+(${NUM})\\s+на\\s+(${NUM})\\s*(${UNIT})`, "iu"),
    );

  if (triple) {
    const unit = triple[4]!.trim();
    return {
      matched: true,
      measurements: {
        width: `${triple[1]!.replace(",", ".")} ${unit}`,
        height: `${triple[2]!.replace(",", ".")} ${unit}`,
        depth: `${triple[3]!.replace(",", ".")} ${unit}`,
      },
    };
  }

  const double =
    segment.match(
      new RegExp(
        `(?:размер|size|габарит(?:ы)?)\\s*[:\\-]?\\s*(${NUM})\\s*[×xXх*]\\s*(${NUM})\\s*(${UNIT})`,
        "iu",
      ),
    ) ?? segment.match(new RegExp(`(${NUM})\\s*[×xXх*]\\s*(${NUM})\\s*(${UNIT})`, "iu"));

  if (double) {
    const unit = double[3]!.trim();
    return {
      matched: true,
      measurements: {
        width: `${double[1]!.replace(",", ".")} ${unit}`,
        height: `${double[2]!.replace(",", ".")} ${unit}`,
      },
    };
  }

  return { measurements: {}, matched: false };
}

function parseSingleMeasurement(segment: string): SimpleProductCardMeasurements {
  const out: SimpleProductCardMeasurements = {};
  const rules: Array<{ key: keyof SimpleProductCardMeasurements; re: RegExp }> = [
    { key: "width", re: /^(?:ширина|width)\s*[:\-]?\s*(.+)$/iu },
    { key: "height", re: /^(?:высота|height)\s*[:\-]?\s*(.+)$/iu },
    { key: "depth", re: /^(?:глубина|depth)\s*[:\-]?\s*(.+)$/iu },
    { key: "length", re: /^(?:длина(?:\s+кабеля|\s+изделия|\s+товара)?|length)\s*[:\-]?\s*(.+)$/iu },
    { key: "diameter", re: /^(?:диаметр|diameter)\s*[:\-]?\s*(.+)$/iu },
    { key: "thickness", re: /^(?:толщина|thickness)\s*[:\-]?\s*(.+)$/iu },
  ];
  for (const rule of rules) {
    const m = segment.match(rule.re);
    if (m?.[1]?.trim()) out[rule.key] = m[1].trim();
  }
  return out;
}

function parseSpecsFromSegment(segment: string): Partial<SimpleProductCardSpecs> {
  const out: Partial<SimpleProductCardSpecs> = {};
  const rules: Array<{ key: keyof SimpleProductCardSpecs; re: RegExp }> = [
    { key: "volume", re: /^(?:объ[её]м|volume)\s*[:\-]?\s*(.+)$/iu },
    { key: "weight", re: /^(?:вес|weight|масса)\s*[:\-]?\s*(.+)$/iu },
    { key: "capacity", re: /^(?:вместимость|capacity)\s*[:\-]?\s*(.+)$/iu },
    { key: "power", re: /^(?:мощность|power)\s*[:\-]?\s*(.+)$/iu },
    { key: "battery", re: /^(?:батарея|battery|аккумулятор)\s*[:\-]?\s*(.+)$/iu },
    { key: "memory", re: /^(?:память|memory|storage)\s*[:\-]?\s*(.+)$/iu },
  ];
  for (const rule of rules) {
    const m = segment.match(rule.re);
    if (m?.[1]?.trim()) out[rule.key] = m[1].trim() as never;
  }

  const inlineVol = segment.match(new RegExp(`(?:объ[её]м|volume)\\s*[:\\-]?\\s*(${NUM}\\s*${UNIT})`, "iu"));
  if (inlineVol?.[1] && !out.volume) out.volume = inlineVol[1].trim();

  const inlineWeight = segment.match(new RegExp(`(?:вес|weight|масса)\\s*[:\\-]?\\s*(${NUM}\\s*${UNIT})`, "iu"));
  if (inlineWeight?.[1] && !out.weight) out.weight = inlineWeight[1].trim();

  const inlinePower = segment.match(
    new RegExp(`(?:мощность|power)\\s*[:\\-]?\\s*(${NUM}\\s*(?:${UNIT}|Вт|W|кВт|kW))`, "iu"),
  );
  if (inlinePower?.[1] && !out.power) out.power = inlinePower[1].trim();

  if (CONNECTIVITY_SPECS.test(segment)) {
    out.connectivity = [segment.trim()];
  }

  return out;
}

function parseOfferFromSegment(segment: string): Partial<SimpleProductCardOffer> {
  const out: Partial<SimpleProductCardOffer> = {};
  const price = segment.match(OFFER_PRICE_RE);
  if (price?.[1]) out.price = segment.trim();
  if (OFFER_DISCOUNT_RE.test(segment)) out.discount = segment.trim();
  if (OFFER_PROMO_RE.test(segment)) out.promo = segment.trim();
  if (OFFER_DEADLINE_RE.test(segment)) out.deadline = segment.trim();
  if (OFFER_GIFT_RE.test(segment)) out.gift = segment.trim();
  if (/^\d[\d\s.,]*\s*(?:₸|тг|тенге|kzt)/iu.test(segment)) out.price = segment.trim();
  if (/-\s*\d+\s*%|\d+\s*%\s*(?:скидк)?/iu.test(segment) && !out.discount) {
    out.discount = segment.trim();
  }
  return out;
}

function isLikelyHeadline(segment: string): boolean {
  if (segment.length > 80) return false;
  if (DELIVERY_RE.test(segment) || WARRANTY_RE.test(segment) || OFFER_DISCOUNT_RE.test(segment)) {
    return false;
  }
  if (/^(?:размер|объ[её]м|вес|мощность|ширина|высота|глубина|доставк|гарант)/iu.test(segment)) {
    return false;
  }
  return segment.split(/\s+/).length <= 12;
}

function classifySegment(segment: string): SegmentKind {
  if (parseTripleDimension(segment).matched) return "measurement";
  if (Object.keys(parseSingleMeasurement(segment)).length > 0) return "measurement";
  if (Object.keys(parseSpecsFromSegment(segment)).length > 0) return "spec";
  if (DELIVERY_RE.test(segment)) return "delivery";
  if (WARRANTY_RE.test(segment)) return "warranty";
  if (Object.keys(parseOfferFromSegment(segment)).length > 0) return "offer";
  if (PACKAGE_RE.test(segment)) return "package";
  if (USAGE_STEP_RE.test(segment)) return "usage";
  if (TARGET_AUDIENCE_RE.test(segment) || /^для\s+/iu.test(segment)) return "target_audience";
  if (MATERIAL_WORDS.test(segment) || /^(?:материал|material)\s*[:\-]/iu.test(segment)) {
    return "material";
  }
  if (BENEFIT_HINTS.test(segment)) return "benefit";
  return "benefit";
}

function mergeMeasurements(
  base: SimpleProductCardMeasurements,
  patch: SimpleProductCardMeasurements,
): SimpleProductCardMeasurements {
  return { ...base, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v)) };
}

function mergeSpecs(base: SimpleProductCardSpecs, patch: Partial<SimpleProductCardSpecs>): SimpleProductCardSpecs {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (!v) continue;
    const key = k as keyof SimpleProductCardSpecs;
    if (key === "connectivity" || key === "compatibility" || key === "other") {
      const arr = out[key] ?? [];
      const add = Array.isArray(v) ? v : [String(v)];
      out[key] = [...arr, ...add];
    } else if (!out[key]) {
      out[key] = v as never;
    }
  }
  return out;
}

function mergeOffer(base: SimpleProductCardOffer, patch: Partial<SimpleProductCardOffer>): SimpleProductCardOffer {
  return { ...base, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v)) };
}

function pushUnique(list: string[], value: string) {
  const t = value.trim();
  if (!t) return;
  if (list.some((x) => x.toLowerCase() === t.toLowerCase())) return;
  list.push(t);
}

function emptyContent(): SimpleProductCardParsedContent {
  return {
    benefits: [],
    measurements: {},
    specs: { connectivity: [], compatibility: [], other: [] },
    materials: [],
    packageContents: [],
    usageSteps: [],
    targetAudience: [],
    offer: {},
    delivery: [],
    warrantyTrust: [],
    warnings: [],
    otherPhrases: [],
  };
}

export function parseSimpleProductCardContent(
  userText: string,
  limits: Partial<SimpleProductCardParseLimits> = {},
): SimpleProductCardParsedContent {
  const lim = { ...SIMPLE_CARD_PARSE_DEFAULT_LIMITS, ...limits };
  const segments = splitSegments(userText.trim());
  const out = emptyContent();

  if (segments.length === 0) {
    out.headline = "Карточка товара";
    return out;
  }

  let headlineSet = false;
  let subtitleSet = false;

  for (const segment of segments) {
    const triple = parseTripleDimension(segment);
    if (triple.matched) {
      out.measurements = mergeMeasurements(out.measurements, triple.measurements);
      continue;
    }

    const singleMeas = parseSingleMeasurement(segment);
    if (Object.keys(singleMeas).length > 0) {
      out.measurements = mergeMeasurements(out.measurements, singleMeas);
      continue;
    }

    const specs = parseSpecsFromSegment(segment);
    if (Object.keys(specs).length > 0) {
      out.specs = mergeSpecs(out.specs, specs);
      continue;
    }

    const kind = classifySegment(segment);

    if (!headlineSet && kind === "benefit" && isLikelyHeadline(segment)) {
      out.headline = segment;
      headlineSet = true;
      continue;
    }

    if (!subtitleSet && headlineSet && kind === "benefit" && segment.length <= 120) {
      const words = segment.split(/\s+/).length;
      if (words <= 14 && !BENEFIT_HINTS.test(segment)) {
        out.subtitle = segment;
        subtitleSet = true;
        continue;
      }
    }

    switch (kind) {
      case "benefit":
        pushUnique(out.benefits, segment);
        break;
      case "material":
        pushUnique(out.materials, segment);
        break;
      case "package":
        pushUnique(out.packageContents, segment);
        break;
      case "usage":
        pushUnique(out.usageSteps, segment);
        break;
      case "target_audience":
        pushUnique(out.targetAudience, segment);
        break;
      case "delivery":
        pushUnique(out.delivery, segment);
        break;
      case "warranty":
        pushUnique(out.warrantyTrust, segment);
        break;
      case "offer":
        out.offer = mergeOffer(out.offer, parseOfferFromSegment(segment));
        break;
      default:
        pushUnique(out.otherPhrases, segment);
    }
  }

  if (!out.headline) {
    const firstBenefit = out.benefits.shift();
    out.headline = firstBenefit ?? segments[0]?.slice(0, 120) ?? "Карточка товара";
  }

  if (out.subtitle && out.subtitle.toLowerCase() === out.headline?.toLowerCase()) {
    out.subtitle = undefined;
  }

  out.benefits = out.benefits
    .filter((b) => b.toLowerCase() !== out.headline?.toLowerCase())
    .filter((b) => b.toLowerCase() !== out.subtitle?.toLowerCase())
    .slice(0, lim.maxBenefits);

  if (out.specs.connectivity) {
    out.specs.connectivity = out.specs.connectivity.slice(0, lim.maxSpecs);
  }
  const specCount = [
    out.specs.volume,
    out.specs.weight,
    out.specs.power,
    out.specs.capacity,
    out.specs.battery,
    out.specs.memory,
    ...(out.specs.connectivity ?? []),
    ...(out.specs.other ?? []),
  ].filter(Boolean).length;
  if (specCount > lim.maxSpecs) {
    out.warnings.push("Too many specs — some may be omitted in the final card layout.");
  }

  out.packageContents = out.packageContents.slice(0, lim.maxPackageItems);
  out.usageSteps = out.usageSteps.slice(0, lim.maxUsageSteps);
  out.targetAudience = out.targetAudience.slice(0, lim.maxTargetAudience);
  out.delivery = out.delivery.slice(0, lim.maxDelivery);
  out.warrantyTrust = out.warrantyTrust.slice(0, lim.maxWarrantyTrust);
  out.otherPhrases = out.otherPhrases.slice(0, lim.maxOtherPhrases);

  return out;
}

export function hasConfirmedMeasurements(m: SimpleProductCardMeasurements): boolean {
  return Boolean(
    m.width || m.height || m.depth || m.length || m.diameter || m.thickness,
  );
}

export function hasConfirmedSpecs(s: SimpleProductCardSpecs): boolean {
  return Boolean(
    s.volume ||
      s.weight ||
      s.power ||
      s.capacity ||
      s.battery ||
      s.memory ||
      (s.connectivity?.length ?? 0) > 0 ||
      (s.compatibility?.length ?? 0) > 0 ||
      (s.other?.length ?? 0) > 0,
  );
}

function bulletList(items: string[], emptyLabel = "(none)"): string {
  if (!items.length) return emptyLabel;
  return items.map((i) => `- ${i}`).join("\n");
}

function measurementsList(m: SimpleProductCardMeasurements): string {
  const lines: string[] = [];
  if (m.width) lines.push(`- width: ${m.width}`);
  if (m.height) lines.push(`- height: ${m.height}`);
  if (m.depth) lines.push(`- depth: ${m.depth}`);
  if (m.length) lines.push(`- length: ${m.length}`);
  if (m.diameter) lines.push(`- diameter: ${m.diameter}`);
  if (m.thickness) lines.push(`- thickness: ${m.thickness}`);
  return lines.length ? lines.join("\n") : "(none)";
}

function specsList(s: SimpleProductCardSpecs): string {
  const lines: string[] = [];
  if (s.volume) lines.push(`- volume: ${s.volume}`);
  if (s.weight) lines.push(`- weight: ${s.weight}`);
  if (s.power) lines.push(`- power: ${s.power}`);
  if (s.capacity) lines.push(`- capacity: ${s.capacity}`);
  if (s.battery) lines.push(`- battery: ${s.battery}`);
  if (s.memory) lines.push(`- memory: ${s.memory}`);
  for (const c of s.connectivity ?? []) lines.push(`- connectivity: ${c}`);
  for (const c of s.compatibility ?? []) lines.push(`- compatibility: ${c}`);
  for (const o of s.other ?? []) lines.push(`- other: ${o}`);
  return lines.length ? lines.join("\n") : "(none)";
}

function offerList(o: SimpleProductCardOffer): string {
  const lines: string[] = [];
  if (o.price) lines.push(`- price: ${o.price}`);
  if (o.discount) lines.push(`- discount: ${o.discount}`);
  if (o.promo) lines.push(`- promo: ${o.promo}`);
  if (o.deadline) lines.push(`- deadline: ${o.deadline}`);
  if (o.gift) lines.push(`- gift: ${o.gift}`);
  return lines.length ? lines.join("\n") : "(none)";
}

export function formatUserProvidedContentBlock(content: SimpleProductCardParsedContent): string {
  return [
    "USER PROVIDED CONTENT",
    "",
    "HEADLINE:",
    content.headline ?? "(none)",
    "",
    "SUBTITLE:",
    content.subtitle ?? "(none)",
    "",
    "BENEFITS:",
    bulletList(content.benefits),
    "",
    "CONFIRMED MEASUREMENTS:",
    measurementsList(content.measurements),
    "",
    "CONFIRMED SPECS:",
    specsList(content.specs),
    "",
    "MATERIALS:",
    bulletList(content.materials),
    "",
    "PACKAGE CONTENTS:",
    bulletList(content.packageContents),
    "",
    "USAGE STEPS:",
    bulletList(content.usageSteps),
    "",
    "TARGET AUDIENCE / CONTEXT:",
    bulletList(content.targetAudience),
    "",
    "OFFER / PROMO:",
    offerList(content.offer),
    "",
    "DELIVERY:",
    bulletList(content.delivery),
    "",
    "WARRANTY / TRUST:",
    bulletList(content.warrantyTrust),
    "",
    "OTHER USER PHRASES:",
    bulletList(content.otherPhrases),
  ].join("\n");
}

export function buildMeasurementVisualInstructions(m: SimpleProductCardMeasurements): string {
  if (!hasConfirmedMeasurements(m)) {
    return "No confirmed measurements were provided. Do not create measurement lines, arrows or numeric dimension labels.";
  }

  const lines: string[] = [
    "MEASUREMENT VISUAL INSTRUCTIONS:",
    "- Do NOT show all dimensions only inside one bottom badge.",
    "- Do NOT write combined size like “60×27×32 мм” only as a normal text box.",
    "- Draw separate visual indicators for each confirmed measurement.",
  ];

  if (m.width) {
    lines.push(`- Show width (${m.width}) as a horizontal measurement line below or above the product.`);
  }
  if (m.height) {
    lines.push(`- Show height (${m.height}) as a vertical measurement line on the left or right side of the product.`);
  }
  if (m.depth) {
    lines.push(`- Show depth (${m.depth}) as a diagonal or side-perspective measurement line.`);
  }
  if (m.length) {
    lines.push(`- Show length (${m.length}) as a long horizontal or object-aligned measurement line.`);
  }
  if (m.diameter) {
    lines.push(`- Show diameter (${m.diameter}) as a circular/arc measurement if the product shape is round.`);
  }
  if (m.thickness) {
    lines.push(`- Show thickness (${m.thickness}) as a small side callout.`);
  }

  lines.push("- Do not mix measurements with benefit badges.");
  lines.push("- Do not invent missing measurements.");

  return lines.join("\n");
}

export function buildExactRenderTextBlock(content: SimpleProductCardParsedContent): string {
  const phrases: string[] = [];
  if (content.headline?.trim()) phrases.push(content.headline.trim());
  if (content.subtitle?.trim()) phrases.push(content.subtitle.trim());
  for (const b of content.benefits) phrases.push(b.trim());
  for (const d of content.delivery) phrases.push(d.trim());
  for (const w of content.warrantyTrust) phrases.push(w.trim());
  for (const t of content.targetAudience) phrases.push(t.trim());
  for (const p of content.packageContents) phrases.push(p.trim());
  for (const m of content.materials) phrases.push(m.trim());
  if (content.offer.price) phrases.push(content.offer.price);
  if (content.offer.discount) phrases.push(content.offer.discount);
  if (content.offer.promo) phrases.push(content.offer.promo);
  if (content.offer.gift) phrases.push(content.offer.gift);

  const seen = new Set<string>();
  const unique = phrases.filter((p) => {
    const k = p.toLowerCase();
    if (!p || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (!unique.length) return "";
  return ["TEXT RENDER INSTRUCTIONS:", "Render exactly:", ...unique.map((p) => `"${p}"`)].join("\n");
}

export function exactTextPhrasesFromParsedContent(content: SimpleProductCardParsedContent): string[] {
  const block = buildExactRenderTextBlock(content);
  const matches = block.match(/"([^"]+)"/g);
  return matches?.map((m) => m.slice(1, -1)) ?? [];
}
