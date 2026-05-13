import {
  defaultTemplateForSlideRole,
  getCardBuilderTemplate,
  pickGalleryTemplateSequence,
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

export type CardBuilderGallerySlide = {
  slideId: string;
  title: string;
  purpose: string;
  /** Короткое описание для пользователя в превью */
  previewCaption: string;
  imageRole: CardBuilderSlideRole;
  templateId: string;
  templateLabel: string;
  layoutPreset: string;
  overlayRequired: boolean;
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
  /** Зеркало `benefits` в сохранённом metadata (семантические акценты). */
  semanticBenefits?: string[];
  /** Зеркало `benefitsExtra` — дословный текст клиента («Дополнительные преимущества»). */
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
  /** Рекомендуемые выходные пропорции под площадку (подсказка / metadata) */
  cardBuilderTargetAspectRatio?: string;
  cardBuilderTargetSize?: string;
};

const BASE_SLIDES: Record<
  CardBuilderSlideRole,
  Omit<
    CardBuilderGallerySlide,
    | "slideId"
    | "previewCaption"
    | "templateId"
    | "templateLabel"
    | "layoutPreset"
    | "overlayRequired"
    | "textSlots"
    | "iconSlots"
    | "overlayTexts"
    | "overlayBenefitIcons"
    | "needsMoreBenefits"
  >
> = {
  main_photo: {
    title: "Главное фото",
    purpose: "Показать товар на чистом читаемом фоне как герой кадра",
    imageRole: "main_photo",
    recommendedTextMode: "none",
    promptIntent: "clean catalog hero image",
    sourceImageMode: "original",
  },
  benefits_infographic: {
    title: "Преимущества",
    purpose: "Визуально выделить ключевые УТП; текст задаётся серверным overlay",
    imageRole: "benefits_infographic",
    recommendedTextMode: "medium",
    promptIntent: "benefit-led selling layout without readable bitmap text",
    sourceImageMode: "original",
  },
  dimensions: {
    title: "Размеры",
    purpose: "Показать габариты и масштаб наглядно",
    imageRole: "dimensions",
    recommendedTextMode: "minimal",
    promptIntent: "scale and dimension readability",
    sourceImageMode: "original",
  },
  materials: {
    title: "Материалы",
    purpose: "Раскрыть фактуру и качество материала",
    imageRole: "materials",
    recommendedTextMode: "minimal",
    promptIntent: "material macro and tactile premium cues",
    sourceImageMode: "original",
  },
  lifestyle: {
    title: "Lifestyle",
    purpose: "Товар в естественном сценарии использования",
    imageRole: "lifestyle",
    recommendedTextMode: "minimal",
    promptIntent: "aspirational in-context lifestyle commerce",
    sourceImageMode: "original",
  },
  premium_poster: {
    title: "Постер",
    purpose: "Сильный рекламный кадр с премиальной подачёй",
    imageRole: "premium_poster",
    recommendedTextMode: "minimal",
    promptIntent: "premium retail poster hero",
    sourceImageMode: "original",
  },
  detail_closeup: {
    title: "Детали",
    purpose: "Крупный план якорной детали или фактуры",
    imageRole: "detail_closeup",
    recommendedTextMode: "none",
    promptIntent: "macro hero detail fidelity",
    sourceImageMode: "original",
  },
  packaging: {
    title: "Упаковка / комплект",
    purpose: "Комплектация и упаковка",
    imageRole: "packaging",
    recommendedTextMode: "minimal",
    promptIntent: "kit and packaging storytelling",
    sourceImageMode: "original",
  },
  ad_banner: {
    title: "Рекламный баннер",
    purpose: "Яркая рекламная подача с местом под текст overlay",
    imageRole: "ad_banner",
    recommendedTextMode: "minimal",
    promptIntent: "bold ecommerce banner framing",
    sourceImageMode: "original",
  },
};

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

function roleOkInFullGallery(
  profile: ProductCardMarketplaceProfile,
  role: CardBuilderTemplateSlideRole,
): boolean {
  if (!marketplaceProfileAllowsGalleryRole(profile, role)) return false;
  if (role === "benefits_infographic") {
    const cap = Math.min(profile.maxBenefitBadges, profile.infographicRules.maxBenefitBadges);
    return profile.infographicAllowed && cap > 0;
  }
  if (role === "lifestyle") {
    return profile.lifestyleAllowed;
  }
  return true;
}

function rolesForFullGalleryFromProfile(
  profile: ProductCardMarketplaceProfile,
  slideCount: 6 | 8,
  categoryId: string,
): CardBuilderTemplateSlideRole[] {
  const allowed = new Set<string>(
    profile.allowedSlideTypes.filter((r) =>
      roleOkInFullGallery(profile, r as CardBuilderTemplateSlideRole),
    ),
  );
  const fromRec = profile.recommendedSlides.filter((r) => allowed.has(r));
  const uniq: CardBuilderTemplateSlideRole[] = [];
  const seen = new Set<string>();
  for (const r of fromRec) {
    if (!seen.has(r)) {
      seen.add(r);
      uniq.push(r as CardBuilderTemplateSlideRole);
    }
    if (uniq.length >= slideCount) return uniq.slice(0, slideCount);
  }

  const fallbackTplIds = pickGalleryTemplateSequence(categoryId, slideCount);
  for (const tid of fallbackTplIds) {
    const tpl = getCardBuilderTemplate(tid);
    const r = tpl?.slideRole;
    if (!r || !allowed.has(r)) continue;
    if (!seen.has(r)) {
      seen.add(r);
      uniq.push(r);
    }
    if (uniq.length >= slideCount) return uniq.slice(0, slideCount);
  }

  for (const r of profile.allowedSlideTypes) {
    if (!seen.has(r)) {
      seen.add(r);
      uniq.push(r as CardBuilderTemplateSlideRole);
    }
    if (uniq.length >= slideCount) return uniq.slice(0, slideCount);
  }

  const cycle = uniq.length ? uniq : (["main_photo"] as CardBuilderTemplateSlideRole[]);
  const out = [...uniq];
  let i = 0;
  while (out.length < slideCount && cycle.length > 0) {
    out.push(cycle[i % cycle.length]!);
    i += 1;
  }
  return out.slice(0, slideCount);
}

function buildSlideFromTemplate(
  templateId: string,
  idx: number,
  input: CardBuilderPlanInput,
  categoryRu: string,
  profile: ProductCardMarketplaceProfile,
): CardBuilderGallerySlide | null {
  const def = getCardBuilderTemplate(templateId);
  if (!def) return null;
  const base = BASE_SLIDES[def.slideRole];
  const slideId = `${String(idx + 1).padStart(2, "0")}_${def.slideRole}`;
  const adaptedPurpose = `${base.purpose} (${categoryRu}).`;
  let tm: CardBuilderGallerySlide["recommendedTextMode"];

  if (def.slideRole === "main_photo") {
    tm = profile.mainPhotoTextAllowed
      ? pickTextMode(input.textDensity, profile.mainPhotoRules.recommendedTextDensity)
      : "none";
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

  return {
    slideId,
    title: base.title,
    purpose: adaptedPurpose,
    previewCaption: "",
    imageRole: def.slideRole,
    templateId: def.templateId,
    templateLabel: def.label,
    layoutPreset: def.layoutPreset,
    overlayRequired: def.overlayRequired,
    textSlots: [...def.textSlots],
    iconSlots: [...def.iconSlots],
    recommendedTextMode: tm,
    promptIntent: base.promptIntent,
    sourceImageMode: input.allowCreativeStylization ? "variant" : base.sourceImageMode,
  };
}

function maybeSwapPosterForBanner(templateIds: string[], input: CardBuilderPlanInput): string[] {
  if (input.marketplace !== "instagram_vk" && input.salesStyle !== "bold_ad") {
    return templateIds;
  }
  const copy = [...templateIds];
  const lastIdx = copy.length - 1;
  const lastId = copy[lastIdx];
  const lastTpl = lastId ? getCardBuilderTemplate(lastId) : undefined;
  if (lastTpl?.slideRole === "premium_poster") {
    copy[lastIdx] = "ad_banner";
  }
  return copy;
}

/** Rule-based галерея: категория → шаблоны слайдов; goal задаёт число кадров. */
export function buildCardBuilderGalleryPlan(
  input: CardBuilderPlanInput,
  profile: ProductCardMarketplaceProfile,
): {
  slides: CardBuilderGallerySlide[];
} {
  const catRu = categoryLabelRu(input.selectedCategory);

  let templateIds: string[];

  switch (input.goal) {
    case "full_gallery_8":
      templateIds = rolesForFullGalleryFromProfile(profile, 8, input.selectedCategory).map((r) =>
        defaultTemplateForSlideRole(r),
      );
      templateIds = maybeSwapPosterForBanner(templateIds, input);
      break;
    case "full_gallery_6":
      templateIds = rolesForFullGalleryFromProfile(profile, 6, input.selectedCategory).map((r) =>
        defaultTemplateForSlideRole(r),
      );
      templateIds = maybeSwapPosterForBanner(templateIds, input);
      break;
    case "main_photo":
      templateIds = [defaultTemplateForSlideRole("main_photo")];
      break;
    case "benefits_info":
      templateIds = [defaultTemplateForSlideRole("benefits_infographic")];
      break;
    case "dimensions_slide":
      templateIds = [defaultTemplateForSlideRole("dimensions")];
      break;
    case "materials_slide":
      templateIds = [defaultTemplateForSlideRole("materials")];
      break;
    case "lifestyle":
      templateIds = [defaultTemplateForSlideRole("lifestyle")];
      break;
    case "detail_closeup":
      templateIds = [defaultTemplateForSlideRole("detail_closeup")];
      break;
    case "packaging_kit":
      templateIds = [defaultTemplateForSlideRole("packaging")];
      break;
    case "premium_poster":
      templateIds = [defaultTemplateForSlideRole("premium_poster")];
      break;
    default:
      templateIds = [defaultTemplateForSlideRole("main_photo")];
  }

  const slides: CardBuilderGallerySlide[] = [];
  templateIds.forEach((tid, idx) => {
    const s = buildSlideFromTemplate(tid, idx, input, catRu, profile);
    if (s) slides.push(s);
  });

  return { slides };
}
