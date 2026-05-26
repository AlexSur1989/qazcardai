import type { AppSettingGroupId } from "@/config/app-settings-registry";
import { BASIC_EDITABLE_SETTING_KEYS } from "@/lib/admin-settings-basic-config";

/** Legacy keys: остаются в БД/реестре, runtime не читает. */
export const LEGACY_APP_SETTING_KEYS = new Set([
  "PRODUCT_CARD_BUILDER_PLAN_CREDITS",
  "PRODUCT_CARD_BUILDER_SLIDE_CREDITS",
  "PRODUCT_CARD_BUILDER_GALLERY_6_CREDITS",
  "PRODUCT_CARD_BUILDER_GALLERY_8_CREDITS",
  "PRODUCT_CARD_BUILDER_PRICE_MULTIPLIERS",
]);

export type AppSettingAudience = "business" | "operations" | "developer" | "system";
export type AppSettingVisibility = "basic" | "advanced";
export type AppSettingRisk = "safe" | "caution" | "dangerous";

export type AppSettingUiMeta = {
  audience?: AppSettingAudience;
  visibility?: AppSettingVisibility;
  risk?: AppSettingRisk;
  legacy?: boolean;
  deprecated?: boolean;
  runtimeUsed?: boolean;
  hideInBasic?: boolean;
  canonicalHref?: string;
  canonicalHint?: string;
  helpText?: string;
  dangerousConfirm?: boolean;
};

const DEFAULT_META: AppSettingUiMeta = {
  audience: "developer",
  visibility: "advanced",
  risk: "caution",
  runtimeUsed: true,
};

const GROUP_DEFAULTS: Partial<Record<AppSettingGroupId, AppSettingUiMeta>> = {
  general: { audience: "business", visibility: "advanced", risk: "safe" },
  credits: { audience: "operations", visibility: "advanced", risk: "caution" },
  generation: { audience: "developer", visibility: "advanced", risk: "dangerous" },
  uploads: { audience: "developer", visibility: "advanced", risk: "caution" },
  productCard: { audience: "developer", visibility: "advanced", risk: "dangerous" },
  classifier: { audience: "developer", visibility: "advanced", risk: "dangerous" },
  maintenance: { audience: "system", visibility: "advanced", risk: "dangerous" },
  seo: { audience: "operations", visibility: "advanced", risk: "safe", canonicalHref: "/admin/seo", canonicalHint: "Редактируется в разделе SEO." },
  moderation: { audience: "operations", visibility: "advanced", risk: "caution", canonicalHref: "/admin/moderation", canonicalHint: "Редактируется в разделе Модерация." },
  notifications: { audience: "operations", visibility: "advanced", risk: "safe", canonicalHref: "/admin/notifications", canonicalHint: "Редактируется в разделе Уведомления." },
};

const KEY_META: Record<string, AppSettingUiMeta> = {
  APP_NAME: { audience: "business", visibility: "basic", risk: "safe", helpText: "Название сервиса в интерфейсе и письмах." },
  SUPPORT_EMAIL: { audience: "business", visibility: "basic", risk: "safe" },
  DEFAULT_CURRENCY: { audience: "business", visibility: "basic", risk: "safe" },

  FREE_CREDITS_FOR_NEW_USERS: { audience: "operations", risk: "caution", helpText: "Влияет на начисление токенов новым пользователям." },
  LOW_BALANCE_THRESHOLD: { audience: "operations", risk: "safe" },
  DASHBOARD_SUBSCRIPTION_PLAN_UI_ENABLED: { audience: "business", risk: "safe" },

  TOKEN_VALUE_KZT: { canonicalHref: "/admin/pricing", canonicalHint: "Технические цены моделей — в Цены и тарифы.", risk: "caution" },
  USD_TO_KZT: { canonicalHref: "/admin/pricing", canonicalHint: "Курс для расчёта маржи — см. Цены и тарифы / модели.", risk: "caution" },
  DEFAULT_MARKUP_PERCENT: { canonicalHref: "/admin/pricing", canonicalHint: "Наценка по умолчанию для новых моделей.", risk: "caution" },

  KASPI_MANUAL_SETTINGS: {
    hideInBasic: true,
    canonicalHref: "/admin/pricing?tab=topup",
    canonicalHint: "Редактировать Kaspi и WhatsApp в разделе Цены и тарифы → Пополнение.",
    audience: "operations",
  },

  PRODUCT_CARD_BUILDER_PLAN_CREDITS: {
    legacy: true,
    deprecated: true,
    runtimeUsed: false,
    hideInBasic: true,
    canonicalHint: "Не используется runtime. Каноничный источник — PRODUCT_CARD_CARD_BUILDER_PRICING или /admin/pricing → Создать карточку.",
    canonicalHref: "/admin/pricing?tab=card-builder",
  },
  PRODUCT_CARD_BUILDER_SLIDE_CREDITS: { legacy: true, deprecated: true, runtimeUsed: false, hideInBasic: true },
  PRODUCT_CARD_BUILDER_GALLERY_6_CREDITS: { legacy: true, deprecated: true, runtimeUsed: false, hideInBasic: true },
  PRODUCT_CARD_BUILDER_GALLERY_8_CREDITS: { legacy: true, deprecated: true, runtimeUsed: false, hideInBasic: true },
  PRODUCT_CARD_BUILDER_PRICE_MULTIPLIERS: { legacy: true, deprecated: true, runtimeUsed: false, hideInBasic: true },

  PRODUCT_CARD_CARD_BUILDER_PRICING: {
    hideInBasic: true,
    canonicalHref: "/admin/pricing?tab=card-builder",
    canonicalHint: "Редактировать тарифы «Создать карточку» в разделе Цены и тарифы.",
  },
  PRODUCT_CARD_SCENARIOS: {
    hideInBasic: true,
    canonicalHref: "/admin/product-card?tab=scenarios",
    canonicalHint: "Сценарии AI-карточек редактируются в AI-карточки товара.",
  },
  PRODUCT_CARD_CARD_BUILDER_PROMPTS: {
    hideInBasic: true,
    canonicalHref: "/admin/product-card?tab=card-builder-prompts&advanced=1",
    canonicalHint: "AI-промпты card_builder — в расширенных настройках AI-карточек.",
    risk: "dangerous",
    dangerousConfirm: true,
  },
  PRODUCT_CARD_MOCK_MODE: {
    risk: "dangerous",
    dangerousConfirm: true,
    helpText: "Mock-режим может скрыть реальные ошибки генерации.",
  },

  MAINTENANCE_MODE: {
    risk: "dangerous",
    dangerousConfirm: true,
    helpText: "Может отключить доступ к сайту для пользователей.",
  },
  MAINTENANCE_MESSAGE: { risk: "dangerous", dangerousConfirm: true },
  ALLOW_ADMIN_DURING_MAINTENANCE: { risk: "caution" },

  DEFAULT_IMAGE_MODEL_SLUG: {
    risk: "dangerous",
    dangerousConfirm: true,
    helpText: "Неверное значение может сломать маршрутизацию генераций.",
  },
  DEFAULT_VIDEO_MODEL_SLUG: {
    risk: "dangerous",
    dangerousConfirm: true,
    helpText: "Неверное значение может сломать маршрутизацию генераций.",
  },
  DEFAULT_PRODUCT_CONCEPT_IMAGE_MODEL_SLUG: { risk: "dangerous", dangerousConfirm: true },
  DEFAULT_MARKETPLACE_CARD_MODEL_SLUG: { risk: "dangerous", dangerousConfirm: true },
  DEFAULT_PRODUCT_VIDEO_MODEL_SLUG: { risk: "dangerous", dangerousConfirm: true },
  PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG: { risk: "dangerous", dangerousConfirm: true },
  PRODUCT_CARD_DEFAULT_CONCEPT_IMAGE_MODEL_SLUG: { risk: "dangerous", dangerousConfirm: true },
  PRODUCT_CARD_DEFAULT_MARKETPLACE_CARD_MODEL_SLUG: { risk: "dangerous", dangerousConfirm: true },
  PRODUCT_CARD_DEFAULT_CARD_BUILDER_MODEL_SLUG: { risk: "dangerous", dangerousConfirm: true },
  PRODUCT_CARD_DEFAULT_VIDEO_MODEL_SLUG: { risk: "dangerous", dangerousConfirm: true },

  GENERATION_TIMEOUT_MINUTES: { risk: "dangerous", dangerousConfirm: true },
  MAX_ACTIVE_GENERATIONS_PER_USER: { risk: "caution", dangerousConfirm: true },

  PRODUCT_CLASSIFIER_PROVIDER: { risk: "dangerous", dangerousConfirm: true },
  PRODUCT_CLASSIFIER_MODEL: { risk: "dangerous", dangerousConfirm: true },
  PRODUCT_CLASSIFIER_CONFIDENCE_THRESHOLD: { risk: "caution" },
};

function mergeMeta(
  group: AppSettingGroupId,
  key: string,
  partial: AppSettingUiMeta,
): AppSettingUiMeta {
  const groupBase = GROUP_DEFAULTS[group] ?? {};
  const merged: AppSettingUiMeta = { ...DEFAULT_META, ...groupBase, ...partial };

  if (LEGACY_APP_SETTING_KEYS.has(key)) {
    merged.legacy = true;
    merged.deprecated = merged.deprecated ?? true;
    merged.runtimeUsed = false;
    merged.hideInBasic = true;
  }

  if (BASIC_EDITABLE_SETTING_KEYS.has(key)) {
    merged.visibility = "basic";
    merged.audience = "business";
    merged.risk = "safe";
    merged.hideInBasic = false;
  }

  if (key.startsWith("PRODUCT_CARD_") && !KEY_META[key]) {
    merged.visibility = "advanced";
    merged.audience = "developer";
    if (key.includes("MIN_") || key.includes("PRICING") || key.includes("PROMPT")) {
      merged.canonicalHref = merged.canonicalHref ?? "/admin/pricing";
    }
    if (!key.includes("ENABLED") && !key.includes("ALLOW_MANUAL")) {
      merged.hideInBasic = true;
    }
  }

  if (key.includes("MODEL_SLUG") && !merged.dangerousConfirm) {
    merged.risk = "dangerous";
    merged.dangerousConfirm = true;
    merged.helpText =
      merged.helpText ?? "Неверное значение может сломать маршрутизацию генераций.";
  }

  if (key.startsWith("SEO_") || key === "LANDING_URL" || key === "OG_IMAGE_URL" || key === "ROBOTS_INDEXING_ENABLED" || key === "SITEMAP_URL" || key.startsWith("YANDEX_") || key.startsWith("GOOGLE_")) {
    merged.canonicalHref = merged.canonicalHref ?? "/admin/seo";
    merged.canonicalHint = merged.canonicalHint ?? "Редактируется в разделе SEO.";
    merged.hideInBasic = true;
  }

  if (key.startsWith("MODERATION_")) {
    merged.canonicalHref = merged.canonicalHref ?? "/admin/moderation";
    merged.canonicalHint = merged.canonicalHint ?? "Редактируется в разделе Модерация.";
    merged.hideInBasic = true;
  }

  if (key.startsWith("EMAIL_") || key.startsWith("SEND_") || key === "ADMIN_ALERT_EMAIL") {
    merged.canonicalHref = merged.canonicalHref ?? "/admin/notifications";
    merged.canonicalHint = merged.canonicalHint ?? "Редактируется в разделе Уведомления.";
    merged.hideInBasic = true;
  }

  return merged;
}

export function getAppSettingUiMeta(key: string, group?: AppSettingGroupId): AppSettingUiMeta {
  const g = group ?? "general";
  const explicit = KEY_META[key] ?? {};
  return mergeMeta(g, key, explicit);
}

export function isLegacyAppSettingKey(key: string): boolean {
  return LEGACY_APP_SETTING_KEYS.has(key) || getAppSettingUiMeta(key).legacy === true;
}

export function isBasicVisibleSetting(key: string, group: AppSettingGroupId): boolean {
  const meta = getAppSettingUiMeta(key, group);
  if (meta.hideInBasic) return false;
  if (meta.visibility === "basic") return true;
  if (BASIC_EDITABLE_SETTING_KEYS.has(key)) return true;
  return false;
}

export function isAdvancedOnlySetting(key: string, group: AppSettingGroupId): boolean {
  return !isBasicVisibleSetting(key, group);
}

export type AppSettingBadge =
  | "Runtime"
  | "Advanced"
  | "Developer"
  | "Dangerous"
  | "Legacy"
  | "Deprecated"
  | "Canonical elsewhere";

export function getAppSettingBadges(key: string, group: AppSettingGroupId): AppSettingBadge[] {
  const meta = getAppSettingUiMeta(key, group);
  const badges: AppSettingBadge[] = [];

  if (meta.runtimeUsed !== false) badges.push("Runtime");
  if (meta.visibility === "advanced" || isAdvancedOnlySetting(key, group)) badges.push("Advanced");
  if (meta.audience === "developer") badges.push("Developer");
  if (meta.risk === "dangerous") badges.push("Dangerous");
  if (meta.legacy) badges.push("Legacy");
  if (meta.deprecated) badges.push("Deprecated");
  if (meta.canonicalHref) badges.push("Canonical elsewhere");

  return [...new Set(badges)];
}

export function requiresDangerousConfirm(key: string, group: AppSettingGroupId): boolean {
  const meta = getAppSettingUiMeta(key, group);
  return meta.dangerousConfirm === true || meta.risk === "dangerous";
}
