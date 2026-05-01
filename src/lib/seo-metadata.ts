import type { Metadata } from "next";

import { getAppBaseUrl } from "@/lib/app-base-url";
import { getSeoSettings } from "@/server/services/seoSettings";

/**
 * Метаданные по умолчанию из AppSetting (и реестра).
 * TODO: при желании подключить в `layout.tsx` или отдельных `generateMetadata`.
 */
export async function getDefaultSeoMetadata(): Promise<Metadata> {
  let title = "QazCard AI";
  let description: string | undefined;
  const baseUrl = getAppBaseUrl();
  try {
    const s = await getSeoSettings();
    if (typeof s.SEO_DEFAULT_TITLE === "string" && s.SEO_DEFAULT_TITLE.trim()) {
      title = s.SEO_DEFAULT_TITLE.trim();
    }
    if (typeof s.SEO_DEFAULT_DESCRIPTION === "string" && s.SEO_DEFAULT_DESCRIPTION.trim()) {
      description = s.SEO_DEFAULT_DESCRIPTION.trim();
    }
    const ogImage =
      typeof s.OG_IMAGE_URL === "string" && s.OG_IMAGE_URL.trim()
        ? s.OG_IMAGE_URL.trim()
        : undefined;
    const canonicalFromSetting =
      typeof s.SEO_CANONICAL_URL === "string" && s.SEO_CANONICAL_URL.trim()
        ? s.SEO_CANONICAL_URL.trim()
        : undefined;
    const kws = Array.isArray(s.SEO_DEFAULT_KEYWORDS)
      ? (s.SEO_DEFAULT_KEYWORDS as unknown[]).filter((x) => typeof x === "string")
      : [];
    return {
      title: { default: title, template: "%s" },
      description,
      alternates: {
        canonical: canonicalFromSetting ?? (baseUrl ? `${baseUrl}/` : undefined),
      },
      keywords: kws.length > 0 ? (kws as string[]) : undefined,
      openGraph: {
        title,
        description,
        type: "website",
        url: baseUrl,
        images: ogImage ? [{ url: ogImage }] : undefined,
      },
    };
  } catch {
    return {
      title: { default: title, template: "%s" },
      description: description || undefined,
      alternates: baseUrl ? { canonical: `${baseUrl}/` } : undefined,
    };
  }
}

type PublicPageParams = {
  title?: string;
  description?: string;
  /** pathname e.g. /terms */
  path: string;
  image?: string;
};

/**
 * Слияние с дефолтами SEO; подключайте в `generateMetadata` по странице при необходимости.
 */
export async function getPublicPageMetadata(
  p: PublicPageParams,
): Promise<Metadata> {
  const base = await getDefaultSeoMetadata();
  const absBase = getAppBaseUrl();
  const canonical = absBase
    ? new URL(
        p.path.startsWith("/") ? p.path : `/${p.path}`,
        absBase.endsWith("/") ? absBase : `${absBase}/`,
      ).toString()
    : undefined;
  return {
    ...base,
    title: p.title ? p.title : base.title,
    description: p.description ?? base.description,
    openGraph: p.image
      ? { ...base.openGraph, images: [{ url: p.image }] }
      : base.openGraph,
    alternates: { ...base.alternates, canonical: canonical ?? (base as Metadata).alternates?.canonical },
  };
}
