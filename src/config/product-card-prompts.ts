import "server-only";

import { resolveManualConceptCategoryId } from "@/config/product-card-concept-catalog";
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

const OTHER: ConceptMap = {
  studio_catalog:
    "Mode: clean studio. Versatile e-commerce look, one hero object, no clutter, true-to-image identity.",
  lifestyle:
    "Mode: general lifestyle. Realistic scene that fits the product type; keep the product legible and central.",
  in_use:
    "Mode: in use. Show believable real-world usage, natural interaction or context, sharp product legibility, honest environment lighting.",
};

const UNIVERSAL: ConceptMap = OTHER;

const ELECTRONICS: ConceptMap = {
  studio_catalog:
    "Mode: consumer electronics catalog. Neutral or subtle gradient backdrop, crisp edges, accurate screen/port color, no invented logos or UI text.",
  tech_ads:
    "Mode: electronics ad campaign. Premium tech lighting, controlled reflections on glass/metal, modern color grade, product remains the exact model from reference.",
  in_use:
    "Mode: electronics in use. Believable hands or desk interaction, natural environment light, device stays recognizable and dominant.",
  detail_closeup:
    "Mode: electronics macro. Ports, buttons, bezels, camera modules or key hardware details; sharp, honest, no model swap.",
  desk_setup:
    "Mode: desk / workspace. Laptop, phone, headphones or peripherals in a tidy modern setup; correct scale and cable discipline.",
  hero_poster:
    "Mode: electronics hero poster. Single hero device, dramatic rim/key light, negative space, campaign polish without fake on-screen text.",
};

const HOME_APPLIANCES: ConceptMap = {
  studio_catalog:
    "Mode: appliance catalog. Large or small home appliance on clean background; true proportions, color and branding; treadmill/vacuum/kitchen appliance identity preserved.",
  in_home:
    "Mode: appliance in home. Plausible room context (kitchen, living room, home gym); correct scale; product is the hero, not a different appliance.",
  in_use:
    "Mode: appliance in use. Person using treadmill, blender, vacuum or similar; safe believable pose; product controls and form stay accurate.",
  detail_panel:
    "Mode: control panel / detail. Display, knobs, buttons, filters or functional details; commercial macro clarity.",
  lifestyle_room:
    "Mode: home lifestyle. Warm inviting room around the appliance; cozy but uncluttered; product remains central and unchanged.",
  hero_poster:
    "Mode: appliance hero ad. Strong commercial composition for large home/fitness tech; bold lighting, premium retail feel.",
};

const FOOTWEAR: ConceptMap = {
  on_feet:
    "Mode: footwear on feet. Natural walking or standing pose; accurate shoe shape, sole and upper; no shoe model swap.",
  studio_catalog:
    "Mode: footwear pair catalog. Both shoes visible on neutral background; true color and material; e-commerce clarity.",
  flat_lay:
    "Mode: footwear flat lay. Pair arranged from above; editorial spacing; soft shadows; premium sneaker/boot presentation.",
  lifestyle_street:
    "Mode: street lifestyle. Urban or casual outdoor context; shoes clearly visible; authentic pavement/park vibe.",
  material_closeup:
    "Mode: footwear macro. Leather mesh, stitching, sole tread or logo area; tactile detail without inventing new branding.",
  hero_poster:
    "Mode: footwear hero poster. Dynamic angle, strong contrast, campaign energy; exact shoe from reference.",
};

const HOME_GOODS: ConceptMap = {
  studio_catalog:
    "Mode: home goods catalog. Decor, textiles, kitchenware or storage on neutral background; honest colors and shape.",
  styled_shelf:
    "Mode: styled shelf. Product on shelf, console or sideboard; tasteful props; product remains the anchor item.",
  in_kitchen:
    "Mode: kitchen context. Counter, table or pantry setting suited to cookware, containers or utensils; clean realistic kitchen.",
  lifestyle:
    "Mode: home lifestyle. Everyday domestic scene; warm light; product integrated naturally but still legible.",
  detail_closeup:
    "Mode: home goods macro. Texture, glaze, weave, lid mechanism or material quality; sharp product truth.",
  gift_composition:
    "Mode: gift still life. Presentable arrangement for gifting; ribbon or box accents allowed but no readable text; hero product unchanged.",
};

const KIDS: ConceptMap = {
  studio_catalog:
    "Mode: kids product catalog. Bright clean studio; toy, clothing or gear centered; cheerful but not chaotic.",
  playful_scene:
    "Mode: playful kids scene. Soft colorful environment; safe playful mood; product is clear hero; age-appropriate styling.",
  in_use_child:
    "Mode: child using product. Gentle realistic use scenario; product identity preserved; safe family-friendly look.",
  nursery:
    "Mode: nursery / kids room. Pastel or cozy room context; crib, shelf or play corner; correct product scale.",
  detail_safe:
    "Mode: kids product detail. Materials, seams, rounded edges, buttons; macro clarity; trustworthy quality cues.",
  bright_ad:
    "Mode: kids commercial poster. Bold friendly colors, high clarity, product dominant; no scary or adult themes.",
};

const FURNITURE: ConceptMap = {
  studio_catalog:
    "Mode: furniture catalog. Sofa, chair, table or cabinet on neutral backdrop; correct proportions and materials.",
  in_interior:
    "Mode: furniture in room. Living room, bedroom or dining context; believable perspective and scale.",
  minimal:
    "Mode: minimal interior. Sparse modern room; breathing space; design-magazine calm; furniture is focal.",
  cozy:
    "Mode: cozy interior. Warm lamp light, soft textiles, homely atmosphere; furniture unchanged.",
  material_closeup:
    "Mode: furniture material macro. Wood grain, upholstery weave, metal legs; tactile premium detail.",
  premium_poster:
    "Mode: furniture editorial poster. High-end interior campaign; dramatic but realistic staging.",
};

const AUTO: ConceptMap = {
  studio_catalog:
    "Mode: automotive product catalog. Car accessory or part on clean background; accurate shape and finish.",
  in_garage:
    "Mode: garage / workshop. Tool, organizer or car care product in believable garage context; gritty-clean balance.",
  in_car:
    "Mode: car interior. Seat, dashboard or trunk context for automotive accessories; realistic scale inside vehicle.",
  detail_closeup:
    "Mode: automotive macro. Texture, mount, connector or material; sharp technical product shot.",
  lifestyle_drive:
    "Mode: driving lifestyle. Road trip or parking context hint; product visible and unchanged; no fake license plates with readable text.",
  hero_poster:
    "Mode: automotive hero ad. Strong commercial automotive aesthetic; product as hero; dynamic lighting.",
};

const BY_CATEGORY: Record<string, ConceptMap> = {
  electronics: ELECTRONICS,
  home_appliances: HOME_APPLIANCES,
  apparel: APPAREL,
  footwear: FOOTWEAR,
  beauty_and_care: BEAUTY,
  home_goods: HOME_GOODS,
  kids: KIDS,
  accessories: ACCESSORIES,
  furniture: FURNITURE,
  auto: AUTO,
  universal: UNIVERSAL,
  food_and_drinks: FOOD,
  gadgets_and_tech: ELECTRONICS,
  home_and_furniture: FURNITURE,
  other: UNIVERSAL,
};

const LEGACY_CONCEPT_ALIASES: Record<string, string> = {
  // Ранний id «еда / каталог»
  studio_pack: "studio_catalog",
  // Удалённые концепции «Прочее» → ближайшие актуальные
  closeup: "studio_catalog",
  hero: "studio_catalog",
  ad_poster: "lifestyle",
  clean_studio: "studio_catalog",
};

/** Нормализация legacy concept id для валидации и промптов. */
export function normalizeConceptId(conceptId: string): string {
  return LEGACY_CONCEPT_ALIASES[conceptId] ?? conceptId;
}

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
  return normalizeConceptId(conceptId);
}

/**
 * Скрытая инструкция по концепции (только сценовый «режим»; без BASE).
 */
export function getConceptPrompt(categoryId: string, conceptId: string): string {
  const cat = resolveManualConceptCategoryId(categoryId) as ProductCategoryId;
  const key = resolveConceptId(cat, conceptId);
  const table = BY_CATEGORY[cat] ?? UNIVERSAL;
  const line = table[key] ?? table.studio_catalog ?? UNIVERSAL.studio_catalog!;
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
  /** English line from template preset (composition on canvas + negative space). */
  compositionInstruction?: string;
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
      ? `Aspect ${a.cardAspectRatio.trim()}: keep overlay zones visually plain at this ratio. Leave clean negative space for title, subtitle, benefit tiles, corner callouts and bottom badges — all added later server-side.`
      : "Leave ample clean negative space for title/subtitle bands, infographic benefit rectangles and footer badges — final typography is overlay-rendered, not baked into the bitmap.";
    const templateLine =
      template === "left_panel"
        ? "Quiet vertical column suited to stacked overlay panels; hero product occupies the complementary side."
        : template === "badges_callouts"
          ? "Quiet peripheral corners around the hero suited to small badge overlays; hero stays visually dominant."
          : "Reserve tidy lower/third and side gutters for overlay rows; hero product fills the complementary field.";
    const noTextHard =
      "Absolutely NO readable bitmap text: no words, letters, numbers, captions, typography, watermark, invented logos, fake UI or random shelf labels.";
    const comp = (a.compositionInstruction ?? "").trim();
    const placementLine = comp ? `Template composition: ${comp}` : "";

    const parts = [
      MARKETPLACE_CARD_BASE_PROMPT,
      noTextHard,
      styleLine,
      ratioLine,
      templateLine,
      placementLine,
      a.productTitle?.trim()
        ? "Reserve an empty rectangular title-safe band (still photo/illustration only)."
        : "",
      a.benefits?.trim() ? "Reserve empty zones sized for infographic benefit squares (still no pixels of text)." : "",
      a.extraText?.trim() ? "Reserve a slim empty strip sized for tertiary badges/footer chips." : "",
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

const PRODUCT_VIDEO_MOTION_CARD_MODE: Record<Exclude<ProductVideoMotionStyle, "none">, string> = {
  smooth_zoom:
    "Camera motion: very subtle, almost imperceptible slow push-in; minimal movement, stable framing.",
  orbit:
    "Camera motion: subtle soft parallax only — no orbital camera path, no rotation around the product.",
  cinematic_movement:
    "Camera motion: stable cinematic micro motion — tiny drift, no roll, no pan, composition locked.",
  subtle_animation:
    "Camera motion: very subtle move — micro dolly, tiny drift, or soft handheld steadiness, emphasis stays on the product, calm pacing.",
  wow_effect:
    "Camera motion: restrained premium motion — gentle lighting shimmer only, no fast beats, no aggressive camera moves.",
  premium_promo:
    "Camera motion: soft elegant micro motion — gentle glow shifts, minimal drift, luxe feel without layout change.",
};

export const PRODUCT_VIDEO_CARD_MODE_HINT = [
  "Product card mode:",
  "The input image is a finished marketplace product card. Preserve the existing text, infographics, icons, badges, product layout and composition.",
  "Do not rewrite, replace, translate, remove, or distort any text. Do not change the position, size, color, or style of text blocks.",
  "Do not invent new claims, prices, benefits, specifications, badges or labels. Keep all typography readable and stable.",
  "Use only subtle motion, gentle lighting changes, soft parallax, and minimal camera movement.",
  "The video should feel like the original product card came alive, not like a redesigned card.",
].join(" ");

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

export const PRODUCT_VIDEO_LOOP_HINT =
  "The video must loop seamlessly: motion and composition should return to the opening state so the clip can play on repeat without a visible jump cut.";

export function getSafeVideoMotionPrompt(
  motionStyle: string,
  productCardMode: boolean,
): string | null {
  const m = normalizeVideoMotion(motionStyle);
  if (m === "none") return null;
  if (productCardMode) {
    return PRODUCT_VIDEO_MOTION_CARD_MODE[m as Exclude<typeof m, "none">];
  }
  return PRODUCT_VIDEO_MOTION[m as Exclude<typeof m, "none">];
}

export type BuildProductVideoPromptInput = {
  motionStyle: string;
  userPrompt?: string;
  loopVideo?: boolean;
  productCardMode?: boolean;
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
    const u = (a.userPrompt ?? "").trim();
    const loop = a.loopVideo === true;
    const cardMode = a.productCardMode === true;
    const parts = [PRODUCT_VIDEO_BASE_PROMPT];
    const motionLine = getSafeVideoMotionPrompt(a.motionStyle, cardMode);
    if (motionLine) {
      parts.push(motionLine);
    }
    if (cardMode) {
      parts.push(PRODUCT_VIDEO_CARD_MODE_HINT);
    }
    if (loop) {
      parts.push(PRODUCT_VIDEO_LOOP_HINT);
    }
    if (u) {
      parts.push(`User notes: ${u}.`);
    }
    return parts.filter(Boolean).join("\n\n");
  }
  return buildProductVideoPrompt({ motionStyle: a, userPrompt: b });
}
