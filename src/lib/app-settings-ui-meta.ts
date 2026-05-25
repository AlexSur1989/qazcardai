/** Legacy keys: остаются в БД/реестре, runtime не читает. */
export const LEGACY_APP_SETTING_KEYS = new Set([
  "PRODUCT_CARD_BUILDER_PLAN_CREDITS",
  "PRODUCT_CARD_BUILDER_SLIDE_CREDITS",
  "PRODUCT_CARD_BUILDER_GALLERY_6_CREDITS",
  "PRODUCT_CARD_BUILDER_GALLERY_8_CREDITS",
  "PRODUCT_CARD_BUILDER_PRICE_MULTIPLIERS",
]);

export type AppSettingUiMeta = {
  legacy?: boolean;
  hideInBasic?: boolean;
  canonicalHref?: string;
  canonicalHint?: string;
};

const UI_META: Record<string, AppSettingUiMeta> = {
  PRODUCT_CARD_BUILDER_PLAN_CREDITS: {
    legacy: true,
    hideInBasic: true,
    canonicalHint: "Используйте PRODUCT_CARD_CARD_BUILDER_PRICING или /admin/pricing → Создать карточку.",
  },
  PRODUCT_CARD_BUILDER_SLIDE_CREDITS: { legacy: true, hideInBasic: true },
  PRODUCT_CARD_BUILDER_GALLERY_6_CREDITS: { legacy: true, hideInBasic: true },
  PRODUCT_CARD_BUILDER_GALLERY_8_CREDITS: { legacy: true, hideInBasic: true },
  PRODUCT_CARD_BUILDER_PRICE_MULTIPLIERS: { legacy: true, hideInBasic: true },
  PRODUCT_CARD_CARD_BUILDER_PRICING: {
    hideInBasic: true,
    canonicalHref: "/admin/pricing?tab=card-builder",
    canonicalHint: "Редактировать тарифы «Создать карточку» в разделе Цены и тарифы.",
  },
  KASPI_MANUAL_SETTINGS: {
    hideInBasic: true,
    canonicalHref: "/admin/pricing?tab=topup",
    canonicalHint: "Редактировать Kaspi и WhatsApp в разделе Цены и тарифы → Пополнение.",
  },
};

export function getAppSettingUiMeta(key: string): AppSettingUiMeta {
  if (LEGACY_APP_SETTING_KEYS.has(key)) {
    return { legacy: true, hideInBasic: true, ...UI_META[key] };
  }
  return UI_META[key] ?? {};
}

export function isLegacyAppSettingKey(key: string): boolean {
  return LEGACY_APP_SETTING_KEYS.has(key) || getAppSettingUiMeta(key).legacy === true;
}
