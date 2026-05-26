export type ProductCardWebResearchSettings = {
  enabled: boolean;
  maxSources: number;
  allowedDomains: string[];
  searchTimeoutMs: number;
  riskyCategoriesRequireManualConfirmation: boolean;
};

export const DEFAULT_PRODUCT_CARD_WEB_RESEARCH_SETTINGS: ProductCardWebResearchSettings =
  {
    enabled: true,
    maxSources: 5,
    allowedDomains: [],
    searchTimeoutMs: 25_000,
    riskyCategoriesRequireManualConfirmation: true,
  };

export function normalizeWebResearchSettings(
  raw: unknown,
): ProductCardWebResearchSettings {
  const base = { ...DEFAULT_PRODUCT_CARD_WEB_RESEARCH_SETTINGS };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  if (typeof o.enabled === "boolean") base.enabled = o.enabled;
  if (typeof o.maxSources === "number" && Number.isFinite(o.maxSources)) {
    base.maxSources = Math.min(10, Math.max(1, Math.round(o.maxSources)));
  }
  if (Array.isArray(o.allowedDomains)) {
    base.allowedDomains = o.allowedDomains
      .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
      .map((d) => d.trim().slice(0, 200))
      .slice(0, 20);
  }
  if (typeof o.searchTimeoutMs === "number" && Number.isFinite(o.searchTimeoutMs)) {
    base.searchTimeoutMs = Math.min(60_000, Math.max(5_000, Math.round(o.searchTimeoutMs)));
  }
  if (typeof o.riskyCategoriesRequireManualConfirmation === "boolean") {
    base.riskyCategoriesRequireManualConfirmation = o.riskyCategoriesRequireManualConfirmation;
  }
  return base;
}

export type ProductCardWebResearchSource = {
  url: string;
  title: string;
  snippet?: string;
};

export type ProductCardWebResearchMeta = {
  searchedAt: string;
  query: string;
  matchConfidence: "high" | "medium" | "low";
  matchedProductName?: string;
  uncertainMatch: boolean;
  sources: ProductCardWebResearchSource[];
  provider: "tavily" | "mock" | "disabled";
};
