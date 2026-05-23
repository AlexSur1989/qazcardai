/**
 * Проверка универсального сценария «Создать карточку».
 * Запуск: npm run verify:product-card-card-builder
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { APP_SETTINGS_REGISTRY } from "@/config/app-settings-registry";
import { CARD_BUILDER_PROMPTS_DEFAULTS } from "@/config/card-builder-prompts-defaults";
import { mergeCardBuilderPromptsWithDefaults } from "@/lib/validations/card-builder-prompts-setting";
import { getAllowedTemplatesForSlide } from "@/config/card-builder-template-allowlist";
import { buildUniversalGalleryTemplateIds } from "@/lib/card-builder-universal-planner";
import { buildSlidePreviewModels, unusedProductFactsForSlides } from "@/lib/card-builder-slide-preview";
import { UNIVERSAL_CARD_BUILDER_PROFILE } from "@/config/universal-card-builder-profile";
import { cardBuilderPlanFieldsSchema } from "@/lib/validations/card-builder-plan";
import { enrichCardBuilderGallerySlides } from "@/server/services/cardBuilderTextSlots";
import {
  buildCardBuilderGalleryPlan,
  type CardBuilderPlanInput,
} from "@/server/services/productCardBuilderPlan";
import { isUniversalCardBuilderTarget } from "@/config/universal-card-builder-profile";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function basePlan(overrides: Partial<CardBuilderPlanInput> = {}): CardBuilderPlanInput {
  return {
    selectedCategory: "other",
    marketplace: "other",
    targetPlatform: "universal",
    cardBuilderCategoryKey: "gadgets_tech",
    creationMode: "full_gallery",
    gallerySlideCount: 6,
    goal: "full_gallery_6",
    preserveProduct: true,
    preserveAspects: ["shape", "color"],
    audience: "mass_market",
    priceSegment: "middle",
    salesStyle: "light_marketplace",
    textDensity: "medium",
    productFacts: [
      {
        id: "f1",
        label: "Объём",
        value: "500 мл",
        type: "detail",
        source: "user",
        visibleOnCard: true,
        lockedText: true,
      },
    ],
    ...overrides,
  };
}

const scenariosEntry = APP_SETTINGS_REGISTRY.find((e) => e.key === "PRODUCT_CARD_SCENARIOS");
assert(scenariosEntry, "PRODUCT_CARD_SCENARIOS в APP_SETTINGS_REGISTRY");
const cardBuilderToggle = (scenariosEntry.defaultValue as Record<string, unknown>).cardBuilder;
assert(
  cardBuilderToggle &&
    typeof cardBuilderToggle === "object" &&
    !Array.isArray(cardBuilderToggle) &&
    typeof (cardBuilderToggle as { enabled?: unknown }).enabled === "boolean",
  "PRODUCT_CARD_SCENARIOS.cardBuilder.enabled",
);

const pricingEntry = APP_SETTINGS_REGISTRY.find((e) => e.key === "PRODUCT_CARD_CARD_BUILDER_PRICING");
assert(pricingEntry, "PRODUCT_CARD_CARD_BUILDER_PRICING в APP_SETTINGS_REGISTRY");

assert(isUniversalCardBuilderTarget("universal"), "targetPlatform universal → universal flow");
assert(!isUniversalCardBuilderTarget(undefined), "targetPlatform undefined → legacy path off in UI");

const gallery6 = buildUniversalGalleryTemplateIds({
  categoryKey: "gadgets_tech",
  productFacts: [],
  galleryCount: 6,
});
assert(gallery6.length === 6 && gallery6[0] === "hero_clean", "universal gallery 6 начинается с hero_clean");
assert(
  !gallery6.includes("benefits_grid"),
  "без benefit facts нет benefits_grid в галерее 6",
);

const gallery6Benefits = buildUniversalGalleryTemplateIds({
  categoryKey: "gadgets_tech",
  productFacts: [
    {
      id: "b1",
      label: "Плюс",
      value: "Лёгкая",
      type: "benefit",
      source: "user",
      visibleOnCard: true,
      lockedText: true,
    },
  ],
  galleryCount: 6,
});
assert(
  gallery6Benefits.includes("benefits_grid"),
  "с benefit facts есть benefits_grid",
);

const gallery8 = buildUniversalGalleryTemplateIds({
  categoryKey: "gadgets_tech",
  productFacts: [],
  galleryCount: 8,
});
assert(gallery8.length === 8, "universal gallery 8 → 8 templateId");

const { slides } = buildCardBuilderGalleryPlan(basePlan(), UNIVERSAL_CARD_BUILDER_PROFILE);
assert(slides.length === 6, "full_gallery_6 → 6 слайдов");
assert(
  slides.every((s) => s.templateId && s.layoutPreset && s.marketplaceProfileId === "universal"),
  "слайды enriched universal profile id",
);

const enriched = enrichCardBuilderGallerySlides(slides, basePlan(), "Тест");
assert(enriched.length === slides.length, "enrichCardBuilderGallerySlides сохраняет count");

const singlePlan = buildCardBuilderGalleryPlan(
  basePlan({ creationMode: "single", singleCardType: "main_photo", goal: "main_photo" }),
  UNIVERSAL_CARD_BUILDER_PROFILE,
);
assert(singlePlan.slides.length === 1, "single main_photo → 1 слайд");

const parsed = cardBuilderPlanFieldsSchema.safeParse({
  selectedCategory: "other",
  marketplace: "other",
  goal: "full_gallery_6",
  targetPlatform: "universal",
  audience: "mass_market",
  priceSegment: "middle",
  salesStyle: "light_marketplace",
  textDensity: "medium",
});
assert(parsed.success, "Zod plan fields для universal");

const allowed = getAllowedTemplatesForSlide({
  categoryKey: "other",
  marketplaceProfile: UNIVERSAL_CARD_BUILDER_PROFILE,
  imageRole: "main_photo",
  hasConcreteDimensions: false,
  mustShowScale: false,
});
assert(allowed.length > 0, "allowlist шаблонов для universal main_photo");

const genSrc = readFileSync(
  join(process.cwd(), "src/server/services/productCardCardBuilderGeneration.ts"),
  "utf8",
);
assert(genSrc.includes('scenarioKey: "card_builder"'), "metadata generation scenarioKey card_builder");
assert(genSrc.includes("resolveCardBuilderSourceImage"), "generation использует отдельное фото card_builder");

const metaSrc = readFileSync(
  join(process.cwd(), "src/server/services/productCardCardBuilderMeta.ts"),
  "utf8",
);
assert(metaSrc.includes("sourceImage"), "metadata.cardBuilder.sourceImage");

const promptsEntry = APP_SETTINGS_REGISTRY.find(
  (e) => e.key === "PRODUCT_CARD_CARD_BUILDER_PROMPTS",
);
assert(promptsEntry, "PRODUCT_CARD_CARD_BUILDER_PROMPTS в APP_SETTINGS_REGISTRY");
assert(
  promptsEntry?.defaultValue &&
    typeof promptsEntry.defaultValue === "object" &&
    (promptsEntry.defaultValue as { version?: string }).version === "card_builder_prompts_v1",
  "default prompts version",
);

const merged = mergeCardBuilderPromptsWithDefaults(null);
assert(merged.prompts.slidePromptBase.length > 20, "merge defaults slidePromptBase");
assert(merged.source === "code_default", "broken AppSetting → code_default");

const promptBuilderSrc = readFileSync(
  join(process.cwd(), "src/server/services/cardBuilderPromptBuilder.ts"),
  "utf8",
);
assert(promptBuilderSrc.includes("pickCategoryPrompt"), "prompt builder uses category overrides");
assert(promptBuilderSrc.includes("pickCardTypePrompt"), "prompt builder uses cardType overrides");
assert(promptBuilderSrc.includes("pickTemplatePrompt"), "prompt builder uses template overrides");
assert(
  promptBuilderSrc.includes("getSalesStyleInstruction(input.salesStyle"),
  "salesStyle instruction wired in super prompt",
);

const previewSrc = readFileSync(
  join(process.cwd(), "src/lib/card-builder-slide-preview.ts"),
  "utf8",
);
assert(previewSrc.includes("computeSlideCardTextPhrases"), "slide preview card text helper");
assert(previewSrc.includes("unusedProductFactsForSlides"), "slide preview unused facts");

const previewModels = buildSlidePreviewModels(
  [
    { slideId: "01_main_photo", imageRole: "main_photo", templateLabel: "Hero" },
    { slideId: "02_benefits", imageRole: "benefits_infographic", templateLabel: "Сетка" },
    { slideId: "04_materials", imageRole: "materials", templateLabel: "Материал" },
  ],
  [
    {
      id: "b1",
      label: "Преимущество",
      value: "Лёгкая",
      type: "benefit",
      source: "user",
      lockedText: true,
      visibleOnCard: true,
    },
    {
      id: "m1",
      label: "Материал",
      value: "пластик",
      type: "material",
      source: "user",
      lockedText: true,
      visibleOnCard: true,
    },
    {
      id: "u1",
      label: "Уход",
      value: "ручная стирка",
      type: "care",
      source: "user",
      lockedText: true,
      visibleOnCard: true,
    },
  ],
  { textDensity: "medium", productTitle: "Бутылка" },
);
const mainPreview = previewModels.find((m) => m.slideId === "01_main_photo");
const benefitsPreview = previewModels.find((m) => m.slideId === "02_benefits");
assert(mainPreview && !mainPreview.cardTextPhrases.includes("Лёгкая"), "main photo без benefit text");
assert(
  benefitsPreview && benefitsPreview.cardTextPhrases.includes("Лёгкая"),
  "benefits slide содержит benefit text",
);
assert(
  previewModels.some((m) => m.slideId === "04_materials" && m.facts.some((f) => f.value === "пластик")),
  "material slide только material facts",
);
const previewFacts = [
  {
    id: "b1",
    label: "Преимущество",
    value: "Лёгкая",
    type: "benefit" as const,
    source: "user" as const,
    lockedText: true,
    visibleOnCard: true,
  },
  {
    id: "m1",
    label: "Материал",
    value: "пластик",
    type: "material" as const,
    source: "user" as const,
    lockedText: true,
    visibleOnCard: true,
  },
  {
    id: "u1",
    label: "Уход",
    value: "ручная стирка",
    type: "care" as const,
    source: "user" as const,
    lockedText: true,
    visibleOnCard: true,
  },
];
const unused = unusedProductFactsForSlides(
  ["main_photo", "benefits_infographic", "materials"],
  previewFacts,
);
assert(unused.some((f) => f.id === "u1"), "unused facts содержит care");

assert(
  genSrc.includes("buildCardBuilderSuperPromptWithAppSettings"),
  "generation использует AppSetting prompts",
);
assert(genSrc.includes("promptSource"), "metadata promptSource");

console.log("[verify-product-card-card-builder] OK");
