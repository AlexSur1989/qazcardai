/**
 * Минимальная проверка сценария «Создать карточку» перед деплоем.
 * Запуск: npm run verify:product-card-card-builder
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { APP_SETTINGS_REGISTRY } from "@/config/app-settings-registry";
import {
  getAllowedTemplatesForSlide,
  hasUserDimensionMeasures,
} from "@/config/card-builder-template-allowlist";
import { pickGalleryTemplateSequenceForPlan } from "@/config/card-builder-gallery-sequences";
import { PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS } from "@/config/product-card-marketplace-profiles";
import {
  buildCardBuilderGalleryPlan,
  type CardBuilderPlanInput,
} from "@/server/services/productCardBuilderPlan";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertSlideShape(s: ReturnType<typeof buildCardBuilderGalleryPlan>["slides"][number]): void {
  assert(
    typeof s.templateId === "string" && s.templateId.trim().length > 1,
    `У каждого слайда есть templateId (${s.slideId})`,
  );
  assert(
    typeof s.layoutPreset === "string" && s.layoutPreset.trim().length > 0,
    `У каждого слайда есть layoutPreset (${s.slideId})`,
  );
}

const scenariosEntry = APP_SETTINGS_REGISTRY.find((e) => e.key === "PRODUCT_CARD_SCENARIOS");
assert(scenariosEntry, "PRODUCT_CARD_SCENARIOS должна быть в APP_SETTINGS_REGISTRY");
const scenariosDefault = scenariosEntry.defaultValue;
const scenariosDefaultRecord = scenariosDefault as Record<string, unknown>;
const cardBuilderToggle = scenariosDefaultRecord.cardBuilder;
assert(
  cardBuilderToggle &&
    typeof cardBuilderToggle === "object" &&
    !Array.isArray(cardBuilderToggle) &&
    typeof (cardBuilderToggle as { enabled?: unknown }).enabled === "boolean",
  "В PRODUCT_CARD_SCENARIOS.cardBuilder есть поле enabled (переключатель)",
);

const mpProfilesEntry = APP_SETTINGS_REGISTRY.find((e) => e.key === "PRODUCT_CARD_MARKETPLACE_PROFILES");
assert(mpProfilesEntry, "PRODUCT_CARD_MARKETPLACE_PROFILES должна быть в APP_SETTINGS_REGISTRY");
assert(Array.isArray(mpProfilesEntry.defaultValue), "PRODUCT_CARD_MARKETPLACE_PROFILES.defaultValue — массив");

const pricingEntry = APP_SETTINGS_REGISTRY.find((e) => e.key === "PRODUCT_CARD_CARD_BUILDER_PRICING");
assert(pricingEntry, "PRODUCT_CARD_CARD_BUILDER_PRICING должна быть в APP_SETTINGS_REGISTRY");
const pricingDefault = pricingEntry.defaultValue;
assert(pricingDefault && typeof pricingDefault === "object" && !Array.isArray(pricingDefault), "pricing JSON");
const single = Number((pricingDefault as Record<string, unknown>).cardBuilderSingleSlideCredits);
const g6 = Number((pricingDefault as Record<string, unknown>).cardBuilderGallery6Credits);
const g8 = Number((pricingDefault as Record<string, unknown>).cardBuilderGallery8Credits);
assert(Number.isFinite(single) && single > 0, "cardBuilderSingleSlideCredits > 0 в default PRODUCT_CARD_CARD_BUILDER_PRICING");
assert(Number.isFinite(g6) && g6 > 0, "cardBuilderGallery6Credits > 0");
assert(Number.isFinite(g8) && g8 > 0, "cardBuilderGallery8Credits > 0");

function basePlan(overrides: Partial<CardBuilderPlanInput> = {}): CardBuilderPlanInput {
  return {
    selectedCategory: "apparel",
    marketplace: "ozon",
    goal: "full_gallery_6",
    preserveProduct: true,
    preserveAspects: [],
    benefits: [],
    mustShow: [],
    audience: "mass_market",
    priceSegment: "middle",
    salesStyle: "light_marketplace",
    textDensity: "medium",
    ...overrides,
  };
}

const ozonProfile = PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS.find((p) => p.id === "ozon");
assert(ozonProfile, "В defaults есть профиль ozon для verify buildCardBuilderGalleryPlan");

const apparelSeq = pickGalleryTemplateSequenceForPlan({ selectedCategory: "apparel" }, 6);
assert(
  apparelSeq.length === 6 && apparelSeq[0] === "hero_clean",
  "pickGalleryTemplateSequenceForPlan: единый источник базовых 6 для apparel начинается с hero_clean",
);

const { slides: ozonApparel } = buildCardBuilderGalleryPlan(basePlan(), ozonProfile);
assert(ozonApparel.length === 6, "buildCardBuilderGalleryPlan(full_gallery_6, ozon): ровно 6 слайдов");
for (const s of ozonApparel) assertSlideShape(s);

const furniture = buildCardBuilderGalleryPlan(
  basePlan({ selectedCategory: "home_and_furniture" }),
  ozonProfile,
).slides;
const cosmetics = buildCardBuilderGalleryPlan(
  basePlan({ selectedCategory: "beauty_and_care" }),
  ozonProfile,
).slides;
assert(
  furniture.map((x) => x.templateId).join("|") !== cosmetics.map((x) => x.templateId).join("|"),
  "План мебели и косметики отличается по шаблонам на одной площадке",
);

assert(
  !ozonApparel.some((s) => s.templateId === "interface_detail"),
  "Одежда: нет interface_detail по умолчанию",
);
const planGadgetDetails = buildCardBuilderGalleryPlan(
  basePlan({ selectedCategory: "gadgets_and_tech" }),
  ozonProfile,
).slides;
assert(
  planGadgetDetails.some((s) => s.templateId === "interface_detail" || s.templateId === "feature_callouts"),
  "Гаджеты: есть interface_detail или feature_callouts среди дефолтных шаблонов",
);

const planFoodMarket = buildCardBuilderGalleryPlan(
  basePlan({ selectedCategory: "food_and_drinks" }),
  ozonProfile,
).slides;
assert(!planFoodMarket.some((s) => s.templateId === "interface_detail"), "Еда: нет interface_detail");

assert(
  cosmetics.some((s) => s.templateId === "texture_closeup" || s.templateId === "ingredients_effect"),
  "Косметика: есть texture_closeup или ingredients_effect",
);

assert(
  furniture.some((s) => s.imageRole === "lifestyle" && s.templateId === "interior_lifestyle"),
  "Мебель: lifestyle-слайд с interior_lifestyle",
);

const furnitureNoDim = buildCardBuilderGalleryPlan(
  basePlan({ selectedCategory: "home_and_furniture", dimensions: "" }),
  ozonProfile,
).slides;
assert(
  !furnitureNoDim.some((s) => s.templateId === "dimensions_schema"),
  "Мебель без цифр в размерах: нет dimensions_schema",
);

assert(
  buildCardBuilderGalleryPlan(basePlan({ selectedCategory: "other" }), ozonProfile).slides.length === 6,
  "Категория other: безопасная галерея из 6 слайдов",
);

assert(!hasUserDimensionMeasures(""), "hasUserDimensionMeasures: пустая строка");
assert(hasUserDimensionMeasures("10 см"), "hasUserDimensionMeasures: есть цифры");

const clothDetailAllowed = getAllowedTemplatesForSlide({
  categoryKey: "apparel",
  marketplaceProfile: ozonProfile,
  imageRole: "detail_closeup",
  hasConcreteDimensions: false,
  mustShowScale: false,
});
assert(
  !clothDetailAllowed.some((t) => t.templateId === "interface_detail"),
  "Dropdown allowlist: одежда / детали — без interface_detail",
);
const gadDetailAllowed = getAllowedTemplatesForSlide({
  categoryKey: "gadgets_and_tech",
  marketplaceProfile: ozonProfile,
  imageRole: "detail_closeup",
  hasConcreteDimensions: false,
  mustShowScale: false,
});
assert(
  gadDetailAllowed.some((t) => t.templateId === "interface_detail"),
  "Dropdown allowlist: гаджеты / детали — включают interface_detail",
);

const dimWarn = buildCardBuilderGalleryPlan(
  basePlan({ goal: "dimensions_slide", dimensions: "" }),
  ozonProfile,
);
assert(Boolean(dimWarn.planWarning?.trim()), "Цель «Размеры» без поля размеров — есть planWarning");
assert(
  !dimWarn.slides.some((s) => s.templateId === "dimensions_schema"),
  "Нет точных размеров: dimensions_schema не используется",
);

const lamoda = PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS.find((p) => p.id === "lamoda");
assert(lamoda, "lamoda profile");
const lamodaSlides = buildCardBuilderGalleryPlan(
  basePlan({ marketplace: "lamoda", selectedCategory: "apparel" }),
  lamoda,
).slides;
const earlyInfographic = lamodaSlides
  .slice(0, 2)
  .some((s) => s.imageRole === "benefits_infographic" && s.templateId === "benefits_grid");
assert(!earlyInfographic, "Lamoda: в первых двух кадрах нет тяжёлой benefits_grid-инфографики");

const amazon = PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS.find((p) => p.id === "amazon");
assert(amazon, "amazon profile");
const amz = buildCardBuilderGalleryPlan(basePlan({ marketplace: "amazon" }), amazon).slides;
const amzMain = amz[0];
assert(amzMain?.imageRole === "main_photo", "Amazon: первый кадр main_photo");
assert(amzMain?.templateId === "hero_clean", "Amazon: главный шаблон hero_clean");
assert(amzMain?.recommendedTextMode === "none", "Amazon: главный кадр без текстового режима");
assert(
  (amzMain?.purpose ?? "").toLowerCase().includes("бел") &&
    (amzMain?.purpose ?? "").toLowerCase().includes("amazon"),
  "Amazon: в purpose есть белый фон и явная отсылка к правилам Amazon",
);

const ig = PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS.find((p) => p.id === "instagram_vk");
assert(ig, "instagram_vk profile");
const igSlides = buildCardBuilderGalleryPlan(
  basePlan({ marketplace: "instagram_vk", selectedCategory: "gadgets_and_tech" }),
  ig,
).slides;
const hasLifestyle = igSlides.some((s) => s.imageRole === "lifestyle");
const hasSocialAdish = igSlides.some(
  (s) => s.imageRole === "ad_banner" || s.imageRole === "premium_poster",
);
assert(hasLifestyle && hasSocialAdish, "Instagram/VK: в плане есть lifestyle и рекламный/постерный кадр");

const benefitSlides = ozonApparel.filter((s) => s.imageRole === "benefits_infographic");
const allowedBenefitTemplates = new Set([
  "benefits_grid",
  "benefits_left_column",
  "dark_premium_benefits",
  "protection_features",
  "comparison_card",
]);
for (const s of benefitSlides) {
  assert(
    allowedBenefitTemplates.has(s.templateId),
    `Слайд преимуществ использует допустимый шаблон: ${s.templateId}`,
  );
}
const slideIds = ozonApparel.map((s) => s.slideId);
assert(new Set(slideIds).size === slideIds.length, "slideId уникальные");

for (const s of ozonApparel) {
  assert(s.marketplaceProfileId === "ozon", "marketplaceProfileId сохраняется на слайде");
  assert(s.textRenderMode === "ai_text_in_design", "textRenderMode на слайде");
}

const genPath = join(process.cwd(), "src/server/services/productCardCardBuilderGeneration.ts");
const genSrc = readFileSync(genPath, "utf8");
assert(
  genSrc.includes('scenarioKey: "card_builder"'),
  'В metadata генерации card_builder должен быть scenarioKey: "card_builder"',
);
assert(
  genSrc.includes("buildCardBuilderSuperPrompt") || genSrc.includes("card_builder_super_prompt"),
  "Генерация card_builder должна использовать супер-промпт",
);
assert(
  genSrc.includes("cardBuilderPrompt") && genSrc.includes("textLockLevel"),
  "Metadata генерации card_builder должна включать cardBuilderPrompt с textLockLevel",
);
assert(genSrc.includes("marketplaceProfileId"), "generation metadata включает marketplaceProfileId");
assert(genSrc.includes("appliedMarketplaceRules"), "generation metadata включает appliedMarketplaceRules");

const metaPath = join(process.cwd(), "src/server/services/productCardCardBuilderMeta.ts");
const metaSrc = readFileSync(metaPath, "utf8");
assert(
  metaSrc.includes("metadata.cardBuilder") || metaSrc.includes("meta.cardBuilder"),
  "Состояние мастера хранится под ключом metadata.cardBuilder",
);
assert(
  !metaSrc.includes("marketplaceCard"),
  "productCardCardBuilderMeta не должен смешивать ключ marketplaceCard",
);

const mpPath = join(process.cwd(), "src/server/services/productCardGeneration.ts");
const mpSrc = readFileSync(mpPath, "utf8");
assert(
  !mpSrc.includes("scenarioKey"),
  "Карточка маркетплейса не должна задавать scenarioKey рядом с card_builder (изоляция сценариев)",
);

console.log("[verify-product-card-card-builder] OK");
