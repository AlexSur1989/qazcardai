
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
    return { ok: false, error: "SEO_DEFAULT_KEYWORDS: РѕР¶РёРґР°РµС‚СЃСЏ РјР°СЃСЃРёРІ" };
  }
  if (v.length > 30) {
    return { ok: false, error: "SEO_DEFAULT_KEYWORDS: РЅРµ Р±РѕР»РµРµ 30 СЌР»РµРјРµРЅС‚РѕРІ" };
  }
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") {
      return { ok: false, error: "SEO_DEFAULT_KEYWORDS: РІСЃРµ СЌР»РµРјРµРЅС‚С‹ вЂ” СЃС‚СЂРѕРєРё" };
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
      return { ok: false, error: `${key}: РѕР¶РёРґР°РµС‚СЃСЏ СЃС‚СЂРѕРєР°` };
    }
    if (key === "SEO_DEFAULT_TITLE" && value.length > 120) {
      return { ok: false, error: "Title: РјР°РєСЃРёРјСѓРј 120 СЃРёРјРІРѕР»РѕРІ" };
    }
    if (key === "SEO_DEFAULT_DESCRIPTION" && value.length > 300) {
      return { ok: false, error: "Description: РјР°РєСЃРёРјСѓРј 300 СЃРёРјРІРѕР»РѕРІ" };
    }
    if (URL_OPTIONAL_KEYS.has(key) && !isHttpOrEmpty(value)) {
      return { ok: false, error: `${key}: РїСѓСЃС‚Рѕ РёР»Рё РІР°Р»РёРґРЅС‹Р№ http(s) URL` };
    }
    if (
      (key === "YANDEX_VERIFICATION" || key === "GOOGLE_SITE_VERIFICATION") &&
      value.length > 300
    ) {
      return { ok: false, error: `${key}: РјР°РєСЃРёРјСѓРј 300 СЃРёРјРІРѕР»РѕРІ` };
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
      label: "Title РЅР°СЃС‚СЂРѕРµРЅ / Title set",
      status: title ? "ok" : "warning",
    },
    {
      id: "description",
      label: "Description РЅР°СЃС‚СЂРѕРµРЅ / Description set",
      status: desc ? "ok" : "warning",
    },
    {
      id: "canonical",
      label: "Canonical URL РЅР°СЃС‚СЂРѕРµРЅ / Canonical set",
      status: isHttpOrEmpty(canonical) && Boolean(canonical) ? "ok" : "warning",
      detail: canonical || "Р—Р°РґР°Р№С‚Рµ SEO_CANONICAL_URL",
    },
    {
      id: "og",
      label: "OG image Р·Р°РґР°РЅ / OG image set",
      status: og && isHttpOrEmpty(og) ? "ok" : "warning",
    },
    {
      id: "robots",
      label: "robots.txt РґРѕСЃС‚СѓРїРµРЅ / robots.txt available",
      status: "ok",
      detail: "РњР°СЂС€СЂСѓС‚ /robots.txt",
    },
    {
      id: "sitemap_url",
      label: "Sitemap URL Р·Р°РґР°РЅ / Sitemap URL set",
      status: sitemapU && isHttpOrEmpty(sitemapU) ? "ok" : "warning",
    },
    {
      id: "sitemap_app",
      label: "sitemap.xml РґРѕСЃС‚СѓРїРµРЅ / sitemap.xml available",
      status: "ok",
      detail: "РњР°СЂС€СЂСѓС‚ /sitemap.xml",
    },
    {
      id: "legal",
      label: "Legal pages РѕРїСѓР±Р»РёРєРѕРІР°РЅС‹ / Legal pages published",
      status: publishedLegal >= LEGAL_PAGE_SLUGS.length ? "ok" : "warning",
      detail: `${publishedLegal} / ${LEGAL_PAGE_SLUGS.length} PUBLISHED`,
    },
    {
      id: "landing_sitemap",
      label: "Sitemap Р»РµРЅРґРёРЅРіР° (РѕС‚РґРµР»СЊРЅС‹Р№ РґРѕРјРµРЅ) / Landing sitemap",
      status: "info",
      detail:
        landing && landingHost && appHost && landingHost !== appHost
          ? "РЎР°Р№С‚РјР°Рї РІРЅРµС€РЅРµРіРѕ Р»РµРЅРґРёРЅРіР° РЅР°СЃС‚СЂР°РёРІР°РµС‚СЃСЏ РѕС‚РґРµР»СЊРЅРѕ (qazcard-landing/ Рё С‚.Рґ.)."
          : "Р•СЃР»Рё Р»РµРЅРґРёРЅРі РЅР° РґСЂСѓРіРѕРј РґРѕРјРµРЅРµ вЂ” sitemap/robots РґР»СЏ РЅРµРіРѕ РЅР°СЃС‚СЂР°РёРІР°СЋС‚СЃСЏ РѕС‚РґРµР»СЊРЅРѕ.",
    },
    {
      id: "landing_cta",
      label: "Р›РµРЅРґРёРЅРі: CTA РЅР° РїСЂРёР»РѕР¶РµРЅРёРµ / Landing CTA to app",
      status: "info",
      detail: "РЎСЃС‹Р»РєРё РЅР° РїСЂРёР»РѕР¶РµРЅРёРµ: /login, /register, /dashboard/create/product-card",
    },
    {
      id: "login",
      label: "/login СЂР°Р±РѕС‚Р°РµС‚ / /login works",
      status: loginOk ? "ok" : "warning",
      detail: "Р РµРґРёСЂРµРєС‚ /login в†’ /auth/login",
    },
    {
      id: "register",
      label: "/register СЂР°Р±РѕС‚Р°РµС‚ / /register works",
      status: regOk ? "ok" : "warning",
      detail: "Р РµРґРёСЂРµРєС‚ /register в†’ /auth/register",
    },
    {
      id: "product_card",
      label: "/dashboard/create/product-card РїРѕСЃР»Рµ РІС…РѕРґР° / product-card (auth)",
      status: productOk ? "ok" : "warning",
      detail: "РќСѓР¶РµРЅ cookie СЃРµСЃСЃРёРё; РѕР¶РёРґР°РµС‚СЃСЏ СЂРµРґРёСЂРµРєС‚ 302/307 РЅР° /auth/login Р±РµР· РІС…РѕРґР°",
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
