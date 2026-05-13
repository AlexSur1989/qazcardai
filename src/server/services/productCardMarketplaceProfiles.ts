import "server-only";

import {
  PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS,
  PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION,
  type AppliedMarketplaceRulesSnapshot,
  type ProductCardMarketplaceProfile,
  normalizeSlideRoleList,
  buildAppliedMarketplaceRulesSnapshot,
} from "@/config/product-card-marketplace-profiles";
import { getAppSetting } from "@/server/services/appSettings";

/** Снимок для Generation.metadata.card_builder — только ключевые применённые правила */
export type CardBuilderGenerationAppliedMarketplaceRules = {
  mainPhotoTextAllowed: boolean;
  maxBenefitBadges: number;
};

function cloneProfile(p: ProductCardMarketplaceProfile): ProductCardMarketplaceProfile {
  return {
    ...p,
    extraAspectRatios: p.extraAspectRatios?.slice(),
    extraSizes: p.extraSizes?.slice(),
    fileFormats: p.fileFormats?.slice(),
    recommendedSlides: [...p.recommendedSlides],
    allowedSlideTypes: [...p.allowedSlideTypes],
    complianceHints: [...p.complianceHints],
    mainPhotoRules: { ...p.mainPhotoRules },
    infographicRules: { ...p.infographicRules },
    lifestyleRules: { ...p.lifestyleRules },
  };
}

export function mergeProductCardMarketplaceProfilePatch(
  base: ProductCardMarketplaceProfile,
  patch: Partial<ProductCardMarketplaceProfile> &
    Record<string, unknown>,
): ProductCardMarketplaceProfile {
  const mr = patch.mainPhotoRules;
  const ir = patch.infographicRules;
  const lr = patch.lifestyleRules;
  let allowed = base.allowedSlideTypes;
  let recommended = base.recommendedSlides;
  if (patch.allowedSlideTypes !== undefined && Array.isArray(patch.allowedSlideTypes)) {
    allowed = normalizeSlideRoleList(patch.allowedSlideTypes as string[]);
  }
  if (patch.recommendedSlides !== undefined && Array.isArray(patch.recommendedSlides)) {
    recommended = normalizeSlideRoleList(patch.recommendedSlides as string[]);
  }
  const out: ProductCardMarketplaceProfile = {
    ...base,
    ...patch,
    mainPhotoRules: {
      ...base.mainPhotoRules,
      ...(mr && typeof mr === "object" ? (mr as object) : {}),
    },
    infographicRules: {
      ...base.infographicRules,
      ...(ir && typeof ir === "object" ? (ir as object) : {}),
    },
    lifestyleRules: {
      ...base.lifestyleRules,
      ...(lr && typeof lr === "object" ? (lr as object) : {}),
    },
    allowedSlideTypes: allowed,
    recommendedSlides: recommended,
  };
  const cap = Math.min(out.infographicRules.maxBenefitBadges, out.maxBenefitBadges);
  return {
    ...out,
    infographicRules: { ...out.infographicRules, maxBenefitBadges: cap },
  };
}

function parsePatchList(raw: unknown): Partial<ProductCardMarketplaceProfile>[] {
  if (!Array.isArray(raw)) return [];
  const out: Partial<ProductCardMarketplaceProfile>[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const id = typeof (row as { id?: unknown }).id === "string" ? (row as { id: string }).id.trim() : "";
    if (!id) continue;
    out.push(row as Partial<ProductCardMarketplaceProfile>);
  }
  return out;
}

/**
 * Если в App Setting пустой массив или нет записи — полный список из кода.
 * Если есть объекты с id — патч поверх кодовых defaults (глубина: вложенные main/infographic/lifestyle rules).
 */
export async function getMergedProductCardMarketplaceProfiles(): Promise<
  ProductCardMarketplaceProfile[]
> {
  const raw = await getAppSetting("PRODUCT_CARD_MARKETPLACE_PROFILES");
  const patches = parsePatchList(raw);
  if (patches.length === 0) {
    return PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS.map(cloneProfile);
  }
  const patchById = new Map(patches.map((p) => [p.id!, p]));
  return PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS.map((d) => {
    const patch = patchById.get(d.id);
    const base = cloneProfile(d);
    return patch ? mergeProductCardMarketplaceProfilePatch(base, patch as Partial<ProductCardMarketplaceProfile>) : base;
  });
}

export async function resolveProductCardMarketplaceProfile(
  marketplaceId: string,
): Promise<
  | { ok: true; profile: ProductCardMarketplaceProfile }
  | { ok: false; error: string; status: number; code?: string }
> {
  const id = marketplaceId.trim();
  if (!id) {
    return { ok: false, error: "Не указана площадка", status: 400 };
  }
  const list = await getMergedProductCardMarketplaceProfiles();
  const profile = list.find((p) => p.id === id);
  if (!profile) {
    return { ok: false, error: "Неизвестный маркетплейс", status: 400, code: "MARKETPLACE_UNKNOWN" };
  }
  if (!profile.enabled) {
    return {
      ok: false,
      error: "Эта площадка временно недоступна. Выберите другую или попробуйте позже.",
      status: 400,
      code: "MARKETPLACE_DISABLED",
    };
  }
  return { ok: true, profile };
}

/** Узкий снимок для Generation.metadata (запись о списании / отладка промпта) */
export function buildCardBuilderGenerationMarketplaceRules(
  profile: ProductCardMarketplaceProfile,
): CardBuilderGenerationAppliedMarketplaceRules {
  return {
    mainPhotoTextAllowed: profile.mainPhotoTextAllowed,
    maxBenefitBadges: profile.maxBenefitBadges,
  };
}

export {
  buildAppliedMarketplaceRulesSnapshot,
  PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION,
  type AppliedMarketplaceRulesSnapshot,
};
