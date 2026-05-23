import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";
import {
  hasBenefitProductFacts,
  hasDimensionProductFacts,
  lockedTextPhrasesFromFacts,
  productFactsForSlideRole,
  type CardBuilderProductFact,
} from "@/lib/card-builder-product-facts";

export type SlidePreviewFactRow = {
  id: string;
  label: string;
  value: string;
  /** Пользовательский бейдж «Точный текст». */
  exactText: boolean;
};

export type SlidePreviewModel = {
  index: number;
  slideId: string;
  title: string;
  purpose: string;
  templateLabel: string;
  cardTextPhrases: string[];
  facts: SlidePreviewFactRow[];
  warning: string | null;
};

const SLIDE_PURPOSES: Record<CardBuilderTemplateSlideRole, string> = {
  main_photo: "Показать товар крупно на чистом фоне",
  benefits_infographic: "Показать ключевые преимущества",
  detail_closeup: "Показать детали и особенности товара",
  materials: "Показать материал и фактуру",
  dimensions: "Показать размер, объём или габариты",
  lifestyle: "Показать товар в сцене использования",
  packaging: "Показать комплектацию и упаковку",
  premium_poster: "Премиальная визуальная подача товара",
  ad_banner: "Рекламный акцент на товаре",
};

/** Понятные названия слайдов (без imageRole/templateId). */
export const CARD_BUILDER_SLIDE_USER_TITLES: Record<CardBuilderTemplateSlideRole, string> = {
  main_photo: "Главное фото",
  benefits_infographic: "Преимущества",
  detail_closeup: "Детали",
  materials: "Материал",
  dimensions: "Размеры / характеристики",
  lifestyle: "Lifestyle",
  packaging: "Комплектация",
  premium_poster: "Premium-баннер",
  ad_banner: "Рекламный баннер",
};

export function slideUserTitle(slideRole: string): string {
  const key = slideRole.trim() as CardBuilderTemplateSlideRole;
  return CARD_BUILDER_SLIDE_USER_TITLES[key] ?? "Карточка";
}

export function slidePurpose(slideRole: string): string {
  const key = slideRole.trim() as CardBuilderTemplateSlideRole;
  return SLIDE_PURPOSES[key] ?? "Показать товар в подходящем формате";
}

export function computeSlideCardTextPhrases(
  slideRole: CardBuilderTemplateSlideRole,
  productFacts: readonly CardBuilderProductFact[],
  opts: {
    productTitle?: string;
    textDensity: string;
    mainPhotoTextAllowed?: boolean;
  },
): string[] {
  let density = opts.textDensity.trim() || "medium";
  if (slideRole === "main_photo" && opts.mainPhotoTextAllowed === false) {
    density = "none";
  }
  const showCardTextLayer = density !== "none";
  const slideFacts = productFactsForSlideRole(productFacts, slideRole);
  const fromFacts = lockedTextPhrasesFromFacts(slideFacts);

  const raw: string[] = [];
  if (showCardTextLayer) {
    const t = opts.productTitle?.trim();
    if (t) raw.push(t);
    for (const line of fromFacts) {
      raw.push(line);
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of raw) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function slidePreviewFactRows(
  slideRole: CardBuilderTemplateSlideRole,
  productFacts: readonly CardBuilderProductFact[],
): SlidePreviewFactRow[] {
  return productFactsForSlideRole(productFacts, slideRole).map((f) => ({
    id: f.id,
    label: f.label,
    value: f.value,
    exactText: f.lockedText !== false,
  }));
}

export function collectUsedProductFactIds(
  slideRoles: readonly string[],
  productFacts: readonly CardBuilderProductFact[],
): Set<string> {
  const used = new Set<string>();
  for (const roleRaw of slideRoles) {
    const role = roleRaw.trim() as CardBuilderTemplateSlideRole;
    for (const f of productFactsForSlideRole(productFacts, role)) {
      used.add(f.id);
    }
  }
  return used;
}

export function unusedProductFactsForSlides(
  slideRoles: readonly string[],
  productFacts: readonly CardBuilderProductFact[],
): CardBuilderProductFact[] {
  const used = collectUsedProductFactIds(slideRoles, productFacts);
  return productFacts.filter((f) => !used.has(f.id));
}

export function slidePreviewWarning(
  slideRole: CardBuilderTemplateSlideRole,
  factsForSlide: readonly SlidePreviewFactRow[],
  allFacts: readonly CardBuilderProductFact[],
): string | null {
  if (slideRole === "benefits_infographic" && !hasBenefitProductFacts(allFacts)) {
    return "Нет данных о преимуществах — проверьте структуру карточки.";
  }
  if (slideRole === "dimensions") {
    if (!hasDimensionProductFacts(allFacts)) {
      return "Добавьте размер, объём или вес, чтобы слайд был точнее.";
    }
  }
  if (slideRole === "materials") {
    const hasMaterial = allFacts.some(
      (f) => f.type === "material" && f.visibleOnCard !== false && f.value.trim(),
    );
    if (!hasMaterial) {
      return "Добавьте материал товара, если хотите показать его на карточке.";
    }
  }
  if (slideRole === "packaging") {
    const hasPkg = allFacts.some(
      (f) => f.type === "package" && f.visibleOnCard !== false && f.value.trim(),
    );
    if (!hasPkg) {
      return "Добавьте состав комплекта или упаковку, если хотите показать их на карточке.";
    }
  }
  if (slideRole === "lifestyle") {
    const hasUsage = allFacts.some(
      (f) => f.type === "usage" && f.visibleOnCard !== false && f.value.trim(),
    );
    const hasPurpose = allFacts.some(
      (f) => f.type === "product_purpose" && f.visibleOnCard !== false && f.value.trim(),
    );
    if (!hasUsage && !hasPurpose) {
      return "Добавьте сценарий использования или назначение товара, чтобы lifestyle-кадр был точнее.";
    }
  }
  if (factsForSlide.length === 0 && slideRole !== "main_photo" && slideRole !== "premium_poster") {
    return "Для этого слайда можно добавить больше данных.";
  }
  return null;
}

export type BuildSlidePreviewInput = {
  slideId: string;
  imageRole: string;
  templateLabel?: string;
  title?: string;
};

export function buildSlidePreviewModels(
  slides: readonly BuildSlidePreviewInput[],
  productFacts: readonly CardBuilderProductFact[],
  opts: {
    productTitle?: string;
    textDensity: string;
    mainPhotoTextAllowed?: boolean;
  },
): SlidePreviewModel[] {
  return slides.map((slide, idx) => {
    const role = slide.imageRole.trim() as CardBuilderTemplateSlideRole;
    const facts = slidePreviewFactRows(role, productFacts);
    return {
      index: idx + 1,
      slideId: slide.slideId,
      title: slideUserTitle(role),
      purpose: slidePurpose(role),
      templateLabel: slide.templateLabel?.trim() || slide.title?.trim() || "Шаблон карточки",
      cardTextPhrases: computeSlideCardTextPhrases(role, productFacts, opts),
      facts,
      warning: slidePreviewWarning(role, facts, productFacts),
    };
  });
}

export function formatUnusedFactLine(fact: CardBuilderProductFact): string {
  const label = fact.label.trim();
  const value = fact.value.trim();
  if (label && value) return `${label}: ${value}`;
  return value || label;
}
