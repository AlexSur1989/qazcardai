/**
 * Проверка универсального сценария «Создать карточку».
 * Запуск: npm run verify:product-card-card-builder
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { APP_SETTINGS_REGISTRY } from "@/config/app-settings-registry";
import { CARD_BUILDER_PROMPTS_DEFAULTS } from "@/config/card-builder-prompts-defaults";
import { mergeCardBuilderPromptsWithDefaults } from "@/lib/validations/card-builder-prompts-setting";
import { getAllowedTemplatesForSlide } from "@/config/card-builder-template-allowlist";
import { buildUniversalGalleryTemplateIds } from "@/lib/card-builder-universal-planner";
import { getCardBuilderTemplate } from "@/config/card-builder-templates";
import { buildCardBuilderInstructionSnippet } from "@/lib/card-builder-prompt-instructions";
import { computeEffectiveCardBuilderSettingsForSlide } from "@/lib/card-builder-effective-settings";
import { buildUniversalCardBuilderGalleryPlan } from "@/server/services/universalCardBuilderPlan";
import { computeCardBuilderProductTitle } from "@/lib/card-builder-product-title";
import { buildSlidePreviewModels, unusedProductFactsForSlides, computeSlideCardTextPhrases } from "@/lib/card-builder-slide-preview";
import {
  hasBenefitProductFacts,
  lockedTextPhrasesFromFacts,
  productFactsForSlideRole,
} from "@/lib/card-builder-product-facts";
import { derivePlanStyleFields } from "@/lib/card-builder-style-choice";
import { UNIVERSAL_CARD_BUILDER_PROFILE } from "@/config/universal-card-builder-profile";
import { cardBuilderPlanFieldsSchema } from "@/lib/validations/card-builder-plan";
import {
  filterFactsForGeneration,
  isFactEligibleForGeneration,
} from "@/lib/card-builder-fact-eligibility";
import { visionAnalysisToProductFacts } from "@/lib/card-builder-vision-facts";
import { enrichCardBuilderGallerySlides } from "@/server/services/cardBuilderTextSlots";
import { buildCardBuilderSuperPrompt } from "@/server/services/cardBuilderPromptBuilder";
import { resolveCardBuilderTemplatePromptKey } from "@/lib/card-builder-template-prompt-aliases";
import { CARD_BUILDER_PROMPT_MAX_LEN } from "@/lib/validations/card-builder-prompts-setting";
import {
  buildCardBuilderGalleryPlan,
  type CardBuilderPlanInput,
} from "@/server/services/productCardBuilderPlan";
import { isUniversalCardBuilderTarget } from "@/config/universal-card-builder-profile";
import { CARD_BUILDER_OUTPUT_SIZES } from "@/config/card-builder-output-sizes";
import { resolveCardBuilderOutputSize } from "@/lib/card-builder-output-size";
import { SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS } from "@/config/simple-product-card-prompts-defaults";
import { mergeSimpleProductCardPromptsWithDefaults } from "@/lib/validations/simple-product-card-prompts-setting";
import {
  aspectRatioToSimpleCardSizeId,
  normalizeSimpleCardPayload,
  simpleCardUsesReference,
} from "@/lib/validations/simple-product-card";
import { buildSimpleProductCardPrompt } from "@/server/services/simpleProductCardPromptBuilder";
import {
  formatConfirmedDimensionsBlock,
  NO_DIMENSIONS_RULE,
  parseSimpleCardUserText,
  structureSimpleCardUserText,
} from "@/lib/simple-product-card-user-text";
import {
  mergeSimpleCardProductLabelIntoUserText,
  visionAnalysisToSimpleCardSuggestions,
} from "@/lib/simple-product-card-vision-text";
import {
  parseSimpleProductCardContent,
  hasConfirmedMeasurements,
} from "@/lib/simple-product-card-parsed-content";

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
assert(genSrc.includes("cardBuilderOutputSizeId"), "generation передаёт cardBuilderOutputSizeId");
assert(genSrc.includes("buildCardBuilderImageModelSettings"), "generation собирает aspect_ratio для модели");

assert(CARD_BUILDER_OUTPUT_SIZES.length === 5, "5 выходных форматов card_builder");
for (const preset of CARD_BUILDER_OUTPUT_SIZES) {
  const s = resolveCardBuilderOutputSize(preset.id);
  assert(s.kieAspectRatio === preset.aspectRatio, `Kie aspect для ${preset.id}`);
  assert(s.width === preset.width && s.height === preset.height, `px для ${preset.id}`);
}

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
    (promptsEntry.defaultValue as { version?: string }).version === "card_builder_prompts_v2.2",
  "default prompts version v2.2",
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
  promptBuilderSrc.includes("buildCardBuilderGlobalRulesSection"),
  "prompt builder inserts global rules once",
);
assert(
  !promptBuilderSrc.includes("mergedCategoryStyleSection("),
  "prompt builder uses pickCategoryPrompt instead of hardcoded category hints",
);
assert(
  promptBuilderSrc.includes("computeEffectiveCardBuilderSettings"),
  "prompt builder uses effective settings layer",
);

function assertSnippet(
  input: Parameters<typeof buildCardBuilderInstructionSnippet>[0],
  mustNotContain: string[],
) {
  const { snippet } = buildCardBuilderInstructionSnippet(input);
  const p = snippet.toLowerCase();
  for (const bad of mustNotContain) {
    assert(!p.includes(bad.toLowerCase()), `snippet must not contain «${bad}»`);
  }
}

function assertSnippetContains(
  input: Parameters<typeof buildCardBuilderInstructionSnippet>[0],
  need: string[],
) {
  const { snippet } = buildCardBuilderInstructionSnippet(input);
  const p = snippet.toLowerCase();
  for (const s of need) {
    assert(p.includes(s.toLowerCase()), `snippet must contain «${s}»`);
  }
}

// 1) lifestyle + infographic + heavy
assertSnippet(
  {
    slideRole: "lifestyle",
    rawSalesStyle: "infographic",
    rawTextDensity: "heavy",
    rawVisualStyle: "infographic",
    categoryKey: "beauty_care",
    productFacts: [],
    exactTextPhrases: ["Clear Men", "Шампунь"],
  },
  ["3–5 преимуществ", "плашки, иконки, выноски, сетка", "стиль: инфографика"],
);

// 2) main_photo + heavy + benefit facts
assertSnippet(
  {
    slideRole: "main_photo",
    rawSalesStyle: "infographic",
    rawTextDensity: "heavy",
    rawVisualStyle: "infographic",
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
    exactTextPhrases: ["Clear Men"],
  },
  ["3–5 преимуществ", "плашки, иконки", "стиль: инфографика"],
);

// 3) benefits with 3 benefits
assertSnippetContains(
  {
    slideRole: "benefits_infographic",
    rawSalesStyle: "infographic",
    rawTextDensity: "heavy",
    rawVisualStyle: "infographic",
    productFacts: [
      { id: "b1", label: "A", value: "Ледяная свежесть", type: "benefit", source: "user", lockedText: true },
      { id: "b2", label: "B", value: "Для мужчин", type: "benefit", source: "user", lockedText: true },
      { id: "b3", label: "C", value: "Ежедневный уход", type: "benefit", source: "user", lockedText: true },
    ],
    exactTextPhrases: ["Clear Men", "Ледяная свежесть", "Для мужчин", "Ежедневный уход"],
  },
  ["стиль: инфографика", "3–5 преимуществ"],
);

// 4) dimensions without facts
assertSnippet(
  {
    slideRole: "dimensions",
    rawSalesStyle: "clean_catalog",
    rawTextDensity: "heavy",
    productFacts: [],
    exactTextPhrases: ["Бутылка"],
  },
  ["3–5 преимуществ"],
);
assertSnippetContains(
  {
    slideRole: "dimensions",
    rawSalesStyle: "clean_catalog",
    rawTextDensity: "heavy",
    productFacts: [],
    exactTextPhrases: ["Бутылка"],
  },
  ["без числовых размеров"],
);

// 5) materials without facts
assertSnippetContains(
  {
    slideRole: "materials",
    rawSalesStyle: "clean_catalog",
    rawTextDensity: "medium",
    productFacts: [],
    exactTextPhrases: [],
  },
  ["visual texture", "не называй конкретный материал"],
);

// 6) exactTextPhrases <= 2
assertSnippet(
  {
    slideRole: "benefits_infographic",
    rawSalesStyle: "infographic",
    rawTextDensity: "heavy",
    productFacts: [
      { id: "b1", label: "A", value: "One", type: "benefit", source: "user", lockedText: true },
    ],
    exactTextPhrases: ["Only Title", "One"],
  },
  ["3–5 преимуществ"],
);

// 7) gallery 8 set_contents template exists
assert(getCardBuilderTemplate("set_contents"), "set_contents в CARD_BUILDER_TEMPLATES");
const gallery8Pkg = buildUniversalGalleryTemplateIds({
  categoryKey: "gadgets_tech",
  productFacts: [
    {
      id: "p1",
      label: "Комплект",
      value: "2 шт",
      type: "package",
      source: "user",
      visibleOnCard: true,
      lockedText: true,
    },
  ],
  galleryCount: 8,
});
assert(gallery8Pkg.includes("set_contents"), "gallery 8 с package facts → set_contents");
const plan8 = buildUniversalCardBuilderGalleryPlan(
  basePlan({
    creationMode: "full_gallery",
    gallerySlideCount: 8,
    goal: "full_gallery_8",
    productFacts: [
      {
        id: "p1",
        label: "Комплект",
        value: "2 шт",
        type: "package",
        source: "user",
        visibleOnCard: true,
        lockedText: true,
      },
    ],
  }),
  UNIVERSAL_CARD_BUILDER_PROFILE,
);
assert(plan8.slides.length === 8, "full_gallery_8 plan → 8 slides with package facts");

// 8) preview title = generation title rule
assert(
  computeCardBuilderProductTitle({
    settingsProductTitle: "A",
    productNameGuess: "B",
    projectTitle: "C",
  }) === "A",
  "computedProductTitle settings first",
);
assert(
  computeCardBuilderProductTitle({ productNameGuess: "B", projectTitle: "C" }) === "B",
  "computedProductTitle guess second",
);
assert(
  computeCardBuilderProductTitle({ projectTitle: "C" }) === "C",
  "computedProductTitle project third",
);

// benefits without facts blocks generation
const blocked = computeEffectiveCardBuilderSettingsForSlide({
  slideRole: "benefits_infographic",
  rawSalesStyle: "infographic",
  rawTextDensity: "heavy",
  productFacts: [],
  exactTextPhrases: [],
});
assert(blocked.blockGeneration, "benefits_infographic без facts блокируется");

assert(
  promptBuilderSrc.includes("computeEffectiveCardBuilderSettings"),
  "prompt builder uses effective settings layer",
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

// --- product_purpose fact type ---
const purposeFact = {
  id: "pp1",
  label: "Назначение",
  value: "Шампунь против перхоти для мужчин",
  type: "product_purpose" as const,
  source: "user" as const,
  visibleOnCard: true,
  lockedText: true,
};

const lifestylePurposeFacts = productFactsForSlideRole([purposeFact], "lifestyle");
assert(lifestylePurposeFacts.length === 1, "product_purpose попадает на lifestyle slide facts");
const lifestylePhrases = lockedTextPhrasesFromFacts(lifestylePurposeFacts);
assert(
  lifestylePhrases.includes("Шампунь против перхоти для мужчин"),
  "product_purpose в locked phrases для lifestyle",
);

const mainPurposeFacts = productFactsForSlideRole([purposeFact], "main_photo");
assert(mainPurposeFacts.length === 1, "product_purpose разрешён на main_photo");
const mainCardText = computeSlideCardTextPhrases("main_photo", [purposeFact], {
  productTitle: "Clear Men Ледяная свежесть",
  textDensity: "medium",
  mainPhotoTextAllowed: true,
});
assert(
  mainCardText.includes("Шампунь против перхоти для мужчин"),
  "product_purpose как subtitle на main_photo при разрешённом тексте",
);
const mainCardTextBlocked = computeSlideCardTextPhrases("main_photo", [purposeFact], {
  productTitle: "Clear Men",
  textDensity: "medium",
  mainPhotoTextAllowed: false,
});
assert(
  !mainCardTextBlocked.includes("Шампунь против перхоти для мужчин"),
  "product_purpose не на main_photo без текста",
);

const premiumPurposeFacts = productFactsForSlideRole([purposeFact], "premium_poster");
assert(premiumPurposeFacts.length === 1, "product_purpose на premium_poster");

assert(!hasBenefitProductFacts([purposeFact]), "product_purpose не считается benefit");

const blockedBenefitsOnlyPurpose = computeEffectiveCardBuilderSettingsForSlide({
  slideRole: "benefits_infographic",
  rawSalesStyle: "infographic",
  rawTextDensity: "infographic",
  productFacts: [purposeFact],
  exactTextPhrases: ["Title", purposeFact.value],
});
assert(
  blockedBenefitsOnlyPurpose.blockGeneration,
  "benefits_infographic только с product_purpose блокируется",
);

const clearMenPreview = buildSlidePreviewModels(
  [{ slideId: "07_lifestyle", imageRole: "lifestyle", templateLabel: "Lifestyle" }],
  [purposeFact],
  { productTitle: "Clear Men Ледяная свежесть", textDensity: "medium", mainPhotoTextAllowed: true },
);
const clearMenLifestyle = clearMenPreview[0];
assert(clearMenLifestyle, "Clear Men lifestyle preview");
assert(
  clearMenLifestyle.cardTextPhrases.length === 2 &&
    clearMenLifestyle.cardTextPhrases[0] === "Clear Men Ледяная свежесть" &&
    clearMenLifestyle.cardTextPhrases[1] === "Шампунь против перхоти для мужчин",
  "Clear Men lifestyle preview: 2 фразы на карточке",
);
assert(
  clearMenLifestyle.facts.some((f) => f.label === "Назначение"),
  "Clear Men lifestyle preview: fact в данных товара",
);

const rawInfographic = derivePlanStyleFields({ visualStyle: "infographic", textAmountToggle: "more" });
const clearMenEffective = computeEffectiveCardBuilderSettingsForSlide({
  slideRole: "lifestyle",
  categoryKey: "beauty_care",
  rawSalesStyle: rawInfographic.salesStyle,
  rawTextDensity: rawInfographic.textDensity,
  rawVisualStyle: "infographic",
  productFacts: [purposeFact],
  exactTextPhrases: ["Clear Men Ледяная свежесть", purposeFact.value],
});
assert(
  clearMenEffective.suppressInfographicInstructions &&
    clearMenEffective.effectiveSalesStyle === "premium",
  "Clear Men lifestyle effective settings без infographic",
);

const webFact = {
  id: "w1",
  label: "Объём",
  value: "500 мл",
  type: "dimension" as const,
  source: "web_suggested" as const,
  needsReview: true,
  verifiedByUser: false,
  visibleOnCard: true,
  lockedText: true,
};
assert(!isFactEligibleForGeneration(webFact, "beauty_care"), "web_suggested без confirm blocked");
assert(
  isFactEligibleForGeneration({ ...webFact, verifiedByUser: true, needsReview: false }, "other"),
  "web_suggested после confirm allowed",
);

const visionOnly = visionAnalysisToProductFacts({
  categoryKey: "other",
  productType: "кружка",
  productNameGuess: "Termo",
  brandGuess: "BrandX",
  materialGuess: null,
  visibleText: ["500 ml"],
  visibleClaims: [],
  suggestedProductFacts: [
    { label: "Преимущество", value: "Лёгкая", type: "benefit", confidence: 0.9 },
  ],
  confidence: 0.8,
});
assert(
  !visionOnly.some((f) => f.type === "benefit"),
  "visionAnalysisToProductFacts не добавляет benefit из suggested",
);
assert(visionOnly.some((f) => f.source === "vision_ai"), "vision facts имеют source vision_ai");

// --- v2.2 template aliases ---
assert(
  resolveCardBuilderTemplatePromptKey("set_contents") === "packaging_set",
  "alias set_contents → packaging_set",
);
assert(
  resolveCardBuilderTemplatePromptKey("size_scale") === "scale_comparison",
  "alias size_scale → scale_comparison",
);
assert(
  resolveCardBuilderTemplatePromptKey("hero_clean") === "main_photo",
  "alias hero_clean → main_photo",
);
assert(
  resolveCardBuilderTemplatePromptKey("benefits_grid") === "benefits_infographic",
  "alias benefits_grid → benefits_infographic",
);

function baseSuperPrompt(
  overrides: Partial<Parameters<typeof buildCardBuilderSuperPrompt>[0]> = {},
): Parameters<typeof buildCardBuilderSuperPrompt>[0] {
  return {
    selectedCategory: "other",
    marketplace: "other",
    preserveProduct: true,
    slideRole: "main_photo",
    ...overrides,
  };
}

function assertSuperPrompt(
  label: string,
  input: Parameters<typeof buildCardBuilderSuperPrompt>[0],
  mustContain: string[],
  mustNotContain: string[],
) {
  const built = buildCardBuilderSuperPrompt(input);
  assert(built.ok, `${label}: super prompt build failed`);
  const p = built.data!.prompt.toLowerCase();
  for (const s of mustContain) {
    assert(p.includes(s.toLowerCase()), `${label}: must contain «${s}»`);
  }
  for (const s of mustNotContain) {
    assert(!p.includes(s.toLowerCase()), `${label}: must not contain «${s}»`);
  }
}

// TZ test case 1: beauty_care + lifestyle_scene
assertSuperPrompt(
  "beauty_care lifestyle",
  baseSuperPrompt({
    slideRole: "lifestyle",
    templateId: "beauty_lifestyle",
    cardBuilderCategoryKey: "beauty_care",
    salesStyle: "premium",
    textDensity: "minimal",
    visualStyle: "premium",
    productFacts: [
      {
        id: "pp1",
        label: "Назначение",
        value: "Шампунь для ежедневного ухода",
        type: "product_purpose",
        source: "user",
        visibleOnCard: true,
        lockedText: true,
      },
    ],
    productTitle: "Clear Men",
  }),
  ["global product truth rules", "lifestyle_scene", "beauty_care", "global category rules"],
  ["3–5 преимуществ", "плашки, иконки, выноски, сетка"],
);

// TZ test case 2: gadgets_tech + specs (dimensions slide as specs proxy)
assertSuperPrompt(
  "gadgets specs",
  baseSuperPrompt({
    slideRole: "dimensions",
    templateId: "dimensions_schema",
    cardBuilderCategoryKey: "gadgets_tech",
    salesStyle: "clean_catalog",
    textDensity: "medium",
    productFacts: [
      {
        id: "d1",
        label: "Объём",
        value: "256 ГБ",
        type: "dimension",
        source: "user",
        visibleOnCard: true,
        lockedText: true,
      },
    ],
    productTitle: "Phone X",
  }),
  ["256 гб", "dimensions_size", "gadgets_tech"],
  ["512 гб", "гарантия 2 года"],
);

// TZ test case 3: food_drinks + benefits_infographic
assertSuperPrompt(
  "food benefits",
  baseSuperPrompt({
    slideRole: "benefits_infographic",
    templateId: "benefits_grid",
    cardBuilderCategoryKey: "food_drinks",
    salesStyle: "infographic",
    textDensity: "medium",
    visualStyle: "infographic",
    productFacts: [
      {
        id: "b1",
        label: "Вкус",
        value: "Нежный шоколад",
        type: "benefit",
        source: "user",
        visibleOnCard: true,
        lockedText: true,
      },
    ],
    productTitle: "Батончик",
  }),
  ["food_drinks", "benefits_infographic"],
  [],
);

// TZ test case 4: home_interior + dimensions without dimensions
assertSuperPrompt(
  "interior dimensions soft scale",
  baseSuperPrompt({
    slideRole: "dimensions",
    templateId: "scale_comparison",
    cardBuilderCategoryKey: "home_interior",
    salesStyle: "clean_catalog",
    textDensity: "medium",
    productFacts: [],
    productTitle: "Ваза",
  }),
  ["без числовых размеров", "scale_comparison", "home_interior"],
  [],
);

// TZ test case 5: kids comparison_card blocked without facts
const kidsComparisonBlocked = computeEffectiveCardBuilderSettingsForSlide({
  slideRole: "benefits_infographic",
  templateId: "comparison_card",
  categoryKey: "kids_products",
  rawSalesStyle: "infographic",
  rawTextDensity: "medium",
  productFacts: [],
  exactTextPhrases: ["Игрушка"],
});
assert(kidsComparisonBlocked.blockGeneration, "kids comparison_card без facts блокируется");

// TZ test case 6: packaging_set without package facts blocked
const packagingBlocked = computeEffectiveCardBuilderSettingsForSlide({
  slideRole: "packaging",
  templateId: "set_contents",
  categoryKey: "gadgets_tech",
  rawSalesStyle: "clean_catalog",
  rawTextDensity: "medium",
  productFacts: [],
  exactTextPhrases: ["Набор"],
});
assert(packagingBlocked.blockGeneration, "packaging/set_contents без package facts блокируется");

// TZ test case 7: social_proof blocked without review facts
const socialBlocked = computeEffectiveCardBuilderSettingsForSlide({
  slideRole: "social_proof",
  rawSalesStyle: "clean_catalog",
  rawTextDensity: "medium",
  productFacts: [],
  exactTextPhrases: [],
});
assert(socialBlocked.blockGeneration, "social_proof без review блокируется");

// TZ test case 8: offer/ad_banner blocked without promo facts
const offerBlocked = computeEffectiveCardBuilderSettingsForSlide({
  slideRole: "ad_banner",
  rawSalesStyle: "bold_ad",
  rawTextDensity: "medium",
  productFacts: [],
  exactTextPhrases: ["Товар"],
});
assert(offerBlocked.blockGeneration, "ad_banner без promo facts блокируется");

assert(
  resolveCardBuilderTemplatePromptKey("instruction_steps") === "instruction_steps",
  "template instruction_steps key",
);
assert(
  resolveCardBuilderTemplatePromptKey("social_proof_card") === "social_proof",
  "alias social_proof_card → social_proof",
);

const samplePrompt = buildCardBuilderSuperPrompt(
  baseSuperPrompt({
    slideRole: "main_photo",
    templateId: "hero_clean",
    cardBuilderCategoryKey: "beauty_care",
    salesStyle: "clean_catalog",
    textDensity: "minimal",
    productFacts: [],
    productTitle: "Test SKU",
  }),
);
assert(samplePrompt.ok, "sample super prompt builds");
const promptLen = samplePrompt.data!.prompt.length;
assert(promptLen <= CARD_BUILDER_PROMPT_MAX_LEN, `prompt size ${promptLen} <= ${CARD_BUILDER_PROMPT_MAX_LEN}`);
const globalCount = (samplePrompt.data!.prompt.match(/GLOBAL PRODUCT TRUTH RULES/gi) ?? []).length;
assert(globalCount === 1, "GLOBAL PRODUCT TRUTH RULES inserted once");

// --- Simple product card flow ---

const simpleEnabled = APP_SETTINGS_REGISTRY.find((e) => e.key === "PRODUCT_CARD_SIMPLE_CARD_ENABLED");
assert(simpleEnabled, "PRODUCT_CARD_SIMPLE_CARD_ENABLED в APP_SETTINGS_REGISTRY");
const simplePrompts = APP_SETTINGS_REGISTRY.find((e) => e.key === "PRODUCT_CARD_SIMPLE_CARD_PROMPTS");
assert(simplePrompts, "PRODUCT_CARD_SIMPLE_CARD_PROMPTS в APP_SETTINGS_REGISTRY");

const classicNorm = normalizeSimpleCardPayload({
  productPhotoId: "p1",
  userText: "Тест",
  styleMode: "classic",
  useReference: false,
  aspectRatio: "1:1",
});
assert(!simpleCardUsesReference(classicNorm), "classic без reference");
assert(classicNorm.referenceImageId == null, "classic без referenceImageId");

const classicRefNorm = normalizeSimpleCardPayload({
  productPhotoId: "p1",
  userText: "Тест",
  styleMode: "classic",
  useReference: true,
  referenceImageId: "r1",
  referenceCreativity: 50,
  aspectRatio: "1:1",
});
assert(simpleCardUsesReference(classicRefNorm), "classic с reference");

const premiumNorm = normalizeSimpleCardPayload({
  productPhotoId: "p1",
  userText: "Тест",
  styleMode: "premium",
  useReference: true,
  referenceImageId: "r1",
  referenceCreativity: 80,
  aspectRatio: "16:9",
});
assert(!simpleCardUsesReference(premiumNorm), "premium не использует reference");
assert(premiumNorm.referenceImageId == null, "premium очищает referenceImageId");

assert(aspectRatioToSimpleCardSizeId("9:16") === "9x16", "aspect 9:16 → 9x16");

const mergedSimple = mergeSimpleProductCardPromptsWithDefaults(null);
const structured = structureSimpleCardUserText(
  "Заголовок\nПодзаг\nФраза 1\nФраза 2\nФраза 3",
  mergedSimple.prompts.maxKeyPhrases,
);
assert(structured.headline === "Заголовок", "user text headline");
assert(structured.keyPhrases.length <= mergedSimple.prompts.maxKeyPhrases, "key phrases limit");

const builtClassic = buildSimpleProductCardPrompt({
  payload: classicNorm,
  prompts: SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS,
  aspectRatio: "1:1",
});
assert(builtClassic.prompt.includes("Image A = main product image"), "Image A в prompt");
assert(builtClassic.prompt.includes("USER PROVIDED CONTENT"), "structured USER PROVIDED CONTENT");
assert(!builtClassic.prompt.includes("Image B"), "classic без Image B");
assert(builtClassic.usesReference === false, "builtClassic usesReference false");

const builtRef = buildSimpleProductCardPrompt({
  payload: classicRefNorm,
  prompts: SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS,
  aspectRatio: "1:1",
});
assert(builtRef.prompt.includes("Image B = style reference"), "Image B при reference");
assert(builtRef.creativityInstruction != null, "creativity instruction при reference");

// Dimensions / specs detection (TZ cases 1–6)
const case1 = parseSimpleCardUserText(
  "Размер 20×30 см. Лёгкий и удобный органайзер для кухни.",
  4,
);
assert(case1.hasDimensionsOrSpecs, "case1: размер 20×30 см detected");
assert(case1.dimensions.some((d) => d.label === "Size (WxH)"), "case1: WxH label");
assert(case1.benefits.some((b) => b.includes("органайзер")), "case1: benefit preserved");
const case1Block = formatConfirmedDimensionsBlock(case1);
assert(case1Block?.includes("20"), "case1: confirmed block has size");

const case2 = parseSimpleCardUserText("Объём 500 мл. Подходит для ежедневного ухода.", 4);
assert(case2.hasDimensionsOrSpecs, "case2: volume detected");
assert(case2.specs.some((s) => s.label === "Volume"), "case2: volume label");
assert(!case2.dimensions.some((d) => d.label === "Height"), "case2: no fake height");

const case3 = parseSimpleCardUserText("Высота 15 см, ширина 8 см, вес 250 г.", 4);
assert(case3.dimensions.some((d) => d.label === "Height"), "case3: height");
assert(case3.dimensions.some((d) => d.label === "Width"), "case3: width");
assert(case3.specs.some((s) => s.label === "Weight"), "case3: weight");

const case4 = parseSimpleCardUserText("Красивый современный дизайн, удобный для дома.", 4);
assert(!case4.hasDimensionsOrSpecs, "case4: no dimensions");

const builtCase4 = buildSimpleProductCardPrompt({
  payload: { ...classicNorm, userText: "Красивый современный дизайн, удобный для дома." },
  prompts: SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS,
  aspectRatio: "1:1",
});
assert(builtCase4.prompt.includes("No confirmed measurements were provided"), "case4: no-dimensions rule in prompt");
assert(!builtCase4.hasDimensionsOrSpecs, "case4: flag false");

const case6 = parseSimpleCardUserText("Мощность 1200 Вт, объём 1.8 л.", 4);
assert(case6.specs.some((s) => s.label === "Power"), "case6: power");
assert(case6.specs.some((s) => s.label === "Volume"), "case6: volume");

const builtCase6 = buildSimpleProductCardPrompt({
  payload: { ...premiumNorm, userText: "Мощность 1200 Вт, объём 1.8 л." },
  prompts: SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS,
  aspectRatio: "1:1",
});
assert(builtCase6.prompt.includes("DIMENSIONS VISUALIZATION PROMPT"), "case6: dimensions prompt included");
assert(builtCase6.prompt.includes("CONFIRMED SPECS:"), "case6: confirmed specs block");
assert(builtCase6.prompt.includes("power: 1200"), "case6: power in structured content");

assert(
  SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS.dimensionsPrompt.includes("measurement arrows"),
  "dimensionsPrompt default present",
);

const visionSuggestions = visionAnalysisToSimpleCardSuggestions({
  productNameGuess: "Clear Men Ледяная свежесть",
  brandGuess: "Clear",
  productType: "шампунь",
  materialGuess: null,
  visibleText: ["500 мл"],
  visibleClaims: ["Против перхоти"],
  suggestedProductFacts: [
    { label: "Назначение", value: "Шампунь для мужчин", type: "product_purpose", confidence: 0.9 },
    { label: "Преимущество", value: "Лёгкая", type: "benefit", confidence: 0.9 },
  ],
});
assert(
  visionSuggestions.productLabel.includes("Clear Men"),
  "vision suggestions: productLabel из name/brand",
);
assert(
  visionSuggestions.suggestedUserText.includes("Шампунь для мужчин"),
  "vision suggestions: purpose в suggestedUserText",
);
assert(
  !visionSuggestions.suggestedUserText.includes("Лёгкая"),
  "vision suggestions: benefit не попадает в suggestedUserText",
);
assert(
  mergeSimpleCardProductLabelIntoUserText("Clear Men", "Против перхоти") === "Clear Men\nПротив перхоти",
  "merge label + userText",
);
assert(
  mergeSimpleCardProductLabelIntoUserText("Clear Men", "Clear Men\nПротив перхоти") === "Clear Men\nПротив перхоти",
  "merge без дубля названия",
);

// --- MEGA PROMPT BUILDER (simple product card) ---

function assertMegaPrompt(label: string, userText: string, checks: {
  mustContain: string[];
  mustNotContain: string[];
}) {
  const payload = normalizeSimpleCardPayload({
    productPhotoId: "p1",
    userText,
    styleMode: "classic",
    useReference: false,
    aspectRatio: "1:1",
  });
  const built = buildSimpleProductCardPrompt({
    payload,
    prompts: SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS,
    aspectRatio: "1:1",
  });
  const p = built.prompt;
  for (const s of checks.mustContain) {
    assert(p.includes(s), `${label}: prompt contains "${s.slice(0, 60)}"`);
  }
  for (const s of checks.mustNotContain) {
    assert(!p.includes(s), `${label}: prompt must NOT contain "${s.slice(0, 60)}"`);
  }
}

const joystickParsed = parseSimpleProductCardContent(
  "Джойстик для PlayStation. Крутой. Не боится падений. Размер 60×27×32 мм. Доставка по Алматы.",
);
assert(joystickParsed.headline?.includes("Джойстик"), "joystick: headline");
assert(joystickParsed.benefits.length >= 2, "joystick: benefits");
assert(hasConfirmedMeasurements(joystickParsed.measurements), "joystick: measurements");
assert(joystickParsed.measurements.width?.includes("60"), "joystick: width 60");
assert(joystickParsed.delivery.length >= 1, "joystick: delivery");

assertMegaPrompt("joystick", "Джойстик для PlayStation. Крутой. Не боится падений. Размер 60×27×32 мм. Доставка по Алматы.", {
  mustContain: [
    "USER PROVIDED CONTENT",
    "HEADLINE:",
    "Джойстик для PlayStation",
    "BENEFITS:",
    "Крутой",
    "CONFIRMED MEASUREMENTS:",
    "width: 60",
    "height: 27",
    "depth: 32",
    "DELIVERY:",
    "Доставка по Алматы",
    "MEASUREMENT VISUAL INSTRUCTIONS",
    "Do NOT show all dimensions only inside one bottom badge",
    "Render exactly:",
    "Джойстик для PlayStation",
  ],
  mustNotContain: ["one bottom badge only"],
});

const creamParsed = parseSimpleProductCardContent(
  "Крем для рук. Объём 50 мл. Ежедневный уход. Нежная текстура.",
);
assert(creamParsed.specs.volume?.includes("50"), "cream: volume 50 ml");
assertMegaPrompt("cream", "Крем для рук. Объём 50 мл. Ежедневный уход. Нежная текстура.", {
  mustContain: ["CONFIRMED SPECS:", "volume: 50", "Ежедневный уход", "Нежная текстура"],
  mustNotContain: ["CONFIRMED MEASUREMENTS:\n- width", "MEASUREMENT VISUAL INSTRUCTIONS:\n- Show width"],
});

const blenderParsed = parseSimpleProductCardContent(
  "Портативный блендер. Мощность 1200 Вт. Объём 500 мл. USB-C. Скидка 20%.",
);
assert(blenderParsed.specs.power?.includes("1200"), "blender: power");
assert(blenderParsed.offer.discount?.includes("20"), "blender: discount");
assertMegaPrompt("blender", "Портативный блендер. Мощность 1200 Вт. Объём 500 мл. USB-C. Скидка 20%.", {
  mustContain: ["power: 1200", "volume: 500", "USB-C", "OFFER / PROMO:", "Скидка 20%"],
  mustNotContain: ["гарантия", "доставка"],
});

const backpackParsed = parseSimpleProductCardContent(
  "Детский рюкзак. Для школы. В комплекте пенал. Размер 30×40×12 см.",
);
assert(backpackParsed.targetAudience.some((t) => t.includes("школ")), "backpack: audience");
assert(backpackParsed.packageContents.length >= 1, "backpack: package");
assert(hasConfirmedMeasurements(backpackParsed.measurements), "backpack: measurements");
assertMegaPrompt("backpack", "Детский рюкзак. Для школы. В комплекте пенал. Размер 30×40×12 см.", {
  mustContain: [
    "TARGET AUDIENCE",
    "Для школы",
    "PACKAGE CONTENTS",
    "пенал",
    "width: 30",
    "height: 40",
    "depth: 12",
  ],
  mustNotContain: [],
});

const noDimParsed = parseSimpleProductCardContent("Современный дизайн. Удобный для дома.");
assert(!hasConfirmedMeasurements(noDimParsed.measurements), "no-dim: no measurements");
assertMegaPrompt("no-dim", "Современный дизайн. Удобный для дома.", {
  mustContain: ["BENEFITS:", "Современный дизайн", "No confirmed measurements were provided"],
  mustNotContain: ["CONFIRMED MEASUREMENTS:\n- width", "Show width ("],
});

const builtMegaClassic = buildSimpleProductCardPrompt({
  payload: classicNorm,
  prompts: SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS,
  aspectRatio: "1:1",
});
assert(builtMegaClassic.prompt.includes("USER PROVIDED CONTENT"), "mega prompt: structured content block");
assert(builtMegaClassic.prompt.includes("Image A = main product image"), "mega prompt: Image A");
assert(!builtMegaClassic.prompt.includes("Image B"), "mega classic без Image B");

console.log("[verify-product-card-card-builder] OK");
