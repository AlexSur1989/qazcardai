/**
 * Профили маркетплейсов для Product Card / «Создать карточку» (card_builder).
 * Источник правды по умолчанию в коде; переопределения — AppSetting PRODUCT_CARD_MARKETPLACE_PROFILES.
 *
 * Не утверждаем спорные требования как абсолют: при сомнении — needsVerification / sourceLevel.
 */

import type { CardBuilderTemplateSlideRole } from "@/config/card-builder-templates";

export const PRODUCT_CARD_MARKETPLACE_PROFILE_VERSION = "v1" as const;

export type ProductCardMarketplaceSourceLevel =
  | "official"
  | "secondary"
  | "default"
  | "mixed";

export type ProductCardMarketplaceProfile = {
  id: string;
  label: string;
  description?: string;
  sourceLevel: ProductCardMarketplaceSourceLevel;
  needsVerification?: boolean;
  enabled: boolean;
  defaultAspectRatio: string;
  defaultSize: string;
  extraAspectRatios?: string[];
  extraSizes?: string[];
  fileFormats?: string[];
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxFileSizeMb?: number;
  mainPhotoTextAllowed: boolean;
  infographicAllowed: boolean;
  lifestyleAllowed: boolean;
  preserveProductRequired: boolean;
  avoidWatermarks: boolean;
  avoidExtraObjects: boolean;
  avoidLogos?: boolean;
  avoidPriceLabels?: boolean;
  avoidContacts?: boolean;
  maxBenefitBadges: number;
  recommendedSlides: string[];
  allowedSlideTypes: string[];
  mainPhotoRules: {
    textAllowed: boolean;
    recommendedTextDensity: "none" | "minimal" | "medium" | "heavy" | "infographic";
    background:
      | "pure_white"
      | "white"
      | "clean"
      | "neutral"
      | "realistic"
      | "brand"
      | "lifestyle"
      | "custom";
    productFocus: "strict" | "high" | "medium" | "flexible";
    preserveProductRequired: boolean;
    avoidExtraObjects: boolean;
    promptInstruction: string;
  };
  infographicRules: {
    textAllowed: boolean;
    maxBenefitBadges: number;
    iconsAllowed: boolean;
    largeReadableText: boolean;
    promptInstruction: string;
  };
  lifestyleRules: {
    allowed: boolean;
    promptInstruction: string;
  };
  promptInstruction: string;
  userHint: string;
  complianceHints: string[];
};

/** Алиасы ролей слайдов из внешних ТЗ → роли card_builder. */
const SLIDE_ROLE_ALIASES: Record<string, CardBuilderTemplateSlideRole> = {
  package: "packaging",
  front_view: "main_photo",
  back_view: "detail_closeup",
  scale: "dimensions",
  details: "detail_closeup",
};

const VALID_ROLES = new Set<CardBuilderTemplateSlideRole>([
  "main_photo",
  "benefits_infographic",
  "dimensions",
  "materials",
  "lifestyle",
  "detail_closeup",
  "packaging",
  "premium_poster",
  "ad_banner",
]);

export function normalizeMarketplaceSlideRole(
  raw: string,
): CardBuilderTemplateSlideRole | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (VALID_ROLES.has(s as CardBuilderTemplateSlideRole)) {
    return s as CardBuilderTemplateSlideRole;
  }
  const mapped = SLIDE_ROLE_ALIASES[s];
  return mapped ?? null;
}

export function normalizeSlideRoleList(list: string[]): CardBuilderTemplateSlideRole[] {
  const out: CardBuilderTemplateSlideRole[] = [];
  const seen = new Set<string>();
  for (const x of list) {
    const r = normalizeMarketplaceSlideRole(x);
    if (r && !seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  return out;
}

/** Снимок для metadata (без тяжёлых вложенных объектов). */
export type AppliedMarketplaceRulesSnapshot = {
  defaultAspectRatio: string;
  defaultSize: string;
  mainPhotoTextAllowed: boolean;
  maxBenefitBadges: number;
  sourceLevel: ProductCardMarketplaceSourceLevel;
  needsVerification?: boolean;
  infographicAllowed: boolean;
  lifestyleAllowed: boolean;
};

export function buildAppliedMarketplaceRulesSnapshot(
  p: ProductCardMarketplaceProfile,
): AppliedMarketplaceRulesSnapshot {
  return {
    defaultAspectRatio: p.defaultAspectRatio,
    defaultSize: p.defaultSize,
    mainPhotoTextAllowed: p.mainPhotoTextAllowed,
    maxBenefitBadges: p.maxBenefitBadges,
    sourceLevel: p.sourceLevel,
    needsVerification: p.needsVerification,
    infographicAllowed: p.infographicAllowed,
    lifestyleAllowed: p.lifestyleAllowed,
  };
}

function p(x: ProductCardMarketplaceProfile): ProductCardMarketplaceProfile {
  return {
    ...x,
    allowedSlideTypes: normalizeSlideRoleList(x.allowedSlideTypes),
    recommendedSlides: normalizeSlideRoleList(x.recommendedSlides),
  };
}

export const PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS: ProductCardMarketplaceProfile[] =
  [
    p({
      id: "kaspi",
      label: "Kaspi",
      sourceLevel: "official",
      enabled: true,
      defaultAspectRatio: "1:1",
      defaultSize: "1500x1500",
      minWidth: 500,
      minHeight: 500,
      maxWidth: 5000,
      maxHeight: 5000,
      maxFileSizeMb: 25,
      mainPhotoTextAllowed: false,
      infographicAllowed: true,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: true,
      maxBenefitBadges: 5,
      recommendedSlides: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "packaging",
      ],
      allowedSlideTypes: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "packaging",
        "premium_poster",
      ],
      mainPhotoRules: {
        textAllowed: false,
        recommendedTextDensity: "none",
        background: "clean",
        productFocus: "strict",
        preserveProductRequired: true,
        avoidExtraObjects: true,
        promptInstruction:
          "Главное фото для Kaspi: товар должен быть крупным, чётким, в фокусе, без текста, без водяных знаков, без лишних объектов. Если это комплект, показать все элементы комплекта.",
      },
      infographicRules: {
        textAllowed: true,
        maxBenefitBadges: 5,
        iconsAllowed: true,
        largeReadableText: true,
        promptInstruction:
          "Дополнительные слайды Kaspi могут содержать преимущества, детали, комплектацию и характеристики. Текст должен быть крупным и читаемым.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction:
          "Lifestyle-слайд допустим как дополнительное изображение, но товар должен оставаться главным объектом.",
      },
      promptInstruction:
        "Создай чистую карточку товара для Kaspi. Сохрани идентичность товара, не добавляй водяные знаки, лишние товары и неподтверждённые характеристики.",
      userHint:
        "Для Kaspi лучше использовать чистое главное фото без текста. Инфографику, преимущества и комплектацию лучше добавлять на дополнительных слайдах.",
      complianceHints: [
        "Товар должен быть хорошо виден.",
        "Не добавлять водяные знаки.",
        "Не добавлять товары, которых нет в комплекте.",
        "Для комплекта показывать все элементы.",
      ],
    }),
    p({
      id: "halyk_market",
      label: "Halyk Market",
      sourceLevel: "official",
      enabled: true,
      defaultAspectRatio: "1:1",
      defaultSize: "1000x1000",
      minWidth: 500,
      minHeight: 500,
      maxWidth: 2000,
      maxHeight: 2000,
      mainPhotoTextAllowed: false,
      infographicAllowed: true,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: true,
      maxBenefitBadges: 4,
      recommendedSlides: [
        "main_photo",
        "materials",
        "benefits_infographic",
        "dimensions",
        "packaging",
      ],
      allowedSlideTypes: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "packaging",
      ],
      mainPhotoRules: {
        textAllowed: false,
        recommendedTextDensity: "none",
        background: "white",
        productFocus: "strict",
        preserveProductRequired: true,
        avoidExtraObjects: true,
        promptInstruction:
          "Главное фото для Halyk Market: товар на белом фоне, без текста, без водяных знаков, без лишних объектов.",
      },
      infographicRules: {
        textAllowed: true,
        maxBenefitBadges: 4,
        iconsAllowed: true,
        largeReadableText: true,
        promptInstruction:
          "Дополнительные слайды могут содержать преимущества и характеристики, но должны оставаться чистыми и понятными.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction: "Lifestyle допустим как дополнительный слайд.",
      },
      promptInstruction:
        "Создай аккуратную карточку товара для Halyk Market. Главное — белый/чистый фон, точное соответствие товару и отсутствие лишних объектов.",
      userHint: "Для Halyk Market главное фото лучше делать на белом фоне без текста.",
      complianceHints: [
        "Белый или чистый фон.",
        "Фото должно соответствовать товару.",
        "Не добавлять лишние объекты.",
      ],
    }),
    p({
      id: "olx",
      label: "OLX",
      sourceLevel: "official",
      enabled: true,
      defaultAspectRatio: "1:1",
      defaultSize: "2000x2000",
      extraAspectRatios: ["4:3"],
      maxFileSizeMb: 5,
      mainPhotoTextAllowed: false,
      infographicAllowed: false,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: true,
      maxBenefitBadges: 3,
      recommendedSlides: [
        "main_photo",
        "detail_closeup",
        "materials",
        "packaging",
        "lifestyle",
      ],
      allowedSlideTypes: [
        "main_photo",
        "detail_closeup",
        "materials",
        "dimensions",
        "lifestyle",
        "packaging",
      ],
      mainPhotoRules: {
        textAllowed: false,
        recommendedTextDensity: "none",
        background: "realistic",
        productFocus: "strict",
        preserveProductRequired: true,
        avoidExtraObjects: true,
        promptInstruction:
          "Фото для OLX должно выглядеть реалистично и вызывать доверие. Не делать слишком глянцевую рекламную инфографику.",
      },
      infographicRules: {
        textAllowed: false,
        maxBenefitBadges: 3,
        iconsAllowed: false,
        largeReadableText: true,
        promptInstruction:
          "Для OLX избегать перегруженной инфографики. Лучше реалистичные фото товара, деталей и состояния.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction:
          "Lifestyle допустим, если выглядит естественно и не вводит в заблуждение.",
      },
      promptInstruction:
        "Создай реалистичное фото товара для объявления OLX. Изображение должно показывать именно объект объявления, без лишнего глянца и фейковой рекламности.",
      userHint:
        "Для OLX лучше делать реалистичные фото товара, деталей, состояния и комплектации. Слишком рекламные карточки могут выглядеть неестественно.",
      complianceHints: [
        "Показывать именно объект объявления.",
        "Избегать водяных знаков и лишнего текста.",
        "Не делать чрезмерно рекламный дизайн.",
      ],
    }),
    p({
      id: "lamoda",
      label: "Lamoda",
      sourceLevel: "official",
      enabled: true,
      defaultAspectRatio: "762:1100",
      defaultSize: "1524x2200",
      fileFormats: ["jpg"],
      mainPhotoTextAllowed: false,
      infographicAllowed: false,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: true,
      maxBenefitBadges: 0,
      recommendedSlides: [
        "main_photo",
        "detail_closeup",
        "materials",
        "lifestyle",
      ],
      allowedSlideTypes: ["main_photo", "detail_closeup", "materials", "lifestyle"],
      mainPhotoRules: {
        textAllowed: false,
        recommendedTextDensity: "none",
        background: "neutral",
        productFocus: "strict",
        preserveProductRequired: true,
        avoidExtraObjects: true,
        promptInstruction:
          "Фото для Lamoda должно быть fashion/catalog style: нейтральный светлый фон, профессиональная съёмка, акцент на изделии, без маркетплейсной инфографики.",
      },
      infographicRules: {
        textAllowed: false,
        maxBenefitBadges: 0,
        iconsAllowed: false,
        largeReadableText: false,
        promptInstruction:
          "Для Lamoda не использовать тяжёлую инфографику с плашками. Лучше чистые fashion-фото, детали ткани и посадка.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction:
          "Lifestyle допустим в fashion/editorial стиле, без визуального шума и без лишнего текста.",
      },
      promptInstruction:
        "Создай fashion-каталожное изображение товара для Lamoda. Нейтральный фон, профессиональный свет, чистая композиция, без плашек и тяжёлой инфографики.",
      userHint:
        "Для Lamoda лучше подходят fashion-фото: на модели, чистый фон, детали ткани и фурнитуры. Инфографику лучше не использовать.",
      complianceHints: [
        "Нейтральный фон.",
        "Профессиональная fashion-подача.",
        "Без плашек и перегруженной инфографики.",
        "Сохранять реальный цвет и форму изделия.",
      ],
    }),
    p({
      id: "wildberries",
      label: "Wildberries",
      sourceLevel: "official",
      enabled: true,
      defaultAspectRatio: "3:4",
      defaultSize: "1200x1600",
      mainPhotoTextAllowed: false,
      infographicAllowed: true,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: true,
      maxBenefitBadges: 5,
      recommendedSlides: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "packaging",
      ],
      allowedSlideTypes: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "packaging",
        "premium_poster",
      ],
      mainPhotoRules: {
        textAllowed: false,
        recommendedTextDensity: "none",
        background: "clean",
        productFocus: "strict",
        preserveProductRequired: true,
        avoidExtraObjects: true,
        promptInstruction:
          "Главное фото для Wildberries: товар полностью виден, не обрезан, в фокусе, без искажений, на чистом нейтральном фоне.",
      },
      infographicRules: {
        textAllowed: true,
        maxBenefitBadges: 5,
        iconsAllowed: true,
        largeReadableText: true,
        promptInstruction:
          "Дополнительные слайды Wildberries могут содержать преимущества, размеры, материалы и иконки. Текст должен быть крупным и читаемым.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction:
          "Lifestyle-слайд допустим, но фон не должен отвлекать от товара.",
      },
      promptInstruction:
        "Создай карточку для Wildberries: товар должен быть чётким, полностью видимым, без искажений. Инфографику использовать только для дополнительных слайдов.",
      userHint:
        "Для Wildberries главное фото лучше без текста: товар полностью виден и не обрезан. Преимущества и размеры лучше вынести на дополнительные слайды.",
      complianceHints: [
        "Товар полностью виден.",
        "Не обрезать товар.",
        "Фон чистый и нейтральный.",
        "Дополнительные слайды могут быть с инфографикой.",
      ],
    }),
    p({
      id: "ozon",
      label: "Ozon",
      sourceLevel: "official",
      enabled: true,
      defaultAspectRatio: "1:1",
      defaultSize: "1500x1500",
      mainPhotoTextAllowed: false,
      infographicAllowed: true,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: true,
      maxBenefitBadges: 5,
      recommendedSlides: [
        "main_photo",
        "benefits_infographic",
        "dimensions",
        "materials",
        "lifestyle",
        "premium_poster",
      ],
      allowedSlideTypes: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "premium_poster",
        "packaging",
      ],
      mainPhotoRules: {
        textAllowed: false,
        recommendedTextDensity: "none",
        background: "clean",
        productFocus: "strict",
        preserveProductRequired: true,
        avoidExtraObjects: true,
        promptInstruction:
          "Главное фото для Ozon: товар крупный, чистый фон, без текста, без водяных знаков, без лишних объектов.",
      },
      infographicRules: {
        textAllowed: true,
        maxBenefitBadges: 5,
        iconsAllowed: true,
        largeReadableText: true,
        promptInstruction:
          "Дополнительные слайды Ozon могут содержать преимущества, иконки, размеры и характеристики. Текст должен быть читаемым.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction: "Lifestyle допустим как дополнительный слайд.",
      },
      promptInstruction:
        "Создай чистую продающую карточку для Ozon. Главное фото строгое и без текста; дополнительные слайды могут быть с инфографикой.",
      userHint:
        "Для Ozon главное фото лучше делать чистым и без текста. Преимущества, размеры и материалы лучше показывать на дополнительных слайдах.",
      complianceHints: [
        "Не использовать водяные знаки.",
        "Не добавлять лишние объекты.",
        "Главное фото без текста.",
        "Инфографика — на дополнительных слайдах.",
      ],
    }),
    p({
      id: "yandex_market",
      label: "Яндекс Маркет",
      sourceLevel: "official",
      enabled: true,
      defaultAspectRatio: "3:4",
      defaultSize: "1080x1440",
      fileFormats: ["jpg", "jpeg", "png", "heic", "webp"],
      minWidth: 300,
      minHeight: 300,
      maxFileSizeMb: 10,
      mainPhotoTextAllowed: false,
      infographicAllowed: true,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: true,
      avoidLogos: true,
      avoidPriceLabels: true,
      avoidContacts: true,
      maxBenefitBadges: 4,
      recommendedSlides: [
        "main_photo",
        "detail_closeup",
        "benefits_infographic",
        "dimensions",
        "lifestyle",
      ],
      allowedSlideTypes: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "packaging",
      ],
      mainPhotoRules: {
        textAllowed: false,
        recommendedTextDensity: "none",
        background: "clean",
        productFocus: "strict",
        preserveProductRequired: true,
        avoidExtraObjects: true,
        promptInstruction:
          "Главное фото для Яндекс Маркет: изображение должно точно соответствовать товару, без водяных знаков, логотипов магазина, рекламы, ценников, скидок, контактов и ссылок.",
      },
      infographicRules: {
        textAllowed: true,
        maxBenefitBadges: 4,
        iconsAllowed: true,
        largeReadableText: true,
        promptInstruction:
          "Дополнительные слайды могут содержать преимущества и характеристики, но без ценников, скидок, контактов, ссылок и логотипов маркетплейса.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction:
          "Lifestyle допустим как дополнительный слайд, если товар точно соответствует карточке.",
      },
      promptInstruction:
        "Создай карточку для Яндекс Маркет. Изображение должно точно соответствовать товару. Не добавлять водяные знаки, рекламу, ценники, скидки, контакты, ссылки или логотипы магазина.",
      userHint:
        "Для Яндекс Маркета избегайте водяных знаков, ценников, скидок, контактов и лишних логотипов. Главное фото лучше без текста.",
      complianceHints: [
        "Изображение должно соответствовать товару.",
        "Не добавлять водяные знаки.",
        "Не добавлять рекламу, ценники, скидки, контакты и ссылки.",
        "Не использовать логотипы магазина/маркетплейса на фото.",
      ],
    }),
    p({
      id: "avito",
      label: "Avito",
      sourceLevel: "secondary",
      needsVerification: true,
      enabled: true,
      defaultAspectRatio: "4:3",
      defaultSize: "1600x1200",
      extraAspectRatios: ["1:1"],
      mainPhotoTextAllowed: false,
      infographicAllowed: false,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: true,
      maxBenefitBadges: 3,
      recommendedSlides: [
        "main_photo",
        "detail_closeup",
        "materials",
        "packaging",
        "lifestyle",
      ],
      allowedSlideTypes: [
        "main_photo",
        "detail_closeup",
        "materials",
        "dimensions",
        "lifestyle",
        "packaging",
      ],
      mainPhotoRules: {
        textAllowed: false,
        recommendedTextDensity: "none",
        background: "realistic",
        productFocus: "strict",
        preserveProductRequired: true,
        avoidExtraObjects: true,
        promptInstruction:
          "Фото для Avito должно выглядеть реалистично и вызывать доверие. Избегать слишком рекламной инфографики.",
      },
      infographicRules: {
        textAllowed: false,
        maxBenefitBadges: 3,
        iconsAllowed: false,
        largeReadableText: true,
        promptInstruction:
          "Для Avito не делать тяжёлую маркетплейсную инфографику. Лучше показать товар, состояние, детали и комплектацию.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction:
          "Lifestyle допустим, если выглядит естественно и не вводит в заблуждение.",
      },
      promptInstruction:
        "Создай реалистичное изображение товара для Avito. Изображение должно выглядеть как честное фото объявления, без чрезмерной рекламности.",
      userHint:
        "Для Avito лучше делать реалистичные фото, а не глянцевую инфографику. Этот профиль требует дополнительной проверки правил.",
      complianceHints: [
        "Показывать реальный товар.",
        "Избегать чрезмерной рекламности.",
        "Не добавлять лишние объекты.",
        "needsVerification=true — правила требуют дополнительной проверки.",
      ],
    }),
    p({
      id: "amazon",
      label: "Amazon",
      sourceLevel: "official",
      enabled: true,
      defaultAspectRatio: "1:1",
      defaultSize: "2000x2000",
      mainPhotoTextAllowed: false,
      infographicAllowed: true,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: true,
      maxBenefitBadges: 5,
      recommendedSlides: [
        "main_photo",
        "benefits_infographic",
        "lifestyle",
        "detail_closeup",
        "dimensions",
        "packaging",
      ],
      allowedSlideTypes: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "packaging",
        "premium_poster",
      ],
      mainPhotoRules: {
        textAllowed: false,
        recommendedTextDensity: "none",
        background: "pure_white",
        productFocus: "strict",
        preserveProductRequired: true,
        avoidExtraObjects: true,
        promptInstruction:
          "Amazon main image: pure white background, product only, no text, no graphics, no watermarks, no extra props, product should fill most of the frame.",
      },
      infographicRules: {
        textAllowed: true,
        maxBenefitBadges: 5,
        iconsAllowed: true,
        largeReadableText: true,
        promptInstruction:
          "Amazon additional images can show benefits, lifestyle, scale, details and package contents. Keep text readable and avoid misleading claims.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction:
          "Lifestyle allowed for additional images, product must remain accurate.",
      },
      promptInstruction:
        "Create an Amazon-ready product image. Main image must be strict: pure white background, no text, no extra props. Additional slides may include benefits and lifestyle.",
      userHint:
        "Для Amazon главное фото самое строгое: белый фон, без текста и лишних объектов. Инфографику и lifestyle лучше использовать на дополнительных изображениях.",
      complianceHints: [
        "Главное фото: белый фон.",
        "Без текста, графики и водяных знаков на главном фото.",
        "Без лишних предметов, которых нет в комплекте.",
        "Товар должен быть главным объектом.",
      ],
    }),
    p({
      id: "shopify",
      label: "Shopify",
      sourceLevel: "official",
      enabled: true,
      defaultAspectRatio: "1:1",
      defaultSize: "2048x2048",
      maxWidth: 5000,
      maxHeight: 5000,
      maxFileSizeMb: 20,
      mainPhotoTextAllowed: true,
      infographicAllowed: true,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: false,
      maxBenefitBadges: 5,
      recommendedSlides: [
        "main_photo",
        "lifestyle",
        "benefits_infographic",
        "materials",
        "premium_poster",
        "ad_banner",
      ],
      allowedSlideTypes: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "packaging",
        "premium_poster",
        "ad_banner",
      ],
      mainPhotoRules: {
        textAllowed: true,
        recommendedTextDensity: "minimal",
        background: "brand",
        productFocus: "high",
        preserveProductRequired: true,
        avoidExtraObjects: false,
        promptInstruction:
          "Shopify product image can follow brand style. Keep product clear and use consistent aspect ratio across product gallery.",
      },
      infographicRules: {
        textAllowed: true,
        maxBenefitBadges: 5,
        iconsAllowed: true,
        largeReadableText: true,
        promptInstruction:
          "Shopify allows flexible brand/ecommerce infographics. Keep text readable and brand-consistent.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction:
          "Lifestyle and brand imagery are suitable for Shopify product pages.",
      },
      promptInstruction:
        "Create a branded ecommerce product image suitable for Shopify. Maintain consistent style, clear product visibility and brand-friendly composition.",
      userHint:
        "Shopify гибче маркетплейсов: можно использовать брендовый стиль, lifestyle и баннеры, но важно сохранять единый формат изображений.",
      complianceHints: [
        "Единый формат изображений.",
        "Товар должен быть хорошо виден.",
        "Можно использовать брендовый стиль.",
      ],
    }),
    p({
      id: "instagram_vk",
      label: "Instagram / VK",
      sourceLevel: "mixed",
      enabled: true,
      defaultAspectRatio: "1:1",
      defaultSize: "1080x1080",
      extraAspectRatios: ["4:5", "9:16"],
      extraSizes: ["1080x1350", "1080x1920"],
      mainPhotoTextAllowed: true,
      infographicAllowed: true,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: false,
      maxBenefitBadges: 5,
      recommendedSlides: [
        "main_photo",
        "lifestyle",
        "ad_banner",
        "premium_poster",
        "benefits_infographic",
      ],
      allowedSlideTypes: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "premium_poster",
        "ad_banner",
      ],
      mainPhotoRules: {
        textAllowed: true,
        recommendedTextDensity: "minimal",
        background: "lifestyle",
        productFocus: "medium",
        preserveProductRequired: true,
        avoidExtraObjects: false,
        promptInstruction:
          "For Instagram/VK, allow more creative lifestyle/editorial style, emotional composition and readable short text.",
      },
      infographicRules: {
        textAllowed: true,
        maxBenefitBadges: 5,
        iconsAllowed: true,
        largeReadableText: true,
        promptInstruction:
          "Social media infographics may be more expressive, with bold colors and clear CTA, but text must remain readable.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction:
          "Lifestyle/editorial/ad-style image is strongly suitable for social media.",
      },
      promptInstruction:
        "Create a social-commerce product visual for Instagram/VK. More creative, lifestyle, editorial or ad style is allowed. Keep product recognizable and text readable.",
      userHint:
        "Для Instagram/VK можно делать более креативные lifestyle, постеры и рекламные баннеры. Можно использовать 1:1, 4:5 и 9:16.",
      complianceHints: [
        "Можно больше креатива и lifestyle.",
        "Следить за читаемостью текста.",
        "Для сторис использовать 9:16.",
      ],
    }),
    p({
      id: "own_site",
      label: "Свой сайт",
      sourceLevel: "default",
      enabled: true,
      defaultAspectRatio: "1:1",
      defaultSize: "2048x2048",
      extraAspectRatios: ["4:5", "16:9", "3:4"],
      mainPhotoTextAllowed: true,
      infographicAllowed: true,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: false,
      maxBenefitBadges: 5,
      recommendedSlides: [
        "main_photo",
        "lifestyle",
        "benefits_infographic",
        "materials",
        "premium_poster",
        "ad_banner",
      ],
      allowedSlideTypes: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "packaging",
        "premium_poster",
        "ad_banner",
      ],
      mainPhotoRules: {
        textAllowed: true,
        recommendedTextDensity: "minimal",
        background: "brand",
        productFocus: "high",
        preserveProductRequired: true,
        avoidExtraObjects: false,
        promptInstruction:
          "For own ecommerce site, use brand-consistent product imagery. Keep a consistent gallery style.",
      },
      infographicRules: {
        textAllowed: true,
        maxBenefitBadges: 5,
        iconsAllowed: true,
        largeReadableText: true,
        promptInstruction: "Use brand-friendly ecommerce infographic style.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction:
          "Lifestyle and banner images are suitable for own website.",
      },
      promptInstruction:
        "Create a branded ecommerce product image for the seller's own website. Focus on clean brand style, product clarity and consistent visuals.",
      userHint:
        "Для своего сайта можно использовать больше брендового стиля, баннеров и lifestyle. Главное — единый стиль всех изображений.",
      complianceHints: [
        "Сохранять единый стиль сайта.",
        "Товар должен быть хорошо виден.",
        "Можно использовать брендовые баннеры.",
      ],
    }),
    p({
      id: "other",
      label: "Другое",
      sourceLevel: "default",
      enabled: true,
      defaultAspectRatio: "1:1",
      defaultSize: "1500x1500",
      mainPhotoTextAllowed: true,
      infographicAllowed: true,
      lifestyleAllowed: true,
      preserveProductRequired: true,
      avoidWatermarks: true,
      avoidExtraObjects: true,
      maxBenefitBadges: 5,
      recommendedSlides: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "premium_poster",
      ],
      allowedSlideTypes: [
        "main_photo",
        "benefits_infographic",
        "materials",
        "dimensions",
        "lifestyle",
        "packaging",
        "premium_poster",
        "ad_banner",
      ],
      mainPhotoRules: {
        textAllowed: true,
        recommendedTextDensity: "minimal",
        background: "clean",
        productFocus: "high",
        preserveProductRequired: true,
        avoidExtraObjects: true,
        promptInstruction:
          "Generic marketplace/ecommerce image: clean product focus, readable design and accurate product identity.",
      },
      infographicRules: {
        textAllowed: true,
        maxBenefitBadges: 5,
        iconsAllowed: true,
        largeReadableText: true,
        promptInstruction:
          "Generic infographic with readable benefits and clean layout.",
      },
      lifestyleRules: {
        allowed: true,
        promptInstruction: "Lifestyle allowed if it helps sell the product.",
      },
      promptInstruction:
        "Create a clean ecommerce product card suitable for a generic marketplace.",
      userHint:
        "Универсальный режим: чистое фото товара, преимущества, материалы, размеры и lifestyle.",
      complianceHints: [
        "Сохранять товар без искажений.",
        "Не добавлять водяные знаки.",
        "Не выдумывать характеристики.",
      ],
    }),
  ].map((x) => ({
    ...x,
    infographicRules: {
      ...x.infographicRules,
      maxBenefitBadges: Math.min(
        x.infographicRules.maxBenefitBadges,
        x.maxBenefitBadges,
      ),
    },
  }));

/** Все допустимые id профиля (значение marketplace из UI/API). */
export const PRODUCT_CARD_MARKETPLACE_IDS = PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS.map(
  (x) => x.id,
);

export function profileByMarketplaceId(
  id: string,
): ProductCardMarketplaceProfile | undefined {
  return PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS.find((p) => p.id === id);
}
