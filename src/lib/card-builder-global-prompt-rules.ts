/** Глобальные rule-блоки card_builder v2.2 — вставляются один раз в super prompt. */

export const GLOBAL_PRODUCT_TRUTH_RULES = `=== GLOBAL PRODUCT TRUTH RULES ===
1. Product identity is sacred. Preserve the real product shape, packaging, logo, label, visible text, color, proportions, material appearance and key design. Do not redesign the product.
2. The generated card must advertise the uploaded product, not a similar imagined product.
3. Use only confirmed product facts. Never invent specifications, dimensions, materials, ingredients, compatibility, bundle items, certifications, warranty, awards, discounts, ratings, reviews, medical, safety or health claims.
4. If facts are missing, keep the card visually strong but text-neutral. Prefer no claim over a false claim.
5. If exactTextPhrases are provided, use them exactly. Do not rewrite brand names, product names, volumes, sizes or confirmed phrases.
6. Do not add fake marketplace badges, QR codes, barcodes, certificates, "official", "best seller", "doctor recommended", "eco", "organic", "safe", "premium quality" labels unless explicitly provided.`;

export const GLOBAL_FACT_SOURCE_RULES = `=== GLOBAL FACT SOURCE RULES ===
Allowed for generation:
- source=user
- source=vision_ai with high/medium confidence and safe claim type
- source=category_field
- source=web_suggested only if verifiedByUser=true and needsReview=false

Blocked for generation:
- web_suggested with needsReview=true
- low-confidence risky claims
- unconfirmed medical, safety, health, certification, compatibility, ingredient, material, size, warranty, discount or review claims

When uncertain:
- keep the visual concept
- remove specific claim text
- prefer neutral visuals over unsupported claims`;

export const GLOBAL_TEMPLATE_RULES = `=== GLOBAL TEMPLATE RULES ===
1. Template role is mandatory. Do not mix roles. A lifestyle slide must not become infographic. A main photo slide must not become benefits grid. A dimensions slide must not invent dimensions.
2. Use only facts allowed for this template:
   main_photo: title, brand, product_purpose, short neutral subtitle.
   benefits: benefit, feature, confirmed effect.
   details: detail, feature, visible construction.
   materials: material, texture, ingredient only if confirmed.
   dimensions: dimension/size/volume/weight/capacity only.
   packaging: package, set_contents, complectation only.
   instruction: usage, care, confirmed steps only.
   comparison: confirmed comparison facts only.
   lifestyle: product_purpose, usage context, neutral emotional phrase.
   premium_poster: title, brand, product_purpose, one short confirmed phrase.
3. Respect effectiveTextDensity and maxVisibleTextBlocks.
4. Product must remain the main object. Avoid clutter. Keep empty space for readable text.
5. Prefer a beautiful minimal product card with no risky claims rather than a busy card with invented information.`;

export const GLOBAL_CARD_TYPE_RULES = `=== GLOBAL CARD TYPE RULES ===
1. Slide role wins. The selected card type defines purpose, layout and allowed text. Category only adjusts visual style.
2. Use only productFacts relevant to the selected card type. Do not pull unrelated facts just to fill space.
3. No invented benefits, dimensions, materials, ingredients, compatibility, warranty, certification, medical claims, safety claims, bundle items, ratings, discounts or reviews.
4. Text must be short and readable. Use fewer text blocks with high clarity. Do not overload the slide unless the type is explicitly infographic/specs.
5. If required facts are missing, create a visually strong neutral card, or block/warn if the type requires exact facts.
6. No fake UI badges, certificates, guarantees, rating stars, marketplace badges, discount labels or award icons unless provided.`;

export const GLOBAL_CATEGORY_RULES = `=== GLOBAL CATEGORY RULES ===
1. Category defines visual language only. It must not override slideRole or invent facts.
2. Use category aesthetics to select background, light, mood, props and composition style.
3. Do not create claims specific to the category unless supported by productFacts.
4. Risky categories require extra caution: beauty_care, food_drinks, kids_products, auto_products, gadgets_tech, jewelry_accessories.
5. If facts are missing, create a category-appropriate visual card without specific claims.
6. Better neutral than false.`;

export const CARD_BUILDER_GLOBAL_PROMPT_RULES_BLOCKS = [
  GLOBAL_PRODUCT_TRUTH_RULES,
  GLOBAL_FACT_SOURCE_RULES,
  GLOBAL_TEMPLATE_RULES,
  GLOBAL_CARD_TYPE_RULES,
  GLOBAL_CATEGORY_RULES,
] as const;

export function buildCardBuilderGlobalRulesSection(): string {
  return CARD_BUILDER_GLOBAL_PROMPT_RULES_BLOCKS.join("\n\n");
}
