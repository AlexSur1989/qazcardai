import "server-only";

import {
  type MarketplaceCardStyle,
  PRODUCT_CATEGORY_IDS,
  type ProductCategoryId,
  type ProductVideoMotionStyle,
} from "@/config/product-card-categories";

function isProductCategoryId(s: string): s is ProductCategoryId {
  return (PRODUCT_CATEGORY_IDS as readonly string[]).includes(s);
}

/**
 * Скрытые промпты: только бэкенд / server bundles.
 * `product-card-categories` не импортирует этот модуль.
 */

// --- Shared bases (product photo) ---

export const BASE_PRODUCT_PHOTO_PROMPT = [
  "Use uploaded product photos as reference images. Preserve exact product identity, shape, color, material, design and important details.",
  "Use the uploaded product photos as references for accurate shape, details, color, and design.",
  "Preserve the product identity, shape, color, packaging, logo placement, and key visible details as much as possible.",
  "Create a realistic commercial product image.",
  "The product must remain the main subject. Do not invent a different product.",
  "Improve lighting, composition, background, and presentation while keeping the product recognizable.",
  "High-quality product photography, realistic materials, clean composition, professional advertising style.",
].join(" ");

// --- Per-concept hidden instructions (language: English) ---

type ConceptMap = Record<string, string>;

const APPAREL: ConceptMap = {
  on_model:
    "Mode: on-model fashion shot. Show the product naturally worn, flattering fit, clean portrait-friendly composition, true colors, no wardrobe swap that changes the product identity.",
  studio_catalog:
    "Mode: studio e-commerce catalog. Neutral seamless background, even soft key light, high clarity, no props, packaging and silhouette readable.",
  flat_lay:
    "Mode: top-down flat lay. Arrange the product in a clean editorial layout from above, soft controlled shadows, balanced composition, premium retail look.",
  lifestyle_hands:
    "Mode: lifestyle / in-hands. Candid, real-life context, natural daylight, believable use case, the product is clearly visible and the hero of the frame.",
  fabric_closeup:
    "Mode: material macro. Emphasize fabric weave, texture, stitching, and detail with sharpness and realistic micro-contrast, commercial macro quality.",
  full_look:
    "Mode: full outfit. Present a coherent full-look where the product remains identifiable and not replaced; styling supports the product without changing it.",
};

const ACCESSORIES: ConceptMap = {
  studio_catalog:
    "Mode: studio catalog. Clean background, high sharpness, luxury retail clarity, true metal/leather/glass look.",
  on_model:
    "Mode: on model. Show the product worn/held in a natural pose; crisp lighting; premium campaign polish.",
  premium_lifestyle:
    "Mode: premium lifestyle. Aspirational but realistic scene, warm or cool grade matching the product, uncluttered background.",
  detail_closeup:
    "Mode: detail macro. Engraving, clasp, lens, links, and hardware; ultra-sharp, controlled reflections, no over-blown speculars.",
  in_composition:
    "Mode: composed still life. Tasteful supporting props, balanced negative space, story without stealing focus from the product.",
  ad_poster:
    "Mode: advertising poster. Strong hero product, high contrast, print-ready, bold composition with readable hierarchy (visual only, no text generation required).",
};

const FOOD: ConceptMap = {
  studio_catalog:
    "Mode: studio product pack. Packaging labels sharp and legible, accurate colors, no replacing the product with a different pack.",
  serving:
    "Mode: food styling / serving. Appetizing plating, elegant tableware, food-safe presentation, natural highlights, shallow depth of field as appropriate.",
  ingredients:
    "Mode: with ingredients. Fresh ingredients artfully placed to signal taste and quality; keep the hero product/brand the anchor.",
  closeup_texture:
    "Mode: macro appetite appeal. Texture, condensation, chocolate cracks, or bubbles; appetizing, clean, and realistic (no food swap).",
  lifestyle_hands:
    "Mode: hands / lifestyle. Real usage moment, warm inviting light, the product and packaging must stay recognizable.",
  ad_banner:
    "Mode: ad banner. Commercial punch, bold lighting, high appetite cues, the product is dominant and not invented.",
};

const BEAUTY: ConceptMap = {
  studio_catalog:
    "Mode: clean beauty still life. Soft gradients, controlled reflections on packaging, no messy splashes that obscure labels.",
  beauty_premium:
    "Mode: premium beauty campaign. High-end sheen, soft highlights, precise edges, no replacing packaging graphics.",
  ingredients:
    "Mode: with ingredients. Botanicals or actives in a clean spa/wellness aesthetic, honest but attractive.",
  shelf_bathroom:
    "Mode: bathroom / shelf. Real but tidy context, good label visibility, believable water/real-surface look without grime.",
  texture:
    "Mode: product texture. Show serum, cream, foam, or lather in a clear, compliant, realistic way; macro clarity.",
  hands_model:
    "Mode: hands or model. Application pose, clear product visibility, clean skin, professional beauty advertising look.",
};

const GADGETS: ConceptMap = {
  studio_catalog:
    "Mode: tech studio. Neutral or subtle gradient background, perfect edges, controlled reflections, no extra logos.",
  tech_ads:
    "Mode: high-tech ad. Blue/teal or tasteful color grade, light streaks, premium gadget campaign vibe, still product-accurate.",
  in_use:
    "Mode: in use. Show believable user hands/interaction, sharp device legibility, natural environment lighting.",
  detail_closeup:
    "Mode: hardware macro. Buttons, ports, display pixels (without inventing a different model), clean technical macro.",
  desk_setup:
    "Mode: desk setup. Modern workspace context, correct scale, minimal cable clutter, premium work aesthetic.",
  hero_poster:
    "Mode: hero poster. One dominant device, strong rim light, dramatic but controlled, with negative space for copy if needed (visual only).",
};

const HOME: ConceptMap = {
  studio_catalog:
    "Mode: furniture catalog. Neutral backdrop, true wood/fabric colors, product-scale clarity, not a different product.",
  in_interior:
    "Mode: in interior. Believable room placement, correct perspective/scale, warm natural or soft diffused light.",
  minimal:
    "Mode: minimal interior. Few objects, lots of breathing room, design-magazine calm composition, product is focal.",
  cozy:
    "Mode: cozy lifestyle. Soft warm light, home comfort cues, the product is clearly the subject within the room.",
  material_closeup:
    "Mode: material macro. Emphasize fabric grain, wood grain, metal finish, and tactile quality.",
  premium_poster:
    "Mode: premium interior poster. High-end real-estate/decor look, editorial staging, not replacing the item.",
};

const OTHER: ConceptMap = {
  studio_catalog:
    "Mode: clean studio. Versatile e-commerce look, one hero object, no clutter, true-to-image identity.",
  lifestyle:
    "Mode: general lifestyle. Realistic scene that fits the product type; keep the product legible and central.",
  closeup:
    "Mode: close-up / detail. Focus on the defining features of the product, sharp, commercial clarity.",
  hero:
    "Mode: hero shot. Single bold hero framing, high impact, clean composition, strong subject separation.",
  ad_poster:
    "Mode: retail poster. Large hero product, visual hierarchy, ready for callouts, no text generation required.",
  clean_studio:
    "Mode: clean still life. Even light, true colors, no unrelated props, professional catalog discipline.",
};

const BY_CATEGORY: Record<ProductCategoryId, ConceptMap> = {
  apparel: APPAREL,
  accessories: ACCESSORIES,
  food_and_drinks: FOOD,
  beauty_and_care: BEAUTY,
  gadgets_and_tech: GADGETS,
  home_and_furniture: HOME,
  other: OTHER,
};

const LEGACY_CONCEPT_ALIASES: Record<string, string> = {
  // Ранний id «еда / каталог»
  studio_pack: "studio_catalog",
};

// --- Classifier (strict JSON) ---

export const PRODUCT_CLASSIFIER_OUTPUT_SCHEMA = `{
  "category": "apparel | accessories | food_and_drinks | beauty_and_care | gadgets_and_tech | home_and_furniture | other",
  "confidence": 0.0,
  "reason": "short reason"
}`;

let classifierPromptCache: string | null = null;

export function getProductCategoryClassifierPrompt(): string {
  if (classifierPromptCache) return classifierPromptCache;
  classifierPromptCache = `You are a product classifier for e-commerce and marketplace content.

Analyze the product in the image and return STRICT JSON only (no markdown, no backticks, no extra keys).
The JSON must match this shape exactly:
${PRODUCT_CLASSIFIER_OUTPUT_SCHEMA}

Rules:
- "category" must be exactly one of: apparel, accessories, food_and_drinks, beauty_and_care, gadgets_and_tech, home_and_furniture, other.
- "confidence" is a number from 0.0 to 1.0.
- "reason" is a short human-readable explanation (max 300 characters, English is OK).
- If you are not confident, choose "other" and set confidence low (for example 0.2–0.4).
- Never invent multiple categories. Never add fields outside the schema.`;
  return classifierPromptCache;
}

// --- Concept helpers ---

function resolveConceptId(categoryId: ProductCategoryId, conceptId: string): string {
  return LEGACY_CONCEPT_ALIASES[conceptId] ?? conceptId;
}

/**
 * Скрытая инструкция по концепции (только сценовый «режим»; без BASE).
 */
export function getConceptPrompt(categoryId: string, conceptId: string): string {
  const cat: ProductCategoryId = isProductCategoryId(categoryId)
    ? categoryId
    : "other";
  const key = resolveConceptId(cat, conceptId);
  const table = BY_CATEGORY[cat];
  const line = table[key] ?? table.studio_catalog ?? OTHER.studio_catalog;
  return line;
}

/**
 * Полный system-текст для image-модели: base + сценовая инструкция.
 * (Опциональный пользовательский текст добавляет маршрут, чтобы не дублировать префикс User:)
 */
export function getConceptSystemPrompt(
  categoryId: ProductCategoryId,
  conceptId: string,
): string {
  return buildConceptPhotoPrompt({ categoryId, conceptId, userPrompt: "" });
}

export function buildConceptPhotoPrompt(input: {
  categoryId: ProductCategoryId;
  conceptId: string;
  userPrompt?: string;
}): string {
  const { categoryId, conceptId } = input;
  const u = (input.userPrompt ?? "").trim();
  const concept = getConceptPrompt(categoryId, conceptId);
  const parts = [BASE_PRODUCT_PHOTO_PROMPT, concept, u ? `User instructions: ${u}` : ""].filter(Boolean);
  return parts.join("\n\n");
}

// --- Marketplace card ---
//
// TODO (product v2): v1 = чисто image model + prompt (риск кривого текста на кадре). Для
// production-quality текста/плашек — позже: overlay (HTML/SVG/canvas) поверх/вместо AI-текста.

/** Compact on purpose: must stay under moderation MAX_PROMPT_LENGTH alongside style + user lines. */
export const MARKETPLACE_CARD_BASE_PROMPT =
  "Create marketplace-ready base image from product references. Preserve product identity, shape, packaging, colors, materials, logos on pack. Dominant product, clean commercial composition. Absolutely no readable text/letters/numbers/typography, watermark, fake UI/logos/icons/badges/callouts/text panels — leave visually plain negative space only; overlay is server-rendered. Prefer modern conversion-focused clarity with spare negative space.";

const MARKETPLACE_STYLE_PROMPTS: Record<MarketplaceCardStyle, string> = {
  clean_marketplace:
    "Clean marketplace grid: white space, soft shadows, retail clarity.",
  premium:
    "Premium card: minimal chrome, matte tones or restrained gold accents (no new logos), vignette.",
  bright_advertising:
    "Bright retail ad: bold accents, strong contrast hierarchy, energetic but tidy.",
  minimalist:
    "Minimal Swiss-like grid: air, single accent color, strict alignment.",
  infographic:
    "Structured infographic-friendly layout: columns and quiet zones for pictograms — still no readable text.",
};

const LEGACY_MARKETPLACE_STYLE: Record<string, MarketplaceCardStyle> = {
  bright_ads: "bright_advertising",
  minimal: "minimalist",
};

function normalizeMarketplaceStyle(style: string): MarketplaceCardStyle {
  const s = style.trim() as MarketplaceCardStyle;
  if (s in MARKETPLACE_STYLE_PROMPTS) return s;
  const m = LEGACY_MARKETPLACE_STYLE[style.trim()];
  if (m) return m;
  return "clean_marketplace";
}

export type BuildMarketplaceCardPromptInput = {
  style: string;
  userInstructions?: string;
  productTitle?: string;
  benefits?: string;
  extraText?: string;
  overlayTemplate?: string;
  cardAspectRatio?: string;
};

export function buildMarketplaceCardPrompt(
  input: BuildMarketplaceCardPromptInput,
): string;
export function buildMarketplaceCardPrompt(
  style: string,
  userInstructions: string,
  productTitle: string,
  benefits: string,
): string;
export function buildMarketplaceCardPrompt(
  a: string | BuildMarketplaceCardPromptInput,
  b?: string,
  c?: string,
  d?: string,
): string {
  if (typeof a === "object" && a !== null) {
    const st = normalizeMarketplaceStyle(a.style);
    const styleLine = MARKETPLACE_STYLE_PROMPTS[st];
    const template = a.overlayTemplate?.trim() || "bottom_panel";
    const ratioLine = a.cardAspectRatio?.trim()
      ? `Aspect ${a.cardAspectRatio.trim()}: keep overlay zones plain at this ratio.`
      : "";
    const templateLine =
      template === "left_panel"
        ? "Quiet left column for server text; keep product detail out of it."
        : template === "badges_callouts"
          ? "Quiet zones around product for badges; product centered."
          : "Quiet lower band for title/benefits; product above.";
    const parts = [
      MARKETPLACE_CARD_BASE_PROMPT,
      styleLine,
      ratioLine,
      templateLine,
      a.productTitle?.trim() ? "Reserve a clear title area for server overlay text." : "",
      a.benefits?.trim() ? "Reserve clean benefit/callout zones for server overlay text." : "",
      a.extraText?.trim() ? "Reserve a small secondary text area for server overlay text." : "",
      a.userInstructions?.trim() ? `Additional art direction: ${a.userInstructions.trim()}.` : "",
    ].filter(Boolean);
    return parts.join("\n\n");
  }
  return buildMarketplaceCardPrompt({
    style: a,
    userInstructions: b ?? "",
    productTitle: c ?? "",
    benefits: d ?? "",
  });
}

// --- Product video ---

export const PRODUCT_VIDEO_BASE_PROMPT = [
  "Create a short promotional product video based on the provided product image.",
  "Keep the product identity, shape, packaging, and key details recognizable.",
  "Use professional commercial lighting, clean composition, realistic product motion, and premium advertising style.",
  "The product should remain the main focus throughout the video.",
].join(" ");

const PRODUCT_VIDEO_MOTION: Record<Exclude<ProductVideoMotionStyle, "none">, string> = {
  smooth_zoom:
    "Camera motion: slow, stable push-in (dolly-in) toward the product; no jitter, no extreme acceleration.",
  orbit:
    "Camera motion: smooth orbital arc around the product, subtle parallax, keep reflections believable, avoid motion sickness speed.",
  cinematic_movement:
    "Camera motion: cinematic parallax, gentle roll/pan, shallow depth of field, premium film-like pacing (still product-accurate).",
  subtle_animation:
    "Camera motion: very subtle move — micro dolly, tiny drift, or soft handheld steadiness, emphasis stays on the product, calm pacing.",
  wow_effect:
    "Camera motion: bold but controlled ad-spot energy — stronger contrast moves, quick beats, high-end commercial pacing without hiding the product.",
  premium_promo:
    "Camera motion: premium brand promo — slow elegant moves, soft glow, glossy highlights, restrained dynamics, luxe feel.",
};

const LEGACY_VIDEO_MOTION: Record<string, ProductVideoMotionStyle> = {
  smooth_rotate: "orbit",
  cinematic: "cinematic_movement",
  light_motion: "subtle_animation",
  wow: "wow_effect",
};

function normalizeVideoMotion(motion: string): ProductVideoMotionStyle {
  const s = motion.trim();
  if (s === "none" || s === "") return "none";
  const t = s as ProductVideoMotionStyle;
  if (t in PRODUCT_VIDEO_MOTION) return t;
  const m = LEGACY_VIDEO_MOTION[s];
  if (m) return m;
  return "smooth_zoom";
}

export type BuildProductVideoPromptInput = {
  motionStyle: string;
  userPrompt?: string;
};

export function buildProductVideoPrompt(input: BuildProductVideoPromptInput): string;
export function buildProductVideoPrompt(
  motionStyle: string,
  userPrompt: string,
): string;
export function buildProductVideoPrompt(
  a: string | BuildProductVideoPromptInput,
  b?: string,
): string {
  if (typeof a === "object" && a !== null) {
    const m = normalizeVideoMotion(a.motionStyle);
    const u = (a.userPrompt ?? "").trim();
    if (m === "none") {
      return [PRODUCT_VIDEO_BASE_PROMPT, u ? `User notes: ${u}.` : ""]
        .filter(Boolean)
        .join("\n\n");
    }
    return [
      PRODUCT_VIDEO_BASE_PROMPT,
      PRODUCT_VIDEO_MOTION[m as Exclude<typeof m, "none">],
      u ? `User notes: ${u}.` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  return buildProductVideoPrompt({ motionStyle: a, userPrompt: b });
}
