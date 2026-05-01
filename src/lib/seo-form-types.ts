/**
 * Типы для UI SEO (без import из server-only).
 */
export type SeoFormState = {
  LANDING_URL: string;
  APP_URL: string;
  SEO_DEFAULT_TITLE: string;
  SEO_DEFAULT_DESCRIPTION: string;
  SEO_DEFAULT_KEYWORDS: unknown;
  SEO_CANONICAL_URL: string;
  OG_IMAGE_URL: string;
  ROBOTS_INDEXING_ENABLED: boolean;
  SITEMAP_URL: string;
  YANDEX_VERIFICATION: string;
  GOOGLE_SITE_VERIFICATION: string;
};

export function normalizeSeoFormState(r: Record<string, unknown>): SeoFormState {
  return {
    LANDING_URL: String(r.LANDING_URL ?? ""),
    APP_URL: String(r.APP_URL ?? ""),
    SEO_DEFAULT_TITLE: String(r.SEO_DEFAULT_TITLE ?? ""),
    SEO_DEFAULT_DESCRIPTION: String(r.SEO_DEFAULT_DESCRIPTION ?? ""),
    SEO_DEFAULT_KEYWORDS: r.SEO_DEFAULT_KEYWORDS,
    SEO_CANONICAL_URL: String(r.SEO_CANONICAL_URL ?? ""),
    OG_IMAGE_URL: String(r.OG_IMAGE_URL ?? ""),
    ROBOTS_INDEXING_ENABLED: r.ROBOTS_INDEXING_ENABLED === true,
    SITEMAP_URL: String(r.SITEMAP_URL ?? ""),
    YANDEX_VERIFICATION: String(r.YANDEX_VERIFICATION ?? ""),
    GOOGLE_SITE_VERIFICATION: String(r.GOOGLE_SITE_VERIFICATION ?? ""),
  };
}
