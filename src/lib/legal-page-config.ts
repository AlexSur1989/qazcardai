/**
 * Slugs и пути публичных юридических страниц. Не путать с auth/payments.
 */

export const LEGAL_PAGE_SLUGS = [
  "terms",
  "privacy",
  "refund-policy",
  "ai-content-policy",
  "copyright-policy",
] as const;

export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number];

export const LEGAL_PAGE_PUBLIC_PATH: Record<LegalPageSlug, string> = {
  terms: "/terms",
  privacy: "/privacy",
  "refund-policy": "/refund-policy",
  "ai-content-policy": "/ai-content-policy",
  "copyright-policy": "/copyright-policy",
};

export const LEGAL_PAGE_SEED_DEFAULTS: ReadonlyArray<{
  slug: LegalPageSlug;
  title: string;
}> = [
  { slug: "terms", title: "Пользовательское соглашение" },
  { slug: "privacy", title: "Политика конфиденциальности" },
  { slug: "refund-policy", title: "Политика возвратов" },
  { slug: "ai-content-policy", title: "Политика AI-контента" },
  { slug: "copyright-policy", title: "Политика авторских прав" },
];

/** Placeholder при создании по умолчанию (не перезаписывает существующие страницы). */
export const LEGAL_PAGE_PLACEHOLDER_RU = `Черновик. Перед запуском сервиса текст необходимо проверить с юристом.

Настоящий документ — базовая заглушка. Замените его на согласованный с юристом текст.`;

export function isLegalPageSlug(s: string): s is LegalPageSlug {
  return (LEGAL_PAGE_SLUGS as readonly string[]).includes(s);
}

export const LEGAL_PAGE_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;

export type LegalPageStatusString =
  (typeof LEGAL_PAGE_STATUS)[keyof typeof LEGAL_PAGE_STATUS];
