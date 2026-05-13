/**
 * Минимальная проверка сценария «Создать карточку» перед деплоем.
 * Запуск: npm run verify:product-card-card-builder
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { APP_SETTINGS_REGISTRY } from "@/config/app-settings-registry";
import {
  PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS,
} from "@/config/product-card-marketplace-profiles";
import { buildCardBuilderGalleryPlan } from "@/server/services/productCardBuilderPlan";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
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

const samplePlan = {
  selectedCategory: "apparel",
  marketplace: "ozon",
  goal: "full_gallery_6" as const,
  preserveProduct: true,
  preserveAspects: [] as string[],
  benefits: [] as string[],
  mustShow: [] as string[],
  audience: "mass_market",
  priceSegment: "middle",
  salesStyle: "light_marketplace",
  textDensity: "medium",
};
const ozonProfile = PRODUCT_CARD_MARKETPLACE_PROFILES_DEFAULTS.find((p) => p.id === "ozon");
assert(ozonProfile, "В defaults есть профиль ozon для verify buildCardBuilderGalleryPlan");
const { slides } = buildCardBuilderGalleryPlan(samplePlan, ozonProfile);
assert(slides.length >= 6, "buildCardBuilderGalleryPlan(full_gallery_6): минимум 6 слайдов");
for (const s of slides) {
  assert(
    typeof s.templateId === "string" && s.templateId.trim().length > 1,
    `У каждого слайда есть templateId (${s.slideId})`,
  );
}
const benefitSlides = slides.filter((s) => s.imageRole === "benefits_infographic");
assert(benefitSlides.length >= 1, "В галерее есть слайд преимуществ");
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
const slideIds = slides.map((s) => s.slideId);
assert(new Set(slideIds).size === slideIds.length, "slideId уникальные");

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
