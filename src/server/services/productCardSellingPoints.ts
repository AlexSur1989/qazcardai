import type { ProductCardTemplatePresetId } from "@/config/product-card-overlay-presets";

type Language = "ru" | "kk" | "auto";

export type ProductSellingPointsInput = {
  productTitle: string;
  productCategory?: string | null;
  userBenefits: string | string[];
  userExtraText?: string;
  userSubtitle?: string;
  statsText?: string;
  sizeText?: string;
  language?: Language;
  templatePreset?: ProductCardTemplatePresetId | string;
};

export type ProductSellingPoints = {
  title: string;
  subtitle: string;
  benefits: string[];
  extraText: string;
  statsText: string;
  sizeText: string;
  language: Exclude<Language, "auto">;
};

const RU_FALLBACK_BENEFITS = [
  "Премиум качество",
  "Удобное использование",
  "Современный дизайн",
  "Для ежедневного выбора",
];

const KK_FALLBACK_BENEFITS = [
  "Премиум сапа",
  "Ыңғайлы қолдану",
  "Заманауи дизайн",
  "Күнделікті таңдау",
];

const ROUGH_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bахуенн\w*/giu, "стильный дизайн"],
  [/\bохуенн\w*/giu, "стильный дизайн"],
  [/\bофигенн\w*/giu, "современный дизайн"],
  [/\bкрут\w*/giu, "выразительный стиль"],
  [/\bтопов\w*/giu, "популярный выбор"],
  [/\bбомб\w*/giu, "яркий акцент"],
];

const CLAIM_WORDS = [
  /лечит/giu,
  /вылечит/giu,
  /гарантирует/giu,
  /100\s*%/giu,
  /без\s+риска/giu,
  /қаржылық\s+кепілдік/giu,
];

function hasKazakhLetters(value: string): boolean {
  return /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(value);
}

function detectLanguage(parts: string[]): Exclude<Language, "auto"> {
  return hasKazakhLetters(parts.join(" ")) ? "kk" : "ru";
}

function cleanText(value: string): string {
  let out = value
    .replace(/[\t ]+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
  for (const [pattern, replacement] of ROUGH_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  for (const pattern of CLAIM_WORDS) {
    out = out.replace(pattern, "").replace(/[\t ]+/g, " ").trim();
  }
  return out.replace(/["“”]+/g, "").trim();
}

function splitBenefits(raw: string | string[]): string[] {
  const rows = Array.isArray(raw) ? raw : raw.split(/\r?\n|[;•]+/g);
  return rows.map((item) => cleanText(item)).filter(Boolean);
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function truncateWords(value: string, maxWords: number, maxChars: number): string {
  const words = value.split(/\s+/).filter(Boolean);
  const compact = words.slice(0, maxWords).join(" ");
  const base = compact || value;
  return base.length > maxChars ? `${base.slice(0, Math.max(0, maxChars - 1)).trim()}…` : base;
}

function normalizeTitle(value: string, lang: Exclude<Language, "auto">): string {
  const cleaned = cleanText(value);
  if (cleaned) return truncateWords(cleaned, 7, 70);
  return lang === "kk" ? "Тауар карточкасы" : "Карточка товара";
}

function normalizeSubtitle(value: string | undefined, category: string | null | undefined, templatePreset: string | undefined, lang: Exclude<Language, "auto">): string {
  const cleaned = cleanText(value ?? "");
  if (cleaned) return truncateWords(cleaned, 7, 62);
  if (category) return truncateWords(cleanText(category), 5, 52);
  if (templatePreset === "promo_poster") return lang === "kk" ? "Жаңа таңдауыңыз" : "Новый акцент для вас";
  if (templatePreset === "clean_catalog") return lang === "kk" ? "Таза каталог стилі" : "Чистая каталоговая подача";
  return lang === "kk" ? "Сапалы әрі ыңғайлы" : "Стильно и практично";
}

function normalizeBenefit(value: string): string {
  return truncateWords(cleanText(value), 4, 44).replace(/[.!?]+$/, "");
}

export function generateProductSellingPoints(input: ProductSellingPointsInput): ProductSellingPoints {
  const rawParts = [
    input.productTitle,
    input.userSubtitle ?? "",
    ...(Array.isArray(input.userBenefits) ? input.userBenefits : [input.userBenefits]),
    input.userExtraText ?? "",
    input.statsText ?? "",
    input.sizeText ?? "",
  ];
  const language = input.language && input.language !== "auto" ? input.language : detectLanguage(rawParts);
  const title = normalizeTitle(input.productTitle, language);
  const subtitle = normalizeSubtitle(input.userSubtitle, input.productCategory, input.templatePreset, language);
  const fallback = language === "kk" ? KK_FALLBACK_BENEFITS : RU_FALLBACK_BENEFITS;
  const benefits = dedupe([...splitBenefits(input.userBenefits).map(normalizeBenefit), ...fallback])
    .filter(Boolean)
    .slice(0, 5);
  return {
    title,
    subtitle,
    benefits,
    extraText: truncateWords(cleanText(input.userExtraText ?? ""), 5, 48),
    statsText: truncateWords(cleanText(input.statsText ?? ""), 4, 34),
    sizeText: truncateWords(cleanText(input.sizeText ?? ""), 4, 34),
    language,
  };
}
