
import type { Prisma } from "@/generated/prisma/client";
import { getRegistryEntry } from "@/config/app-settings-registry";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { validateAppSettingValueForType } from "@/lib/app-setting-value";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { LEGAL_PAGE_SLUGS } from "@/lib/legal-page-config";
import { prisma } from "@/lib/prisma";
import { getAppSetting } from "@/server/services/appSettings";

export const SEO_APP_SETTING_KEYS = [
  "LANDING_URL",
  "APP_URL",
  "SEO_DEFAULT_TITLE",
  "SEO_DEFAULT_DESCRIPTION",
  "SEO_DEFAULT_KEYWORDS",
  "SEO_CANONICAL_URL",
  "OG_IMAGE_URL",
  "ROBOTS_INDEXING_ENABLED",
  "SITEMAP_URL",
  "YANDEX_VERIFICATION",
  "GOOGLE_SITE_VERIFICATION",
] as const;

export type SeoSettingKey = (typeof SEO_APP_SETTING_KEYS)[number];
export type SeoSettingsState = Record<SeoSettingKey, unknown>;

const SITEMAP_PATHS = [
  "/",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/ai-content-policy",
  "/copyright-policy",
] as const;

const URL_OPTIONAL_KEYS: ReadonlySet<SeoSettingKey> = new Set([
  "LANDING_URL",
  "APP_URL",
  "SEO_CANONICAL_URL",
  "OG_IMAGE_URL",
  "SITEMAP_URL",
]);

function coerceForRegistry(key: string, raw: unknown): unknown {
  const def = getRegistryEntry(key);
  if (!def) return raw;
  if (def.type === "string") {
    if (raw == null) return "";
    return String(raw);
  }
  if (def.type === "number") {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    return def.defaultValue;
  }
  if (def.type === "boolean") {
    if (raw === true || raw === false) return raw;
    return def.defaultValue;
  }
  if (def.type === "json") {
    if (raw === null || raw === undefined) return def.defaultValue;
    return raw;
  }
  return raw;
}

export async function getSeoSettings(): Promise<SeoSettingsState> {
  const out: Partial<SeoSettingsState> = {};
  for (const k of SEO_APP_SETTING_KEYS) {
    const v = await getAppSetting(k);
    out[k] = coerceForRegistry(k, v);
  }
  return out as SeoSettingsState;
}

function getRegistryDefaultsObject(): SeoSettingsState {
  const out: Partial<SeoSettingsState> = {};
  for (const k of SEO_APP_SETTING_KEYS) {
    const def = getRegistryEntry(k);
    out[k] = def ? def.defaultValue : "";
  }
  return out as SeoSettingsState;
}

function isHttpOrEmpty(s: string): boolean {
  const t = s.trim();
  if (t === "") return true;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function validateKeywords(
  v: unknown,
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(v)) {
    return { ok: false, error: "SEO_DEFAULT_KEYWORDS: ожидается массив" };
  }
  if (v.length > 30) {
    return { ok: false, error: "SEO_DEFAULT_KEYWORDS: не более 30 элементов" };
  }
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") {
      return { ok: false, error: "SEO_DEFAULT_KEYWORDS: РІСЃРµ элементы — строки" };
    }
    out.push(x);
  }
  return { ok: true, value: out };
}

function validateSeoValue(
  key: SeoSettingKey,
  value: unknown,
): { ok: true; value: Prisma.InputJsonValue } | { ok: false; error: string } {
  const def = getRegistryEntry(key);
  if (!def) return { ok: false, error: "unknown_key" };
  if (def.type === "string") {
    if (typeof value !== "string") {
      return { ok: false, error: `${key}: ожидается строка` };
    }
    if (key === "SEO_DEFAULT_TITLE" && value.length > 120) {
      return { ok: false, error: "Title: максимум 120 символов" };
    }
    if (key === "SEO_DEFAULT_DESCRIPTION" && value.length > 300) {
      return { ok: false, error: "Description: максимум 300 символов" };
    }
    if (URL_OPTIONAL_KEYS.has(key) && !isHttpOrEmpty(value)) {
      return { ok: false, error: `${key}: пусто или валидный http(s) URL` };
    }
    if (
      (key === "YANDEX_VERIFICATION" || key === "GOOGLE_SITE_VERIFICATION") &&
      value.length > 300
    ) {
      return { ok: false, error: `${key}: максимум 300 символов` };
    }
    return { ok: true, value: value as unknown as Prisma.InputJsonValue };
  }
  if (key === "SEO_DEFAULT_KEYWORDS") {
    const kw = validateKeywords(value);
    if (!kw.ok) return { ok: false, error: kw.error };
    return { ok: true, value: kw.value as unknown as Prisma.InputJsonValue };
  }
  const base = validateAppSettingValueForType(def.type, value);
  if (!base.ok) {
    return { ok: false, error: base.message };
  }
  return { ok: true, value: base.value };
}

export async function updateSeoSettings(input: {
  values: Partial<Record<SeoSettingKey, unknown>>;
  adminUserId: string;
}): Promise<
  { ok: true; settings: SeoSettingsState } | { ok: false; error: string; status?: number }
> {
  const providedKeys = Object.keys(input.values).filter((k) =>
    SEO_APP_SETTING_KEYS.includes(k as SeoSettingKey),
  ) as SeoSettingKey[];
  if (providedKeys.length === 0) {
    return { ok: false, error: "no_fields" };
  }
  const before = await getSeoSettings();
  const validated: Partial<Record<SeoSettingKey, Prisma.InputJsonValue>> = {};
  for (const key of providedKeys) {
    const raw = input.values[key];
    const valid = validateSeoValue(key, raw);
    if (!valid.ok) {
      return { ok: false, error: valid.error, status: 400 };
    }
    validated[key] = valid.value;
  }
  await prisma.$transaction(
    providedKeys.map((key) => {
      const def = getRegistryEntry(key)!;
      return prisma.appSetting.upsert({
        where: { key },
        create: {
          key,
          type: def.type,
          value: validated[key]!,
          description: def.description,
          updatedBy: input.adminUserId,
        },
        update: {
          type: def.type,
          value: validated[key]!,
          description: def.description,
          updatedBy: input.adminUserId,
        },
      });
    }),
  );
  const after = await getSeoSettings();
  await writeAdminAuditLog({
    adminUserId: input.adminUserId,
    action: "SEO_SETTINGS_UPDATED",
    targetType: "SEO",
    targetId: "settings",
    oldValue: before,
    newValue: after,
  });
  return { ok: true, settings: after };
}

export type SeoChecklistItem = {
  id: string;
  label: string;
  status: "ok" | "warning" | "info";
  detail?: string;
};

async function checkHttpOk(path: string, base: string): Promise<boolean> {
  try {
    const root = new URL(base.endsWith("/") ? base : `${base}/`);
    const u = new URL(path.replace(/^\//, ""), root);
    const r = await fetch(u, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    return (
      (r.status >= 200 && r.status < 400) ||
      r.status === 302 ||
      r.status === 303 ||
      r.status === 307 ||
      r.status === 308
    );
  } catch {
    return false;
  }
}

export async function getSeoChecklist(): Promise<SeoChecklistItem[]> {
  const s = await getSeoSettings().catch(() => getRegistryDefaultsObject());
  const appBase = (typeof s.APP_URL === "string" && s.APP_URL.trim()) || getAppBaseUrl();
  let appOrigin: string;
  try {
    appOrigin = new URL(appBase.endsWith("/") ? appBase : `${appBase}/`).toString();
  } catch {
    appOrigin = `${getAppBaseUrl()}/`;
  }
  const title = String(s.SEO_DEFAULT_TITLE ?? "").trim();
  const desc = String(s.SEO_DEFAULT_DESCRIPTION ?? "").trim();
  const canonical = String(s.SEO_CANONICAL_URL ?? "").trim();
  const og = String(s.OG_IMAGE_URL ?? "").trim();
  const sitemapU = String(s.SITEMAP_URL ?? "").trim();
  const landing = String(s.LANDING_URL ?? "").trim();
  let publishedLegal = 0;
  try {
    publishedLegal = await prisma.legalPage.count({
      where: { status: "PUBLISHED", slug: { in: [...LEGAL_PAGE_SLUGS] } },
    });
  } catch {
    publishedLegal = 0;
  }
  const [loginOk, regOk, productOk] = await Promise.all([
    checkHttpOk("login", appOrigin),
    checkHttpOk("register", appOrigin),
    checkHttpOk("dashboard/create/product-card", appOrigin),
  ]);
  let landingHost = "";
  try {
    if (landing) landingHost = new URL(landing).host;
  } catch {
    /* ignore */
  }
  let appHost = "";
  try {
    appHost = new URL(appOrigin).host;
  } catch {
    /* ignore */
  }
  return [
    {
      id: "title",
      label: "Title настроен / Title set",
      status: title ? "ok" : "warning",
    },
    {
      id: "description",
      label: "Description настроен / Description set",
      status: desc ? "ok" : "warning",
    },
    {
      id: "canonical",
      label: "Canonical URL настроен / Canonical set",
      status: isHttpOrEmpty(canonical) && Boolean(canonical) ? "ok" : "warning",
      detail: canonical || "Задайте SEO_CANONICAL_URL",
    },
    {
      id: "og",
      label: "OG image задан / OG image set",
      status: og && isHttpOrEmpty(og) ? "ok" : "warning",
    },
    {
      id: "robots",
      label: "robots.txt доступен / robots.txt available",
      status: "ok",
      detail: "Маршрут /robots.txt",
    },
    {
      id: "sitemap_url",
      label: "Sitemap URL задан / Sitemap URL set",
      status: sitemapU && isHttpOrEmpty(sitemapU) ? "ok" : "warning",
    },
    {
      id: "sitemap_app",
      label: "sitemap.xml доступен / sitemap.xml available",
      status: "ok",
      detail: "Маршрут /sitemap.xml",
    },
    {
      id: "legal",
      label: "Legal pages опубликованы / Legal pages published",
      status: publishedLegal >= LEGAL_PAGE_SLUGS.length ? "ok" : "warning",
      detail: `${publishedLegal} / ${LEGAL_PAGE_SLUGS.length} PUBLISHED`,
    },
    {
      id: "landing_sitemap",
      label: "Sitemap лендинга (отдельный домен) / Landing sitemap",
      status: "info",
      detail:
        landing && landingHost && appHost && landingHost !== appHost
          ? "Сайтмап внешнего лендинга настраивается отдельно (/opt/qazcard-landing и деплой на qazcardai.kz)."
          : "Если лендинг на другом домене — sitemap/robots для него настраиваются отдельно.",
    },
    {
      id: "landing_cta",
      label: "Лендинг: CTA на приложение / Landing CTA to app",
      status: "info",
      detail: "Ссылки на приложение: /login, /register, /dashboard/create/product-card",
    },
    {
      id: "login",
      label: "/login работает / /login works",
      status: loginOk ? "ok" : "warning",
      detail: "/login — вход; /auth/login — редирект на /login с тем же ?next= / ?callbackUrl=",
    },
    {
      id: "register",
      label: "/register работает / /register works",
      status: regOk ? "ok" : "warning",
      detail: "/register — регистрация; /auth/register — редирект на /register",
    },
    {
      id: "product_card",
      label: "/dashboard/create/product-card после входа / product-card (auth)",
      status: productOk ? "ok" : "warning",
      detail: "Нужна сессия; без входа — редирект на /login?next=…",
    },
  ];
}

export async function generateRobotsTxt(): Promise<string> {
  const defaultSitemap = "https://qazcard.ai/sitemap.xml";
  let indexing = true;
  let sitemapLine = defaultSitemap;
  try {
    const g = await getSeoSettings();
    indexing = g.ROBOTS_INDEXING_ENABLED === true;
    const su = String(g.SITEMAP_URL ?? "").trim();
    sitemapLine = su || String(getRegistryEntry("SITEMAP_URL")?.defaultValue ?? defaultSitemap);
  } catch {
    const f = getRegistryDefaultsObject();
    indexing = f.ROBOTS_INDEXING_ENABLED === true;
    sitemapLine = String(f.SITEMAP_URL);
  }
  if (!sitemapLine.startsWith("http://") && !sitemapLine.startsWith("https://")) {
    sitemapLine = new URL(
      sitemapLine.startsWith("/") ? sitemapLine : `/${sitemapLine}`,
      getAppBaseUrl(),
    ).toString();
  }
  if (indexing) {
    return ["User-agent: *", "Allow: /", "", `Sitemap: ${sitemapLine}`, ""].join("\n");
  }
  return ["User-agent: *", "Disallow: /", "", `Sitemap: ${sitemapLine}`, ""].join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSitemapFromUrls(urls: string[]): string {
  const body = urls.map((u) => `  <url><loc>${escapeXml(u)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export async function generateSitemapXml(): Promise<string> {
  let origin = getAppBaseUrl();
  try {
    const s = await getSeoSettings();
    const c = String(s.SEO_CANONICAL_URL ?? "").trim();
    if (c) {
      origin = new URL(c).origin;
    }
  } catch {
    /* keep */
  }
  const base = origin.replace(/\/$/, "");
  const urls = SITEMAP_PATHS.map((p) =>
    p === "/" ? `${base}/` : `${base}${p.startsWith("/") ? p : `/${p}`}`,
  );
  return buildSitemapFromUrls(urls);
}
