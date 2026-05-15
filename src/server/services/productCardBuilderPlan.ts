import {
  hasUserDimensionMeasures,
  resolveTemplateWithFallback,
} from "@/config/card-builder-template-allowlist";
import {
  inferIngredientClaimsFromClientText,
  inferPlannerBucket,
  pickGalleryTemplateSequenceForPlan,
  type PlannerBucket,
} from "@/config/card-builder-gallery-sequences";
import {
  defaultTemplateForSlideRole,
  getCardBuilderTemplate,
  type CardBuilderTemplateSlideRole,
} from "@/config/card-builder-templates";
import type {
  AppliedMarketplaceRulesSnapshot,
  ProductCardMarketplaceProfile,
} from "@/config/product-card-marketplace-profiles";
import { getPublicProductCategories } from "@/config/product-card-categories";

export type CardBuilderSlideRole = CardBuilderTemplateSlideRole;

/** Одиночная цель мастера → роль первого кадра (полная галерея — без проверки роли здесь). */
export function cardBuilderGoalToSlideRole(goal: string): CardBuilderSlideRole | null {
  const m: Partial<Record<string, CardBuilderSlideRole>> = {
    main_photo: "main_photo",
    benefits_info: "benefits_infographic",
    dimensions_slide: "dimensions",
    materials_slide: "materials",
    lifestyle: "lifestyle",
    detail_closeup: "detail_closeup",
    packaging_kit: "packaging",
    premium_poster: "premium_poster",
  };
  return m[goal] ?? null;
}

export function marketplaceProfileAllowsGalleryRole(
  profile: ProductCardMarketplaceProfile,
  role: CardBuilderSlideRole,
): boolean {
  const allowed = profile.allowedSlideTypes as readonly string[];
  return allowed.includes(role);
}

/** Сообщение об ошибке, если тип кадра запрещён профилем; иначе `null`. */
export function cardBuilderProfileSlideErrorMessage(
  profile: ProductCardMarketplaceProfile,
  role: CardBuilderSlideRole,
): string | null {
  if (!marketplaceProfileAllowsGalleryRole(profile, role)) {
    return `Тип слайда недоступен для площадки «${profile.label}».`;
  }
  if (role === "benefits_infographic") {
    const cap = Math.min(profile.maxBenefitBadges, profile.infographicRules.maxBenefitBadges);
    if (!profile.infographicAllowed || cap <= 0) {
      return `Инфографика преимуществ недоступна для площадки «${profile.label}».`;
    }
  }
  if (role === "lifestyle" && !profile.lifestyleAllowed) {
    return `Lifestyle недоступен для площадки «${profile.label}».`;
  }
  return null;
}

/** Проверка одиночной цели мастера (не для полной галереи целиком). */
export function marketplaceGoalDisallowedReason(
  profile: ProductCardMarketplaceProfile,
  goal: string,
): string | null {
  const role = cardBuilderGoalToSlideRole(goal);
  if (!role) return null;
  return cardBuilderProfileSlideErrorMessage(profile, role);
}

const HEAVY_INFOGRAPHIC_TEMPLATES = new Set([
  "benefits_grid",
  "benefits_left_column",
  "dark_premium_benefits",
  "protection_features",
  "comparison_card",
]);

export type CardBuilderGallerySlide = {
  slideId: string;
  title: string;
  purpose: string;
  previewCaption: string;
  imageRole: CardBuilderSlideRole;
  templateId: string;
  templateLabel: string;
  layoutPreset: string;
  overlayRequired: boolean;
  /** В метаданных плана; старые сохранения могли не иметь поля */
  textRenderMode?: "ai_text_in_design";
  marketplaceProfileId?: string;
  textSlots: string[];
  iconSlots: string[];
  sourceImageMode: "original" | "variant";
  recommendedTextMode: "none" | "minimal" | "medium" | "heavy" | "infographic";
  promptIntent: string;
  overlayTexts?: Record<string, string>;
  overlayBenefitIcons?: string[];
  needsMoreBenefits?: boolean;
};

export type CardBuilderPlanInput = {
  selectedCategory: string;
  marketplace: string;
  goal: string;
  preserveProduct: boolean;
  preserveAspects: string[];
  allowCreativeStylization?: boolean;
  benefits: string[];
  benefitsExtra?: string;
  semanticBenefits?: string[];
  additionalBenefits?: string;
  subtitle?: string;
  dimensions?: string;
  languageMode?: string;
  mustShow: string[];
  audience: string;
  priceSegment: string;
  salesStyle: string;
  textDensity: string;
  marketplaceProfileId?: string;
  marketplaceProfileVersion?: string;
  appliedMarketplaceRules?: AppliedMarketplaceRulesSnapshot;
  cardBuilderTargetAspectRatio?: string;
  cardBuilderTargetSize?: string;
};

type MarketplacePlannerCluster =
  | "classified_mp"
  | "amazon"
  | "lamoda"
  | "classified_listings"
  | "brand_ecom"
  | "social"
  | "neutral";

const ROLE_META: Record<
  CardBuilderSlideRole,
  {
    title: string;
    purposeRu: string;
    promptIntent: string;
    recommendedTextMode: CardBuilderGallerySlide["recommendedTextMode"];
    sourceMode: CardBuilderGallerySlide["sourceImageMode"];
  }
> = {
  main_photo: {
    title: "Главное фото",
    purposeRu:
      "Кадр-представление товара: читается с первого взгляда, без фальшивых подписей и лишней рекламы на маркетплейсовом первом экране, если этого не хотят правила.",
    promptIntent: "clean catalog hero image",
    recommendedTextMode: "none",
    sourceMode: "original",
  },
  benefits_infographic: {
    title: "Преимущества",
    purposeRu:
      "Подчеркнуть только те качества, что вы уже сформулировали формой. Без лечебных, медицинских и технических утверждений без опоры.",
    promptIntent: "benefit-led selling layout without readable bitmap text",
    recommendedTextMode: "medium",
    sourceMode: "original",
  },
  dimensions: {
    title: "Размеры",
    purposeRu:
      "Подсказать масштаб и понятную соразмерность. Цифры — только ваши из поля формы.",
    promptIntent: "scale and dimension readability",
    recommendedTextMode: "minimal",
    sourceMode: "original",
  },
  materials: {
    title: "Материалы",
    purposeRu:
      "Материал и фактура честным крупным или полуторным планом, без добавления свойств продукта, которых нет в тексте.",
    promptIntent: "material macro and tactile premium cues",
    recommendedTextMode: "minimal",
    sourceMode: "original",
  },
  lifestyle: {
    title: "Lifestyle",
    purposeRu:
      "Товар в естественной сцене для выбранной аудитории и стиля продаж.",
    promptIntent: "aspirational in-context lifestyle commerce",
    recommendedTextMode: "minimal",
    sourceMode: "original",
  },
  premium_poster: {
    title: "Постер",
    purposeRu:
      "Праздничный второй или заключительный кадр. Сохраняем форму, логотип и цвет модели там, где вы отметили «сохранить продукт».",
    promptIntent: "premium retail poster hero",
    recommendedTextMode: "minimal",
    sourceMode: "original",
  },
  detail_closeup: {
    title: "Детали",
    purposeRu:
      "Подчеркнуть важную деталь, слой или интерфейс — без недостоверных спецификаций.",
    promptIntent: "macro hero detail fidelity",
    recommendedTextMode: "none",
    sourceMode: "original",
  },
  packaging: {
    title: "Упаковка / комплект",
    purposeRu:
      "Показать упаковку и комплект только когда это вытекает из текста клиента или логики категории.",
    promptIntent: "kit and packaging storytelling",
    recommendedTextMode: "minimal",
    sourceMode: "original",
  },
  ad_banner: {
    title: "Рекламный баннер",
    purposeRu:
      "Рекламный кадр для социальных кампаний — яркий, но без недобросовестных утверждений.",
    promptIntent: "bold ecommerce banner framing",
    recommendedTextMode: "minimal",
    sourceMode: "original",
  },
};

function plannerCluster(marketplaceId: string): MarketplacePlannerCluster {
  switch (marketplaceId) {
    case "kaspi":
    case "wildberries":
    case "ozon":
    case "yandex_market":
    case "halyk_market":
      return "classified_mp";
    case "amazon":
      return "amazon";
    case "lamoda":
      return "lamoda";
    case "olx":
    case "avito":
      return "classified_listings";
    case "shopify":
    case "own_site":
      return "brand_ecom";
    case "instagram_vk":
      return "social";
    default:
      return "neutral";
  }
}

function fillerRolesForEight(bucket: PlannerBucket): CardBuilderSlideRole[] {
  switch (bucket) {
    case "gadgets":
      return ["benefits_infographic", "dimensions", "packaging", "materials"];
    case "furniture":
      return ["packaging", "detail_closeup", "materials", "benefits_infographic"];
    case "beauty":
      return ["premium_poster", "packaging", "detail_closeup", "materials"];
    case "food":
      return ["detail_closeup", "materials", "dimensions", "ad_banner"];
    case "jewelry_accessories":
      return ["benefits_infographic", "dimensions", "ad_banner", "materials"];
    default:
      return ["packaging", "detail_closeup", "premium_poster", "materials"];
  }
}

function defaultMainTemplate(cluster: MarketplacePlannerCluster): string {
  if (cluster === "classified_listings") return "realistic_listing";
  return "hero_clean";
}

function roleOkForPlan(
  profile: ProductCardMarketplaceProfile,
  role: CardBuilderSlideRole,
): boolean {
  if (!marketplaceProfileAllowsGalleryRole(profile, role)) return false;
  if (role === "benefits_infographic") {
    const cap = Math.min(profile.maxBenefitBadges, profile.infographicRules.maxBenefitBadges);
    if (!profile.infographicAllowed || cap <= 0) return false;
    return true;
  }
  if (role === "lifestyle") return profile.lifestyleAllowed;
  return true;
}

/** Infographics demotion: Lamoda → fashion-catalog lifestyle; классические объявления → детальный кадр. */
function demoteHeavyInfographic(
  templateId: string,
  cluster: MarketplacePlannerCluster,
): string {
  const def = getCardBuilderTemplate(templateId);
  if (!def || def.slideRole !== "benefits_infographic") return templateId;
  if (cluster === "lamoda") return "fashion_catalog";
  if (!HEAVY_INFOGRAPHIC_TEMPLATES.has(templateId)) return templateId;
  if (cluster === "classified_listings") return "texture_closeup";
  return "benefits_grid";
}

/** Без реального текста клиента про состав — не использовать «ингредиентные» экраны. */
function reconcileIngredientSlides(
  templateIds: string[],
  bucket: PlannerBucket,
  input: CardBuilderPlanInput,
): string[] {
  if (inferIngredientClaimsFromClientText(input)) return templateIds;
  const repl =
    bucket === "food"
      ? "texture_closeup"
      : bucket === "beauty"
        ? "material_focus"
        : null;
  if (!repl) return templateIds;
  return templateIds.map((tid) =>
    tid === "ingredients_effect"
      ? repl
      : getCardBuilderTemplate(tid)?.slideRole === "materials" && tid.includes("effect")
        ? repl
        : tid,
  );
}

function coerceTemplateAgainstProfile(
  templateId: string,
  profile: ProductCardMarketplaceProfile,
  cluster: MarketplacePlannerCluster,
): string | null {
  const def = getCardBuilderTemplate(templateId);
  if (!def) return null;

  let tid =
    def.slideRole === "benefits_infographic" ? demoteHeavyInfographic(templateId, cluster) : templateId;

  let d = getCardBuilderTemplate(tid);
  if (d && roleOkForPlan(profile, d.slideRole)) return tid;

  const substitutes: Partial<Record<CardBuilderSlideRole, string>> = {
    benefits_infographic: profile.infographicAllowed ? demoteHeavyInfographic("benefits_grid", cluster) : "texture_closeup",
    lifestyle: cluster === "lamoda" ? "fashion_catalog" : "detail_closeup",
    dimensions: "lifestyle_card",
    materials: "detail_closeup",
    packaging: profile.lifestyleAllowed ? "lifestyle_card" : "texture_closeup",
    premium_poster: "lifestyle_card",
    ad_banner: "premium_poster",
    detail_closeup: profile.lifestyleAllowed ? "lifestyle_card" : defaultMainTemplate(cluster),
    main_photo: defaultMainTemplate(cluster),
  };

  let subRaw = substitutes[def.slideRole] ?? defaultMainTemplate(cluster);
  if (getCardBuilderTemplate(subRaw)?.slideRole === "benefits_infographic") {
    subRaw = demoteHeavyInfographic(subRaw, cluster);
  }
  tid = subRaw;

  d = getCardBuilderTemplate(tid);
  return d && roleOkForPlan(profile, d.slideRole) ? tid : null;
}

function uniqRolesPreferred(
  templateIds: string[],
  profile: ProductCardMarketplaceProfile,
  cluster: MarketplacePlannerCluster,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tid of templateIds) {
    const c = coerceTemplateAgainstProfile(tid, profile, cluster);
    if (!c) continue;
    const def = getCardBuilderTemplate(c);
    if (!def || !roleOkForPlan(profile, def.slideRole)) continue;
    if (seen.has(def.slideRole)) continue;
    seen.add(def.slideRole);
    out.push(c);
  }
  return out;
}

function extendToSlideCount(
  base: string[],
  count: 6 | 8,
  bucket: PlannerBucket,
  profile: ProductCardMarketplaceProfile,
  cluster: MarketplacePlannerCluster,
): string[] {
  const out = uniqRolesPreferred(base, profile, cluster);
  if (count === 6 || out.length >= count) return out.slice(0, count);

  const seenRoles = new Set(out.map((t) => getCardBuilderTemplate(t)!.slideRole));

  const tryPush = (tid: string): boolean => {
    const c = coerceTemplateAgainstProfile(tid, profile, cluster);
    if (!c) return false;
    const r = getCardBuilderTemplate(c)!.slideRole;
    if (seenRoles.has(r)) return false;
    seenRoles.add(r);
    out.push(c);
    return true;
  };

  for (const role of fillerRolesForEight(bucket)) {
    const tidRaw = defaultTemplateForSlideRole(role);
    const tidPrep =
      cluster === "lamoda" && role === "benefits_infographic" ? "fashion_catalog" : tidRaw;
    if (tryPush(tidPrep) && out.length >= count) return out.slice(0, count);
  }

  for (const rid of profile.recommendedSlides) {
    const r = rid as CardBuilderSlideRole;
    const tidPrep =
      cluster === "lamoda" && r === "benefits_infographic"
        ? "fashion_catalog"
        : defaultTemplateForSlideRole(r);
    if (tryPush(tidPrep) && out.length >= count) return out.slice(0, count);
  }

  let i = 0;
  const cycle = [...out];
  while (out.length < count && cycle.length > 0) {
    const src = cycle[i % cycle.length]!;
    const c =
      coerceTemplateAgainstProfile(defaultTemplateForSlideRole(getCardBuilderTemplate(src)!.slideRole), profile, cluster) ??
      coerceTemplateAgainstProfile(src, profile, cluster);
    if (c && !seenRoles.has(getCardBuilderTemplate(c)!.slideRole)) {
      tryPush(c);
    }
    i += 1;
    if (i > count * 4) break;
  }

  return out.slice(0, count);
}

function moveMainPhotoFirst(templateIds: string[]): string[] {
  const idx = templateIds.findIndex((t) => getCardBuilderTemplate(t)?.slideRole === "main_photo");
  if (idx <= 0) return templateIds;
  const copy = [...templateIds];
  const main = copy.splice(idx, 1)[0];
  copy.unshift(main!);
  return copy;
}

/** На классических МП главное всегда чистым; второй позицией держать не тяжёлую инфографику если есть «мягкие» позиции. */
function softenSecondSlotInfographic(templateIds: string[]): string[] {
  const copy = [...templateIds];
  if (copy.length < 3) return copy;
  const r1 = getCardBuilderTemplate(copy[1])?.slideRole;
  if (r1 !== "benefits_infographic") return copy;

  let swapIdx = copy.findIndex(
    (tid, j) => j >= 3 && getCardBuilderTemplate(tid)?.slideRole !== "benefits_infographic",
  );
  if (swapIdx < 0) {
    swapIdx = copy.findIndex(
      (tid, j) => j >= 2 && !HEAVY_INFOGRAPHIC_TEMPLATES.has(tid ?? ""),
    );
  }
  if (swapIdx > 1 && swapIdx !== -1) {
    const tmp = copy[1];
    copy[1] = copy[swapIdx]!;
    copy[swapIdx] = tmp!;
  }
  return copy;
}

function socialCommerceReorder(templateIds: string[]): string[] {
  const weight: Partial<Record<CardBuilderSlideRole, number>> = {
    lifestyle: 1,
    premium_poster: 2,
    ad_banner: 3,
    benefits_infographic: 4,
    materials: 5,
    detail_closeup: 5,
    dimensions: 6,
    packaging: 7,
    main_photo: 12,
  };
  return [...templateIds].sort((a, b) => {
    const ra = getCardBuilderTemplate(a)?.slideRole;
    const rb = getCardBuilderTemplate(b)?.slideRole;
    const wa = weight[ra!] ?? 8;
    const wb = weight[rb!] ?? 8;
    if (wa !== wb) return wa - wb;
    return templateIds.indexOf(a) - templateIds.indexOf(b);
  });
}

function applyClusterGalleryRules(
  templateIds: string[],
  cluster: MarketplacePlannerCluster,
  profile: ProductCardMarketplaceProfile,
): string[] {
  let ids = templateIds.map((t, idx) =>
    idx === 0 && cluster === "classified_listings" ? "realistic_listing" : t,
  );

  if (cluster === "classified_mp") {
    ids = moveMainPhotoFirst(ids);
    ids = softenSecondSlotInfographic(ids);
    ids = uniqRolesPreferred(ids, profile, cluster);
    return ids;
  }

  if (cluster === "amazon") {
    ids = moveMainPhotoFirst(ids.map((t) => (t === "realistic_listing" ? "hero_clean" : t)));
    ids = softenSecondSlotInfographic(ids);
    ids = uniqRolesPreferred(ids, profile, cluster);
    return ids;
  }

  if (cluster === "lamoda") {
    ids = ids.map((tid) =>
      HEAVY_INFOGRAPHIC_TEMPLATES.has(tid) ||
      getCardBuilderTemplate(tid)?.slideRole === "benefits_infographic"
        ? demoteHeavyInfographic(tid, "lamoda")
        : tid,
    );
    ids = moveMainPhotoFirst(ids);
    return uniqRolesPreferred(ids, profile, cluster);
  }

  if (cluster === "classified_listings") {
    ids = moveMainPhotoFirst(
      ids.map((t) => (HEAVY_INFOGRAPHIC_TEMPLATES.has(t) ? "texture_closeup" : t)),
    );
    return uniqRolesPreferred(ids, profile, cluster);
  }

  if (cluster === "brand_ecom") {
    ids = moveMainPhotoFirst(ids);
    return uniqRolesPreferred(ids, profile, cluster);
  }

  if (cluster === "social") {
    ids = uniqRolesPreferred(
      socialCommerceReorder(moveMainPhotoFirst(ids)),
      profile,
      cluster,
    );
    return moveMainPhotoFirst(ids);
  }

  return uniqRolesPreferred(moveMainPhotoFirst(ids), profile, cluster);
}

/** mustShow — добавлять по одному узлу каждого типа после главного. */
function injectMustShow(
  ids: string[],
  must: string[],
  profile: ProductCardMarketplaceProfile,
  cluster: MarketplacePlannerCluster,
): string[] {
  let out = uniqRolesPreferred(ids, profile, cluster);

  const set = new Set(must ?? []);

  const mi = out.findIndex((t) => getCardBuilderTemplate(t)?.slideRole === "main_photo");
  const insertAt = mi >= 0 ? mi + 1 : 0;

  const addRoleOnce = (role: CardBuilderSlideRole) => {
    if (out.some((x) => getCardBuilderTemplate(x)?.slideRole === role)) return;
    const tidBase = defaultTemplateForSlideRole(role);
    const tid =
      cluster === "lamoda" && role === "benefits_infographic" ? "fashion_catalog" : tidBase;
    const c = coerceTemplateAgainstProfile(demoteHeavyInfographic(tid, cluster), profile, cluster);
    if (!c) return;

    /** fashion_catalog уже lifestyle при lamoda-бенефицировании dimensions — OK */
    if (cluster === "lamoda" && role === "lifestyle") {
      const cc = coerceTemplateAgainstProfile("fashion_catalog", profile, cluster);
      if (cc) {
        const copy = [...out];
        copy.splice(insertAt, 0, cc);
        out = uniqRolesPreferred(copy, profile, cluster);
        return;
      }
    }

    const copy = [...out];
    copy.splice(insertAt, 0, c);
    out = uniqRolesPreferred(copy, profile, cluster);
  };

  if (set.has("texture")) addRoleOnce("materials");
  if (set.has("scale")) addRoleOnce("dimensions");
  if (set.has("usage")) addRoleOnce("lifestyle");
  if (set.has("packaging")) addRoleOnce("packaging");
  if (set.has("details")) addRoleOnce("detail_closeup");
  if (set.has("color")) addRoleOnce("materials");
  if (set.has("brand_style")) {
    addRoleOnce("premium_poster");
    if (!out.some((t) => getCardBuilderTemplate(t)?.slideRole === "ad_banner")) {
      const b = coerceTemplateAgainstProfile("ad_banner", profile, cluster);
      if (b && roleOkForPlan(profile, getCardBuilderTemplate(b)!.slideRole)) {
        const copy = [...out];
        copy.push(b);
        out = uniqRolesPreferred(copy, profile, cluster);
      }
    }
  }

  return uniqRolesPreferred(out, profile, cluster);
}

/** Смысловые акценты из benefits[] */
function injectBenefitsSemantics(
  ids: string[],
  input: CardBuilderPlanInput,
  profile: ProductCardMarketplaceProfile,
  cluster: MarketplacePlannerCluster,
): string[] {
  let out = uniqRolesPreferred(ids, profile, cluster);
  const tags = input.benefits ?? [];
  const hasRole = (r: CardBuilderSlideRole) =>
    out.some((t) => getCardBuilderTemplate(t)?.slideRole === r);

  if (
    tags.length >= 3 &&
    profile.infographicAllowed &&
    !hasRole("benefits_infographic")
  ) {
    const tid = demoteHeavyInfographic(
      coerceTemplateAgainstProfile("benefits_grid", profile, cluster) ?? "benefits_grid",
      cluster,
    );
    const c = coerceTemplateAgainstProfile(tid, profile, cluster);
    if (c && roleOkForPlan(profile, getCardBuilderTemplate(c)!.slideRole)) {
      const copy = [...out];
      const ins = Math.min(2, copy.length);
      copy.splice(ins, 0, c);
      out = uniqRolesPreferred(copy, profile, cluster);
    }
  }

  if (
    tags.includes("premium_feel") &&
    roleOkForPlan(profile, "premium_poster") &&
    !hasRole("premium_poster")
  ) {
    const c = coerceTemplateAgainstProfile("premium_poster", profile, cluster);
    if (c) {
      const copy = [...out, c];
      out = uniqRolesPreferred(copy, profile, cluster);
    }
  }

  if (tags.includes("material") && !hasRole("materials")) {
    const c = coerceTemplateAgainstProfile("material_focus", profile, cluster);
    if (c) {
      out = uniqRolesPreferred([...out, c], profile, cluster);
    }
  }

  if (
    tags.includes("comfort") &&
    !hasRole("lifestyle") &&
    roleOkForPlan(profile, "lifestyle")
  ) {
    const c = coerceTemplateAgainstProfile(
      cluster === "lamoda" ? "fashion_catalog" : "lifestyle_card",
      profile,
      cluster,
    );
    if (c) out = uniqRolesPreferred([...out, c], profile, cluster);
  }

  if (tags.includes("size") && !hasRole("dimensions")) {
    const b = inferPlannerBucket(input);
    const tid = b === "apparel_clothing" ? "size_range" : "size_scale";
    const c = coerceTemplateAgainstProfile(tid, profile, cluster);
    if (c) out = uniqRolesPreferred([...out, c], profile, cluster);
  }

  if (
    tags.includes("gift") &&
    !hasRole("packaging") &&
    marketplaceProfileAllowsGalleryRole(profile, "packaging")
  ) {
    const c = coerceTemplateAgainstProfile("package_card", profile, cluster);
    if (c) out = uniqRolesPreferred([...out, c], profile, cluster);
  }

  if (cluster !== "social") return out;

  let seenLs = false;
  return out.filter((t) => {
    if (getCardBuilderTemplate(t)?.slideRole === "lifestyle") {
      if (seenLs) return false;
      seenLs = true;
    }
    return true;
  });
}

function packagingReasonRequired(
  bucket: PlannerBucket,
  mustShow: string[],
  cluster: MarketplacePlannerCluster,
): boolean {
  if (mustShow.includes("packaging")) return true;
  if (bucket === "food") return true;
  if (bucket === "jewelry_accessories") return true;
  if (cluster === "classified_listings") return true;
  return false;
}

function stripUnsupportedPackaging(
  templateIds: string[],
  ok: boolean,
  profile: ProductCardMarketplaceProfile,
  cluster: MarketplacePlannerCluster,
): string[] {
  const out = templateIds.filter((t) =>
    !(getCardBuilderTemplate(t)?.slideRole === "packaging" && !ok),
  );
  return uniqRolesPreferred(out, profile, cluster);
}

/** Без габаритов в форме сохраняем кадр «размеры», дисклеймер в purposeSuffixForSlide. */
function sanitizeGalleryTemplateIds(
  templateIds: string[],
  input: CardBuilderPlanInput,
  profile: ProductCardMarketplaceProfile,
): string[] {
  const hasDims = hasUserDimensionMeasures(input.dimensions);
  const mustScale = input.mustShow.includes("scale");
  return templateIds.map((tid) => {
    const def = getCardBuilderTemplate(tid);
    if (!def) return tid;
    return resolveTemplateWithFallback(tid, {
      categoryKey: input.selectedCategory,
      marketplaceProfile: profile,
      imageRole: def.slideRole,
      hasConcreteDimensions: hasDims,
      mustShowScale: mustScale,
    });
  });
}

/** Если нет цифр в поле размеров — не держать схемы с выдуманными мм; scale → только size_scale. */
function removeDimensionsWithoutMeasures(
  templateIds: string[],
  profile: ProductCardMarketplaceProfile,
  cluster: MarketplacePlannerCluster,
  input: CardBuilderPlanInput,
): string[] {
  const hasDims = hasUserDimensionMeasures(input.dimensions);
  const needsScale = input.mustShow.includes("scale");
  if (hasDims) return templateIds;

  function roleOf(tid: string): CardBuilderSlideRole | null {
    return getCardBuilderTemplate(tid)?.slideRole ?? null;
  }

  const isDimIdx = templateIds.map((tid) => getCardBuilderTemplate(tid)?.slideRole === "dimensions");

  const out: string[] = templateIds.map((tid, i) => {
    if (!isDimIdx[i]) return tid;
    if (needsScale) {
      return coerceTemplateAgainstProfile("size_scale", profile, cluster) ?? tid;
    }
    return tid;
  });

  if (!needsScale) {
    const benefitTid = demoteHeavyInfographic(
      coerceTemplateAgainstProfile("benefits_grid", profile, cluster) ?? "benefits_grid",
      cluster,
    );

    for (let i = 0; i < out.length; i++) {
      if (!isDimIdx[i]) continue;

      const othersRoles = new Set(
        out
          .map((t, j) => (j === i ? null : roleOf(t)))
          .filter((r): r is CardBuilderSlideRole => Boolean(r)),
      );

      const ordered = [
        coerceTemplateAgainstProfile(benefitTid, profile, cluster),
        coerceTemplateAgainstProfile("texture_closeup", profile, cluster),
        coerceTemplateAgainstProfile("material_focus", profile, cluster),
        coerceTemplateAgainstProfile("lifestyle_card", profile, cluster),
        coerceTemplateAgainstProfile("package_card", profile, cluster),
        coerceTemplateAgainstProfile("size_scale", profile, cluster),
      ].filter((x): x is string => Boolean(x));

      const uniqCandidates: string[] = [];
      const seen = new Set<string>();
      for (const c of ordered) {
        if (seen.has(c)) continue;
        seen.add(c);
        uniqCandidates.push(c);
      }

      const picked =
        uniqCandidates.find((c) => {
          const r = roleOf(c);
          return r && !othersRoles.has(r);
        }) ??
        coerceTemplateAgainstProfile("size_scale", profile, cluster) ??
        templateIds[i]!;

      out[i] = picked;
    }
  }

  return out;
}

function maybeSwapPosterForBanner(templateIds: string[], input: CardBuilderPlanInput): string[] {
  if (input.marketplace !== "instagram_vk" && input.salesStyle !== "bold_ad") return templateIds;
  const copy = [...templateIds];
  const lastIdx = copy.length - 1;
  const lastTpl = copy[lastIdx] ? getCardBuilderTemplate(copy[lastIdx]!) : undefined;
  if (lastTpl?.slideRole === "premium_poster") {
    copy[lastIdx] = "ad_banner";
  }
  return copy;
}

function categoryLabelRu(categoryId: string): string {
  const cat = getPublicProductCategories().find((c) => c.id === categoryId);
  return cat?.label?.trim() || categoryId;
}

function pickTextMode(
  userMode: string,
  recommended: CardBuilderGallerySlide["recommendedTextMode"],
): CardBuilderGallerySlide["recommendedTextMode"] {
  const u = userMode.trim().toLowerCase();
  if (u === "none" || u === "minimal" || u === "medium" || u === "heavy" || u === "infographic") {
    return u;
  }
  return recommended;
}

function purposeSuffixForSlide(
  imageRole: CardBuilderSlideRole,
  profile: ProductCardMarketplaceProfile,
  marketplaceCluster: MarketplacePlannerCluster,
  input: CardBuilderPlanInput,
): string[] {
  const bits: string[] = [];
  if (marketplaceCluster === "amazon" && imageRole === "main_photo") {
    bits.push("Профиль Amazon: только товар на чистом белом фоне, без текста и реквизита.");
  }
  if (marketplaceCluster === "classified_mp" || marketplaceCluster === "amazon") {
    if (imageRole === "main_photo") {
      bits.push("Не перегружать маркетплейсное главное окно текстом или «афишностью».");
    }
    if (imageRole === "benefits_infographic") {
      bits.push(
        "Тяжёлая инфографика здесь вторичная — сохранять читаемость и связь только с уже заданными преимуществами формы.",
      );
    }
  }
  if (marketplaceCluster === "lamoda" && imageRole === "main_photo") {
    bits.push("Стиль модного каталога: нейтральный фон, без тяжёлых маркетплейсовых табло.");
  }

  /** Food/medical disclaimers **/
  const bucket = inferPlannerBucket(input);
  if (
    bucket === "food" &&
    (imageRole === "materials" || imageRole === "benefits_infographic")
  ) {
    bits.push("Еда и вкусовые обещания — только там, где вы это явно указали текстом заказчика.");
  }

  /** Electronics — не выдумывать ТТХ **/
  if (bucket === "gadgets" && (imageRole === "detail_closeup" || imageRole === "benefits_infographic")) {
    bits.push("Не добавлять номинальный Wi‑Fi, мАч, разрешения экранов и прочее без указанного текста клиента.");
  }

  /** Beauty — без лечебных обещаний **/
  if (bucket === "beauty" || bucket === "food") {
    if (imageRole === "materials" || imageRole === "benefits_infographic") {
      bits.push(
        "Медицинские и излечивающие преимущества не формулируем без подтверждённой формулировки клиента.",
      );
    }
  }

  if (input.preserveProduct) bits.push("Сохраняем узнаваемость товара там, где вы это выбрали в настройках.");

  if (!hasUserDimensionMeasures(input.dimensions) && imageRole === "dimensions") {
    bits.push(
      "Визуальная соразмерность без конкретных чисел из формы: не добавлять вымышленные миллиметры и лишние цифры.",
    );
  }

  if (bucket === "jewelry_accessories" && marketplaceCluster !== "social") {
    bits.push(
      "Аккуратнее с формой и брендовыми элементами — не добавлять украшения и логотипы, если их не было во входном фото.",
    );
  }

  return bits.filter(Boolean);
}

function buildSlideFromTemplate(
  templateId: string,
  idx: number,
  input: CardBuilderPlanInput,
  categoryRu: string,
  profile: ProductCardMarketplaceProfile,
  cluster: MarketplacePlannerCluster,
): CardBuilderGallerySlide | null {
  const def = getCardBuilderTemplate(templateId);
  if (!def) return null;
  const base = ROLE_META[def.slideRole];
  const slideId = `${String(idx + 1).padStart(2, "0")}_${def.slideRole}`;
  const suffix = purposeSuffixForSlide(def.slideRole, profile, cluster, input);
  const adaptedPurpose =
    `${base.purposeRu} Контекст категории: ${categoryRu}.` +
    (suffix.length ? ` Дополнительно: ${suffix.join(" ")}` : "");

  let tm: CardBuilderGallerySlide["recommendedTextMode"];
  const mainNoTextCluster =
    cluster === "classified_mp" ||
    cluster === "amazon" ||
    cluster === "lamoda" ||
    cluster === "classified_listings";

  if (def.slideRole === "main_photo") {
    if (!profile.mainPhotoTextAllowed || mainNoTextCluster) {
      tm = "none";
    } else {
      tm = pickTextMode(input.textDensity, profile.mainPhotoRules.recommendedTextDensity);
    }
  } else if (def.slideRole === "benefits_infographic") {
    const cap = Math.min(profile.maxBenefitBadges, profile.infographicRules.maxBenefitBadges);
    if (!profile.infographicAllowed || cap <= 0) {
      tm = "none";
    } else {
      tm = pickTextMode(input.textDensity, def.defaultTextDensity);
    }
  } else if (def.slideRole === "lifestyle") {
    tm = profile.lifestyleAllowed
      ? pickTextMode(input.textDensity, def.defaultTextDensity)
      : "none";
  } else {
    tm = pickTextMode(input.textDensity, def.defaultTextDensity);
  }

  /** Заглушить лишний текст главного там, где площадка хочет none */
  if (def.slideRole === "main_photo" && !profile.mainPhotoTextAllowed && input.goal === "main_photo") {
    tm = "none";
  }

  return {
    slideId,
    title: base.title,
    purpose: adaptedPurpose,
    previewCaption: "",
    imageRole: def.slideRole,
    templateId: def.templateId,
    templateLabel: def.label,
    layoutPreset: def.layoutPreset,
    overlayRequired: false,
    textSlots: [...def.textSlots],
    iconSlots: [...def.iconSlots],
    textRenderMode: "ai_text_in_design",
    marketplaceProfileId: profile.id,
    recommendedTextMode: tm,
    promptIntent: base.promptIntent,
    sourceImageMode: input.allowCreativeStylization ? "variant" : base.sourceMode,
  };
}

function templatesBenefitsGoal(
  input: CardBuilderPlanInput,
  profile: ProductCardMarketplaceProfile,
  cluster: MarketplacePlannerCluster,
): string[] {
  const benefitTid =
    profile.infographicAllowed
      ? coerceTemplateAgainstProfile(demoteHeavyInfographic("benefits_grid", cluster), profile, cluster) ??
        "benefits_grid"
      : coerceTemplateAgainstProfile(
          cluster === "lamoda" ? "fashion_catalog" : "texture_closeup",
          profile,
          cluster,
        ) ?? "texture_closeup";

  const mainTid =
    coerceTemplateAgainstProfile(defaultMainTemplate(cluster), profile, cluster) ?? "hero_clean";

  let seq = uniqRolesPreferred([benefitTid, mainTid], profile, cluster);

  const mustAdds: CardBuilderSlideRole[] = [];
  if (input.mustShow.includes("details")) mustAdds.push("detail_closeup");
  else if (input.mustShow.includes("texture")) mustAdds.push("materials");

  for (const r of mustAdds) {
    const tid = coerceTemplateAgainstProfile(defaultTemplateForSlideRole(r), profile, cluster);
    if (!tid || seq.some((t) => getCardBuilderTemplate(t)?.slideRole === r)) continue;
    seq.splice(1, 0, tid);
    seq = uniqRolesPreferred(seq, profile, cluster);
  }

  return seq;
}

function trimOrExtend(
  ids: string[],
  count: number,
  bucket: PlannerBucket,
  profile: ProductCardMarketplaceProfile,
  cluster: MarketplacePlannerCluster,
): string[] {
  const n = Math.min(Math.max(count, 1), 8) as 6 | 8;
  let out = uniqRolesPreferred(ids, profile, cluster);

  if (out.length > n) {
    out = out.slice(0, n);
    out = uniqRolesPreferred(out, profile, cluster);
  }

  if (out.length < n) out = extendToSlideCount(out, n, bucket, profile, cluster);
  return uniqRolesPreferred(out.slice(0, n), profile, cluster);
}

/** Публичное API: сборка плана галереи */
export function buildCardBuilderGalleryPlan(
  input: CardBuilderPlanInput,
  profile: ProductCardMarketplaceProfile,
): { slides: CardBuilderGallerySlide[]; planWarning?: string } {
  const cluster = plannerCluster(profile.id);
  const bucket = inferPlannerBucket(input);
  const catRu = categoryLabelRu(input.selectedCategory);

  const slideGoalCount: number =
    input.goal === "full_gallery_8" ? 8 : input.goal === "full_gallery_6" ? 6 : 1;

  let templateIds: string[] = [];
  let planWarning: string | undefined;

  switch (input.goal) {
    case "main_photo":
      templateIds = [
        coerceTemplateAgainstProfile(defaultMainTemplate(cluster), profile, cluster) ?? "hero_clean",
      ];
      break;
    case "benefits_info":
      templateIds = templatesBenefitsGoal(input, profile, cluster);
      break;
    case "dimensions_slide": {
      if (!hasUserDimensionMeasures(input.dimensions)) {
        planWarning =
          "Размеры в форме не заполнены — использован слайд «Масштаб и размеры» без точных цифр. Добавьте габариты в поле размеров для схемы с числами.";
      }
      const dimPreferred =
        hasUserDimensionMeasures(input.dimensions)
          ? coerceTemplateAgainstProfile(defaultTemplateForSlideRole("dimensions"), profile, cluster)!
          : coerceTemplateAgainstProfile("size_scale", profile, cluster) ??
            coerceTemplateAgainstProfile(defaultTemplateForSlideRole("dimensions"), profile, cluster)!;
      const dimTid = resolveTemplateWithFallback(dimPreferred, {
        categoryKey: input.selectedCategory,
        marketplaceProfile: profile,
        imageRole: "dimensions",
        hasConcreteDimensions: hasUserDimensionMeasures(input.dimensions),
        mustShowScale: input.mustShow.includes("scale"),
      });
      templateIds = [dimTid];
      break;
    }
    case "materials_slide":
      templateIds = [coerceTemplateAgainstProfile(defaultTemplateForSlideRole("materials"), profile, cluster)!];
      break;
    case "lifestyle":
      templateIds = [
        coerceTemplateAgainstProfile(
          cluster === "lamoda" ? "fashion_catalog" : defaultTemplateForSlideRole("lifestyle"),
          profile,
          cluster,
        )!,
      ];
      break;
    case "detail_closeup":
      templateIds = [coerceTemplateAgainstProfile(defaultTemplateForSlideRole("detail_closeup"), profile, cluster)!];
      break;
    case "packaging_kit":
      templateIds = [
        coerceTemplateAgainstProfile(defaultTemplateForSlideRole("packaging"), profile, cluster) ??
          coerceTemplateAgainstProfile("package_card", profile, cluster)!,
      ];
      break;
    case "premium_poster":
      templateIds = [
        coerceTemplateAgainstProfile(defaultTemplateForSlideRole("premium_poster"), profile, cluster)!,
      ];
      break;
    case "full_gallery_6":
    case "full_gallery_8": {
      const galleryCount = slideGoalCount === 8 ? 8 : 6;
      const baseSeq = reconcileIngredientSlides(
        pickGalleryTemplateSequenceForPlan(input, galleryCount),
        bucket,
        input,
      );
      let draft = uniqRolesPreferred(baseSeq, profile, cluster);
      draft = applyClusterGalleryRules(draft, cluster, profile);
      draft = injectMustShow(draft, input.mustShow, profile, cluster);
      draft = injectBenefitsSemantics(draft, input, profile, cluster);

      draft = stripUnsupportedPackaging(
        draft,
        packagingReasonRequired(bucket, input.mustShow, cluster),
        profile,
        cluster,
      );
      draft = removeDimensionsWithoutMeasures(draft, profile, cluster, input);
      draft = sanitizeGalleryTemplateIds(draft, input, profile);
      draft = uniqRolesPreferred(draft, profile, cluster);

      /** TODO: когда UI будет стабильно оплачивать ровно 8 кадров вне Kuz category-наборов, расширить политику здесь. Сейчас — дотягивание ролями профиля. */
      draft = trimOrExtend(draft, slideGoalCount === 8 ? 8 : 6, bucket, profile, cluster);
      draft = maybeSwapPosterForBanner(draft, input);

      templateIds = draft;
      break;
    }
    default:
      templateIds = [coerceTemplateAgainstProfile(defaultMainTemplate(cluster), profile, cluster) ?? "hero_clean"];
      break;
  }

  templateIds =
    slideGoalCount > 1
      ? uniqRolesPreferred(
          sanitizeGalleryTemplateIds(
            reconcileIngredientSlides(
              stripUnsupportedPackaging(
                removeDimensionsWithoutMeasures(
                  uniqRolesPreferred([...templateIds], profile, cluster),
                  profile,
                  cluster,
                  input,
                ),
                packagingReasonRequired(bucket, input.mustShow, cluster),
                profile,
                cluster,
              ),
              bucket,
              input,
            ),
            input,
            profile,
          ),
          profile,
          cluster,
        )
      : templateIds;

  if (slideGoalCount > 1 && input.goal !== "full_gallery_6" && input.goal !== "full_gallery_8") {
    templateIds = trimOrExtend(templateIds, slideGoalCount, bucket, profile, cluster);
  }

  const slidesBuilt: CardBuilderGallerySlide[] = [];
  templateIds.forEach((tid, idx) => {
    const slide = buildSlideFromTemplate(tid, idx, input, catRu, profile, cluster);
    if (slide) slidesBuilt.push(slide);
  });

  return planWarning ? { slides: slidesBuilt, planWarning } : { slides: slidesBuilt };
}
