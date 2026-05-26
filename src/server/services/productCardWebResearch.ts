import "server-only";

import type { CardBuilderUniversalCategoryId } from "@/config/card-builder-universal";
import {
  DEFAULT_PRODUCT_CARD_WEB_RESEARCH_SETTINGS,
  normalizeWebResearchSettings,
  type ProductCardWebResearchMeta,
  type ProductCardWebResearchSettings,
  type ProductCardWebResearchSource,
} from "@/lib/product-card-web-research-config";
import {
  confidenceLevelFromNumeric,
  numericConfidenceFromLevel,
  newProductFactId,
  type CardBuilderFactConfidenceLevel,
  type CardBuilderProductFact,
  type CardBuilderProductFactType,
} from "@/lib/card-builder-product-facts";
import { defaultVisibleOnCardForWebFact } from "@/lib/card-builder-fact-eligibility";
import type { ProductCardVisionAnalysisResult } from "@/server/services/productCardVisionAnalysis";
import { getAppSetting } from "@/server/services/appSettings";

const WEB_RESEARCH_APP_SETTING_KEY = "PRODUCT_CARD_WEB_RESEARCH_SETTINGS";

export async function getProductCardWebResearchSettings(): Promise<ProductCardWebResearchSettings> {
  try {
    const raw = await getAppSetting(WEB_RESEARCH_APP_SETTING_KEY);
    return normalizeWebResearchSettings(raw);
  } catch {
    return { ...DEFAULT_PRODUCT_CARD_WEB_RESEARCH_SETTINGS };
  }
}

export function buildWebResearchQuery(input: {
  vision: ProductCardVisionAnalysisResult;
  productType?: string;
}): string {
  const parts: string[] = [];
  if (input.vision.brandGuess?.trim()) parts.push(input.vision.brandGuess.trim());
  if (input.vision.productNameGuess?.trim()) parts.push(input.vision.productNameGuess.trim());
  else if (input.productType?.trim()) parts.push(input.productType.trim());
  else if (input.vision.productType?.trim()) parts.push(input.vision.productType.trim());

  for (const line of input.vision.visibleText ?? []) {
    const t = line.trim();
    if (t.length >= 3 && t.length <= 80) {
      parts.push(t);
      break;
    }
  }

  const dim = input.vision.suggestedProductFacts.find((f) => f.type === "dimension");
  if (dim?.value?.trim()) parts.push(dim.value.trim());

  const cat = input.vision.categoryKey;
  if (cat && cat !== "other") parts.push(cat.replace(/_/g, " "));

  const q = [...new Set(parts.map((p) => p.trim()).filter(Boolean))].join(" ");
  return q.slice(0, 240) || "товар характеристики";
}

type TavilyResult = {
  results?: Array<{ title?: string; url?: string; content?: string }>;
};

async function searchTavily(
  query: string,
  settings: ProductCardWebResearchSettings,
): Promise<ProductCardWebResearchSource[]> {
  const key = process.env.TAVILY_API_KEY?.trim() ?? "";
  if (!key) return [];

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "basic",
      max_results: settings.maxSources,
      include_answer: false,
    }),
    signal: AbortSignal.timeout(settings.searchTimeoutMs),
  });

  if (!res.ok) return [];
  const data = (await res.json()) as TavilyResult;
  const out: ProductCardWebResearchSource[] = [];
  for (const row of data.results ?? []) {
    const url = typeof row.url === "string" ? row.url.trim() : "";
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!url || !title) continue;
    if (settings.allowedDomains.length > 0) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        const ok = settings.allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
        if (!ok) continue;
      } catch {
        continue;
      }
    }
    out.push({
      url: url.slice(0, 2048),
      title: title.slice(0, 200),
      snippet:
        typeof row.content === "string" ? row.content.trim().slice(0, 600) : undefined,
    });
    if (out.length >= settings.maxSources) break;
  }
  return out;
}

function mockWebSources(query: string): ProductCardWebResearchSource[] {
  return [
    {
      url: "https://example.com/product",
      title: `Похожий товар: ${query.slice(0, 60)}`,
      snippet:
        "Объём 500 мл. Материал: пластик. Подходит для ежедневного использования. Комплектация: 1 шт.",
    },
  ];
}

function parseFactType(raw: unknown): CardBuilderProductFactType {
  const types = [
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
  if (typeof raw !== "string") return "other";
  const t = raw.trim();
  return (types as readonly string[]).includes(t) ? (t as CardBuilderProductFactType) : "other";
}

function parseConfidenceLevel(raw: unknown): CardBuilderFactConfidenceLevel {
  if (raw === "high" || raw === "medium" || raw === "low") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return confidenceLevelFromNumeric(raw);
  }
  return "medium";
}

function extractFactsFromSources(args: {
  sources: ProductCardWebResearchSource[];
  categoryKey: CardBuilderUniversalCategoryId;
  settings: ProductCardWebResearchSettings;
}): {
  facts: CardBuilderProductFact[];
  matchConfidence: "high" | "medium" | "low";
  matchedProductName?: string;
  uncertainMatch: boolean;
} {
  const facts: CardBuilderProductFact[] = [];
  const defaultVisible = defaultVisibleOnCardForWebFact(
    args.categoryKey,
    args.settings.riskyCategoriesRequireManualConfirmation,
  );

  if (args.sources.length === 0) {
    return { facts: [], matchConfidence: "low", uncertainMatch: true };
  }

  const primary = args.sources[0]!;
  const snippet = primary.snippet ?? "";
  const uncertainMatch = args.sources.length < 2 && snippet.length < 40;

  // Heuristic extraction from snippets (no LLM hallucination — pattern-based).
  const candidates: Array<{ label: string; value: string; type: CardBuilderProductFactType }> =
    [];

  const volume = snippet.match(/(\d[\d.,]*\s*(?:мл|ml|л|l|г|g|кг|kg))/i);
  if (volume?.[1]) {
    candidates.push({ label: "Объём / размер", value: volume[1], type: "dimension" });
  }

  const material = snippet.match(/материал[:\s-]+([^.;,\n]{2,80})/i);
  if (material?.[1]) {
    candidates.push({ label: "Материал", value: material[1].trim(), type: "material" });
  }

  const kit = snippet.match(/комплект(?:ация)?[:\s-]+([^.;,\n]{2,120})/i);
  if (kit?.[1]) {
    candidates.push({ label: "Комплектация", value: kit[1].trim(), type: "package" });
  }

  const usage = snippet.match(/(?:подходит|использован)[^.;,\n]{0,20}([^.;,\n]{5,120})/i);
  if (usage?.[1]) {
    candidates.push({ label: "Применение", value: usage[1].trim(), type: "usage" });
  }

  if (candidates.length === 0 && snippet.length > 20) {
    candidates.push({
      label: "Описание с сайта",
      value: snippet.slice(0, 200),
      type: "detail",
    });
  }

  for (const c of candidates.slice(0, 8)) {
    const level: CardBuilderFactConfidenceLevel = uncertainMatch ? "low" : "medium";
    facts.push({
      id: newProductFactId(),
      key: `web_${c.type}_${facts.length}`,
      label: c.label,
      value: c.value,
      type: c.type,
      source: "web_suggested",
      confidence: numericConfidenceFromLevel(level) ?? 0.65,
      confidenceLevel: level,
      needsReview: true,
      verifiedByUser: false,
      visibleOnCard: defaultVisible,
      lockedText: true,
      evidence: "web_page",
      evidenceUrl: primary.url,
      evidenceTitle: primary.title,
    });
  }

  return {
    facts,
    matchConfidence: uncertainMatch ? "low" : facts.length >= 2 ? "medium" : "low",
    matchedProductName: primary.title,
    uncertainMatch,
  };
}

export type WebResearchRunResult = {
  ok: boolean;
  error?: string;
  query: string;
  suggestedFacts: CardBuilderProductFact[];
  meta: ProductCardWebResearchMeta;
};

export async function runProductCardWebResearch(args: {
  vision: ProductCardVisionAnalysisResult;
  productType?: string;
}): Promise<WebResearchRunResult> {
  const settings = await getProductCardWebResearchSettings();
  const query = buildWebResearchQuery(args);

  if (!settings.enabled) {
    return {
      ok: false,
      error: "Web Research отключён в настройках.",
      query,
      suggestedFacts: [],
      meta: {
        searchedAt: new Date().toISOString(),
        query,
        matchConfidence: "low",
        uncertainMatch: true,
        sources: [],
        provider: "disabled",
      },
    };
  }

  const isMock =
    (process.env.PRODUCT_CLASSIFIER_PROVIDER ?? "").trim() === "mock" ||
    !(process.env.TAVILY_API_KEY?.trim());

  let sources: ProductCardWebResearchSource[] = [];
  let provider: ProductCardWebResearchMeta["provider"] = "tavily";

  if (isMock) {
    provider = "mock";
    sources = mockWebSources(query);
  } else {
    sources = await searchTavily(query, settings);
    if (sources.length === 0) {
      return {
        ok: false,
        error:
          "Не удалось найти источники в интернете. Проверьте TAVILY_API_KEY или добавьте характеристики вручную.",
        query,
        suggestedFacts: [],
        meta: {
          searchedAt: new Date().toISOString(),
          query,
          matchConfidence: "low",
          uncertainMatch: true,
          sources: [],
          provider: "tavily",
        },
      };
    }
  }

  const extracted = extractFactsFromSources({
    sources,
    categoryKey: args.vision.categoryKey,
    settings,
  });

  return {
    ok: extracted.facts.length > 0,
    error:
      extracted.facts.length === 0
        ? "Источники найдены, но характеристики не извлечены — добавьте вручную."
        : undefined,
    query,
    suggestedFacts: extracted.facts,
    meta: {
      searchedAt: new Date().toISOString(),
      query,
      matchConfidence: extracted.matchConfidence,
      matchedProductName: extracted.matchedProductName,
      uncertainMatch: extracted.uncertainMatch,
      sources,
      provider,
    },
  };
}

/** Parse LLM JSON array of suggested facts (for future enrichment). */
export function parseWebSuggestedFactsJson(
  parsed: unknown,
  source: ProductCardWebResearchSource,
  categoryKey: CardBuilderUniversalCategoryId,
  settings: ProductCardWebResearchSettings,
): CardBuilderProductFact[] {
  if (!Array.isArray(parsed)) return [];
  const defaultVisible = defaultVisibleOnCardForWebFact(
    categoryKey,
    settings.riskyCategoriesRequireManualConfirmation,
  );
  const out: CardBuilderProductFact[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const value = typeof r.value === "string" ? r.value.trim() : "";
    if (!label || !value) continue;
    const level = parseConfidenceLevel(r.confidence ?? r.confidenceLevel);
    out.push({
      id: newProductFactId(),
      label: label.slice(0, 120),
      value: value.slice(0, 400),
      type: parseFactType(r.type),
      source: "web_suggested",
      confidenceLevel: level,
      confidence: numericConfidenceFromLevel(level) ?? 0.65,
      needsReview: true,
      verifiedByUser: false,
      visibleOnCard: defaultVisible,
      lockedText: true,
      evidence: "web_page",
      evidenceUrl: source.url,
      evidenceTitle: source.title,
    });
    if (out.length >= 12) break;
  }
  return out;
}
