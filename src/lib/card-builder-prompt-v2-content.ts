/** Контент промптов card_builder v2.2 — category / card type / template. */

export const CARD_BUILDER_V2_CATEGORY_PROMPTS: Record<string, string> = {
  clothing_shoes: `=== CATEGORY ===
Категория: clothing_shoes.
UI: Одежда и обувь.
Visual direction: fashion catalog / premium e-commerce, clean studio light, silhouette, fit, texture, seams, outsole, hardware.
Product presentation: preserve real color, cut, print, stitching, sole, accessories, logo and proportions. Do not change design.
Composition: main_photo = clean studio; details/materials = fabric, seams, outsole, fasteners; lifestyle = fashion scene without clutter; dimensions = only confirmed sizes.
Text rules: short, stylish, only confirmed material, size, season, purpose, cut.
Forbidden: no invented fabric composition, leather/suede/wool, waterproof, orthopedic properties, brand, country, size chart or seasonality.
Missing facts: create strong fashion/e-commerce visual without claims.
Negative: no fake material, no changed cut, no extra accessories, no unrealistic body shape.`,

  beauty_care: `=== CATEGORY ===
Категория: beauty_care.
UI: Косметика и уход.
Visual direction: premium beauty, light clean backgrounds, soft studio light, glass, water, cream textures, glow, subtle gradients.
Product presentation: packaging must be readable; preserve bottle/jar/tube shape, label, color, logo, proportions.
Composition: main = hero packshot; benefits = confirmed benefits only; ingredients = confirmed only; lifestyle = bathroom/care/freshness without medical framing.
Text rules: only confirmed product type, purpose, volume, fragrance, effect, audience, usage. Non-medical tone.
Forbidden: no "лечит", "устраняет", "дерматологически доказано", "гипоаллергенно", "безопасно для всех", "100% результат" unless confirmed.
Missing facts: premium visual without promises; neutral phrases only.
Negative: no medical claims, fake ingredients, fake certificates, before/after treatment, invented dermatology proof.`,

  home_interior: `=== CATEGORY ===
Категория: home_interior.
UI: Дом и интерьер.
Visual direction: cozy premium interior, calm colors, natural-feeling materials, soft light, minimalism, clean space.
Product presentation: product is the main object; preserve shape, color, design, scale impression; do not add bundle items.
Composition: main = clean e-commerce; lifestyle = kitchen/living/bedroom/bathroom/desk based on product; details = visible texture only; dimensions = confirmed only.
Text rules: confirmed material, purpose, size, set, color, style, place of use.
Forbidden: no invented material, dimensions, set contents, water resistance, durability, warranty, country.
Missing facts: beautiful interior scene without claims.
Negative: no extra bundle, no fake material, no invented dimensions, no unrealistic scale, no clutter.`,

  kids_products: `=== CATEGORY ===
Категория: kids_products.
UI: Детские товары.
Visual direction: friendly, bright, soft, safe-looking visual, clean composition, gentle colors, family atmosphere.
Product presentation: preserve shape, color, packaging, characters, details and proportions.
Composition: main = clean bright packshot; benefits = confirmed only; lifestyle = child room/play/learning/care without unsafe scenes; dimensions/age = confirmed only.
Text rules: caring, simple, calm. Use confirmed age, material, size, set, purpose.
Forbidden: no "безопасно", "сертифицировано", "гипоаллергенно", "0+", "для новорождённых", "экологично", "развивает интеллект" unless confirmed.
Missing facts: friendly visual without safety/age/certification claims.
Negative: no fake safety certificates, invented age range, unsafe usage, aggressive ads, exaggerated development claims.`,

  sport_fitness: `=== CATEGORY ===
Категория: sport_fitness.
UI: Спорт и фитнес.
Visual direction: energetic sport commercial, dynamic light, contrast, motion, athletic style.
Product presentation: product remains readable and accurate; preserve shape, color, logo, construction, materials, proportions.
Composition: main = clean hero; lifestyle = gym/running/outdoor; benefits = confirmed characteristics; details = grip, handles, fasteners, surface if visible/confirmed.
Text rules: short energetic phrases using confirmed benefits/specs.
Forbidden: no medical effect, weight-loss guarantees, pain treatment, professional certification, max load unless confirmed.
Missing facts: dynamic sport visual without specific claims.
Negative: no medical fitness claims, guaranteed weight loss, invented max load, fake certification, unsafe usage.`,

  auto_products: `=== CATEGORY ===
Категория: auto_products.
UI: Автотовары.
Visual direction: tech automotive, dark graphite/metal backgrounds, blue/red accents, premium garage/road/detail environment.
Product presentation: technically accurate; preserve connectors, mounts, packaging, labels, markings, logo, shape.
Composition: main = technical packshot; benefits = confirmed specs; compatibility = exact models/standards only; lifestyle = auto scene without invented compatibility.
Text rules: precise, technical, minimal.
Forbidden: no vehicle compatibility, warranty, power, standard, material, "original", certification unless confirmed.
Missing facts: premium auto visual without compatibility/spec claims.
Negative: no invented compatibility, fake warranty/specs/certification, altered connectors.`,

  jewelry_accessories: `=== CATEGORY ===
Категория: jewelry_accessories.
UI: Украшения и аксессуары.
Visual direction: luxury product photography, soft reflections, deep shadows, velvet/marble/glass/silk, elegant minimal typography.
Product presentation: premium but realistic; preserve shape, color, stones, fasteners, strap, texture, logo.
Composition: main = luxury hero; details/materials = close-ups of texture/stones/fasteners only if confirmed/visible; lifestyle = elegant scene without overload.
Text rules: minimal premium text; confirmed materials/specs only.
Forbidden: no gold, silver, diamond, genuine leather, handmade, premium brand unless confirmed.
Missing facts: luxury visual without material claims.
Negative: no fake precious materials, altered gemstone count, unrealistic shine, counterfeit brand look.`,

  food_drinks: `=== CATEGORY ===
Категория: food_drinks.
UI: Еда и напитки.
Visual direction: appetizing commercial food photo, warm tones, close-ups, freshness, natural light, clean packaging.
Product presentation: preserve packaging, brand, label, color, volume, product appearance. Do not add ingredients not visible/confirmed.
Composition: main = packshot; lifestyle = serving/kitchen/drink with confirmed ingredients only; benefits = taste/volume/format/composition/usage only if confirmed.
Text rules: appetizing but honest. No health claims without facts.
Forbidden: no "полезно", "лечит", "диетический", "без сахара", "органик", "натуральный", "для похудения", "витаминный эффект" unless confirmed.
Missing facts: appetizing visual without health/composition claims.
Negative: no health claims, fake organic/sugar-free, invented ingredients, diet/medical claims.`,

  gadgets_tech: `=== CATEGORY ===
Категория: gadgets_tech.
UI: Гаджеты и техника.
Visual direction: modern tech aesthetic, clean contrast, gradients, high-tech background, glow, reflections, sharp details.
Product presentation: technically accurate; preserve shape, screen, buttons, ports, camera, color, logo, interface, set contents.
Composition: main = clean hero; benefits = confirmed functions; details = ports/screen/buttons/camera; compatibility = confirmed only; lifestyle = desk/home/travel/gaming without invented functions.
Text rules: short technical phrases using confirmed model, memory, power, battery, compatibility, warranty.
Forbidden: no invented memory, power, battery, waterproof, warranty, compatibility, speed, Bluetooth/Wi-Fi version.
Missing facts: clean tech visual without specs.
Negative: no invented specs, fake UI claims, fake compatibility/battery/warranty, altered ports/buttons.`,

  other: `=== CATEGORY ===
Категория: other.
UI: Прочее.
Visual direction: universal premium e-commerce, clean background, realistic light, clear structure, product focus.
Product presentation: preserve product appearance, color, shape, material appearance, packaging, logo, proportions.
Composition: main = clean hero; benefits = confirmed only; details = real details; lifestyle = neutral context if clear; dimensions/materials = facts only.
Text rules: simple e-commerce text without unsupported claims.
Forbidden: no invented material, dimensions, bundle, purpose, warranty, certificates, medical or safety claims.
Missing facts: beautiful universal card without characteristics.
Negative: no invented facts, fake badges, extra bundle items, changed identity, unsupported claims.`,
};

export const CARD_BUILDER_V2_CARD_TYPE_PROMPTS: Record<string, string> = {
  main_photo: `=== CARD_TYPE ===
Тип карточки: main_photo.
UI: Главная карточка.
Purpose: First slide that builds trust and recognition; clean, premium hero shot.
Layout: product is main object, clean background, no overload, small category-appropriate decor allowed.
Text density: 0-2 short blocks: title, purpose, confirmed size/volume.
Fact usage: productTitle, brand, product_purpose, visible/confirmed size, one main confirmed fact.
Forbidden: no infographic, 3-5 benefits, icons, callouts, tables, comparisons, invented effects/certificates.
Missing facts: hero packshot without claims.
Negative: no benefits grid, fake badges, clutter, extra products, changed packaging.`,

  benefits_infographic: `=== CARD_TYPE ===
Тип карточки: benefits_infographic.
UI: Инфографика.
Purpose: show key confirmed benefits in readable visual structure.
Layout: product visible; 2-4 callouts/icons around product if facts allow.
Text density: medium/high but structured; headline + short explanation per block.
Fact usage: benefit, feature, confirmed effect, product_purpose only as context, usage if confirmed benefit.
Forbidden: no dimension/material/package as benefit unless formulated as benefit; no unsupported medical/health/safety claims.
Missing facts: block/warn; ask user to add benefits or select main/lifestyle/details.
Negative: no invented benefits, fake icons, medical promises, fake certificates, unreadable microtext.`,

  benefits_card: `=== CARD_TYPE ===
Тип карточки: benefits_card.
UI: Карточка преимуществ.
Purpose: focus on 1-3 strongest benefits without heavy infographic.
Layout: large product + 1-3 clean benefit blocks, softer than infographic.
Text density: medium; one headline + 1-3 short benefits.
Fact usage: benefit, feature, effect, confirmed usage.
Forbidden: no invented benefits, unsupported claims, overloaded blocks.
Missing facts: use product purpose or request benefits.
Negative: no fake list, unsupported claims, cluttered infographic, fake badges.`,

  comparison_card: `=== CARD_TYPE ===
Тип карточки: comparison_card.
UI: Сравнение.
Purpose: compare product with alternative/old version only using confirmed data.
Layout: two columns or clean table; competitor generic unless user provided exact competitor.
Text density: medium; 2-5 short rows.
Fact usage: confirmed feature, benefit, material, dimension, compatibility, package, usage.
Forbidden: no fake competitor, "№1", "best", "better", invented alternative parameters.
Missing facts: block/warn and suggest another type.
Negative: no fake comparison table, misleading superiority, fake ratings.`,

  dimensions_card: `=== CARD_TYPE ===
Тип карточки: dimensions_card.
UI: Размеры / габариты.
Purpose: show size, volume, weight, scale or size chart.
Layout: technical clean diagram, measurement lines/arrows, full product visible.
Text density: low/medium; exact numbers and units only.
Fact usage: dimension, size, volume, weight, capacity, confirmed size chart.
Forbidden: no invented numbers, no visual guessing, no fake size chart, no fake compatibility by size.
Missing facts: no numeric dimensions; soft scale visual without numbers or ask user for dimensions.
Negative: no fake measurements, wrong units, arbitrary dimensions, misleading scale.`,

  package_contents: `=== CARD_TYPE ===
Тип карточки: package_contents.
UI: Комплектация.
Purpose: show what is included in package/set.
Layout: flat lay or numbered/checklist layout; every item confirmed.
Text density: medium; 2-6 items only if facts exist.
Fact usage: package, set_contents, complectation, visible included items, user-confirmed bundle.
Forbidden: no cables, accessories, gifts, spare parts, box contents if not confirmed.
Missing facts: block/warn; ask user to fill set contents.
Negative: no extra bundle items, fake accessories, invented gifts, misleading kit.`,

  usage_instruction: `=== CARD_TYPE ===
Тип карточки: usage_instruction.
UI: Инструкция / как использовать.
Purpose: show safe usage steps or care sequence.
Layout: 2-4 steps with icons/mini-scenes; product visible or contextually connected.
Text density: medium; short confirmed steps only.
Fact usage: usage, care, instruction, product_purpose, confirmed method.
Forbidden: no invented usage, dosage, dangerous installation, medical/safety instructions without facts.
Missing facts: block/warn; ask user to add usage method.
Negative: no invented steps, unsafe instructions, unsupported care.`,

  premium_poster: `=== CARD_TYPE ===
Тип карточки: premium_poster.
UI: Premium-баннер.
Purpose: premium advertising poster with strong visual impact and minimal text.
Layout: dramatic light, clean composition, air, elegant typography, product focus.
Text density: minimal; one headline + one subtitle.
Fact usage: productTitle, brand, product_purpose, one confirmed phrase.
Forbidden: no infographic, many callouts, fake awards, "№1", best seller, limited edition.
Missing facts: premium visual with title or neutral slogan.
Negative: no clutter, fake awards/premium badges, unsupported best claims.`,

  lifestyle_card: `=== CARD_TYPE ===
Тип карточки: lifestyle_card.
UI: Lifestyle-карточка.
Purpose: show natural use context and mood.
Layout: category-appropriate scene; product remains clear; no infographic grid.
Text density: 0-2 short phrases.
Fact usage: product_purpose, usage, category context, one short confirmed benefit if appropriate.
Forbidden: no 3-5 benefits, callout grid, unsafe/unconfirmed usage, misleading context.
Missing facts: neutral lifestyle scene by category, minimal/no text.
Negative: no infographic, badges, unsafe usage, invented claims, clutter.`,

  detail_closeup: `=== CARD_TYPE ===
Тип карточки: detail_closeup.
UI: Детали товара.
Purpose: show important visual details: texture, form, parts, packaging, buttons, seams, ports, lid, label.
Layout: close-up or split: whole product + 1-3 zoom details.
Text density: low/medium; labels only for real details.
Fact usage: detail, feature, confirmed material, visible facts, construction.
Forbidden: no labels for invisible details, invented material/technology/composition, changed product parts.
Missing facts: use visible details with neutral labels.
Negative: no fake details, fake material callouts, altered parts, misleading zoom.`,

  material_texture: `=== CARD_TYPE ===
Тип карточки: material_texture.
UI: Материал / фактура.
Purpose: show material, surface, texture or finish only if confirmed.
Layout: close-up texture/macro, tactile premium look.
Text density: low; 1-3 short labels.
Fact usage: material, texture, surface, finish, confirmed construction facts.
Forbidden: no "leather/gold/silver/cotton/wood/metal" unless confirmed; no fake composition.
Missing facts: show visual texture without naming material.
Negative: no invented material, fake leather/metal/gold, fake texture labels.`,

  specs_card: `=== CARD_TYPE ===
Тип карточки: specs_card.
UI: Характеристики.
Purpose: show technical or product specs in clean table/list.
Layout: structured table/list, 3-6 rows max, product visible.
Text density: medium/high but strictly structured.
Fact usage: feature, dimension, material, compatibility, package, confirmed technical values.
Forbidden: no invented specs, empty rows, memory/power/battery/weight/warranty/compatibility without facts.
Missing facts: if fewer than 2-3 specs, block/warn and ask user for characteristics.
Negative: no fake rows, fake compatibility, fake warranty, arbitrary numbers.`,

  before_after: `=== CARD_TYPE ===
Тип карточки: before_after.
UI: До / после.
Purpose: show before/after only if safe and confirmed.
Layout: two panels, clear labels, realistic result.
Text density: low.
Fact usage: confirmed effect, user-provided before/after, visible evidence.
Forbidden: no medical/beauty/food health before-after without confirmation, no unrealistic result, no guarantee.
Missing facts: block/warn.
Negative: no fake transformation, medical before/after, exaggerated effect.`,

  social_proof: `=== CARD_TYPE ===
Тип карточки: social_proof.
UI: Отзывы / доверие.
Purpose: show review/rating/trust only if real data provided by user.
Layout: testimonial card, rating block, quote; product visible.
Text density: medium; one review or 2-3 trust points.
Fact usage: user review, confirmed rating, confirmed order/review count, confirmed social proof.
Forbidden: no invented reviews, stars, sales numbers, best seller, "choice of buyers", "№1".
Missing facts: block/warn.
Negative: no fake reviews, fake stars, fake sales, invented quotes.`,

  offer_card: `=== CARD_TYPE ===
Тип карточки: offer_card.
UI: Акция / предложение.
Purpose: show special offer, discount, bonus or promo only if user provided data.
Layout: commercial banner, product large, offer readable.
Text density: medium; one offer + one CTA/detail.
Fact usage: user discount, promo, bundle, bonus, deadline, price.
Forbidden: no invented discount, price, promo code, deadline, free delivery.
Missing facts: block/warn.
Negative: no fake discount, fake price, fake code, fake free delivery, invented deadline.`,
};

const T = (body: string) => `=== TEMPLATE ===\n${body}`;

export const CARD_BUILDER_V2_TEMPLATE_CANONICAL: Record<string, string> = {
  main_photo: T(
    "Template: main_photo / hero.\nClean product hero. Product is the visual center. 0-2 text blocks. Use title, brand, product_purpose and confirmed size only. No benefit grid, no fake badges, no invented claims.",
  ),
  benefits_infographic: T(
    "Template: benefits_infographic.\nConfirmed benefits infographic. Product visible; 3-5 callouts only if benefit/feature facts exist. Product_purpose is context, not a fake benefit. Block/warn if no benefits.",
  ),
  feature_callouts: T(
    "Template: feature_callouts.\n2-4 callouts pointing to real visible features/details. No arrows to non-existing parts. Use feature/detail/material only if confirmed.",
  ),
  detail_closeup: T(
    "Template: detail_closeup.\nWhole product + 1-3 close-up fragments. Labels only real visible details. No fake ports, seams, ingredients or construction.",
  ),
  materials_texture: T(
    "Template: materials_texture.\nTexture/material macro only if material/ingredient/texture confirmed. If unknown, show texture visually without naming material.",
  ),
  dimensions_size: T(
    "Template: dimensions_size.\nDimensions diagram. Numbers/units only from dimension facts. If missing, no numeric measurements; use soft scale visual or ask user for dimensions.",
  ),
  scale_comparison: T(
    "Template: scale_comparison.\nVisual scale with neutral object. No exact numbers without facts. Scale object must not look like part of set.",
  ),
  packaging_set: T(
    "Template: packaging_set / set_contents.\nShow confirmed package/set contents. Every item must be real. No extra cables, gifts, boxes, instructions or accessories unless confirmed.",
  ),
  instruction_steps: T(
    "Template: instruction_steps.\n2-4 confirmed usage/care steps. No dosage, medical use, dangerous installation or invented process.",
  ),
  comparison_card: T(
    "Template: comparison_card.\nNeutral comparison table/columns using confirmed comparison facts only. No competitor claims, fake superiority, fake metrics.",
  ),
  lifestyle_scene: T(
    "Template: lifestyle_scene.\nNatural use context with minimal text. No infographic grid, no many badges, no invented context or unsafe use.",
  ),
  premium_poster: T(
    "Template: premium_poster.\nPremium advertising hero with title/brand/product_purpose and one confirmed phrase. No fake awards, no best seller, no excessive text.",
  ),
  universal: T(
    "Template: universal / fallback.\nSafe clean e-commerce card. Product centered, minimal text, confirmed facts only, no invented claims.",
  ),
};

/** Per-template overrides для существующих templateId проекта. */
export const CARD_BUILDER_V2_TEMPLATE_OVERRIDES: Record<string, string> = {
  hero_clean: T(
    "Template: hero_clean (main_photo).\nClean product hero. Product is the visual center. 0-2 text blocks. No benefit grid, no fake badges.",
  ),
  product_packshot: T(
    "Template: product_packshot.\nPackshot on neutral background; preserve product identity 1:1.",
  ),
  fashion_catalog: T(
    "Template: fashion_catalog.\nFashion/catalog presentation without heavy infographic; product remains hero.",
  ),
  beauty_packshot: T(
    "Template: beauty_packshot.\nPremium beauty packshot; soft light; no medical claims.",
  ),
  benefits_grid: T(
    "Template: benefits_grid.\nConfirmed benefits infographic grid; callouts only from benefit/feature facts.",
  ),
  benefits_left_column: T(
    "Template: benefits_left_column.\nBenefits column; text only from locked phrases; no invented benefits.",
  ),
  texture_closeup: T(
    "Template: texture_closeup.\nClose-up texture/detail; labels only for visible real details.",
  ),
  material_focus: T(
    "Template: material_focus.\nMaterial/texture focus; name material only if confirmed.",
  ),
  fabric_closeup: T(
    "Template: fabric_closeup.\nFabric/seams close-up; do not invent composition.",
  ),
  interface_detail: T(
    "Template: interface_detail.\nScreen/button/port detail; do not invent functions.",
  ),
  dimensions_schema: T(
    "Template: dimensions_schema.\nDimension diagram; numbers only from confirmed dimension facts.",
  ),
  size_range: T(
    "Template: size_range.\nSize range only from user-confirmed facts.",
  ),
  lifestyle_card: T(
    "Template: lifestyle_card.\nNatural lifestyle scene; minimal text; no infographic grid.",
  ),
  usage_scenario: T(
    "Template: usage_scenario.\nUsage scenario; product clear; no invented usage claims.",
  ),
  interior_lifestyle: T(
    "Template: interior_lifestyle.\nInterior lifestyle; calm scene without clutter or false claims.",
  ),
  fashion_lifestyle: T(
    "Template: fashion_lifestyle.\nFashion lifestyle; product hero; no fake material claims.",
  ),
  beauty_lifestyle: T(
    "Template: beauty_lifestyle.\nBeauty lifestyle; premium mood; no medical framing.",
  ),
  food_lifestyle: T(
    "Template: food_lifestyle.\nFood lifestyle; appetizing but honest; no health claims without facts.",
  ),
  package_card: T(
    "Template: package_card.\nShow packaging/set only from confirmed package facts.",
  ),
  gift_packaging: T(
    "Template: gift_packaging.\nGift packaging visual; no invented bundle or promo labels.",
  ),
  set_contents: T(
    "Template: set_contents.\nShow confirmed set contents only; no extra accessories.",
  ),
  editorial_poster: T(
    "Template: editorial_poster.\nEditorial premium poster; minimal text; no fake awards.",
  ),
  ad_banner: T(
    "Template: ad_banner.\nCommercial banner; offer/discount only if provided in facts; no fake promo.",
  ),
  brand_hero: T(
    "Template: brand_hero.\nBrand hero shot; preserve product identity; no foreign logos.",
  ),
  protection_features: T(
    "Template: protection_features.\nFeature callouts for confirmed protection/features only.",
  ),
  ingredients_effect: T(
    "Template: ingredients_effect.\nIngredients/effects only if confirmed; no medical claims.",
  ),
  dark_premium: T(
    "Template: dark_premium.\nDark premium poster; minimal text; no fake premium badges.",
  ),
  dark_premium_benefits: T(
    "Template: dark_premium_benefits.\nDark premium benefits; only confirmed benefit/feature facts.",
  ),
  realistic_listing: T(
    "Template: realistic_listing.\nRealistic listing photo; clean; no invented specs.",
  ),
  instruction_steps: T(
    "Template: instruction_steps.\n2-4 confirmed usage/care steps. No dosage, medical use, dangerous installation or invented process.",
  ),
  specs_card: T(
    "Template: specs_card.\nStructured specs table/list; 3-6 rows max; only confirmed feature/dimension/material/compatibility facts.",
  ),
  social_proof_card: T(
    "Template: social_proof_card.\nTestimonial or rating only from user-provided review facts; no fake stars or sales counts.",
  ),
  before_after_card: T(
    "Template: before_after_card.\nBefore/after panels only with confirmed before_after facts; no exaggerated medical/beauty claims.",
  ),
};

export function buildCardBuilderV2TemplatePrompts(): Record<string, string> {
  return {
    ...CARD_BUILDER_V2_TEMPLATE_CANONICAL,
    ...CARD_BUILDER_V2_TEMPLATE_OVERRIDES,
  };
}

export function buildCardBuilderV2CardTypePromptsWithLegacy(): Record<string, string> {
  const legacyKeys: Record<string, string> = {
    benefits: CARD_BUILDER_V2_CARD_TYPE_PROMPTS.benefits_infographic,
    infographic: CARD_BUILDER_V2_CARD_TYPE_PROMPTS.benefits_infographic,
    comparison: CARD_BUILDER_V2_CARD_TYPE_PROMPTS.comparison_card,
    dimensions: CARD_BUILDER_V2_CARD_TYPE_PROMPTS.dimensions_card,
    package: CARD_BUILDER_V2_CARD_TYPE_PROMPTS.package_contents,
    instruction: CARD_BUILDER_V2_CARD_TYPE_PROMPTS.usage_instruction,
    premium_banner: CARD_BUILDER_V2_CARD_TYPE_PROMPTS.premium_poster,
    lifestyle: CARD_BUILDER_V2_CARD_TYPE_PROMPTS.lifestyle_card,
    details: CARD_BUILDER_V2_CARD_TYPE_PROMPTS.detail_closeup,
    materials: CARD_BUILDER_V2_CARD_TYPE_PROMPTS.material_texture,
  };
  return { ...CARD_BUILDER_V2_CARD_TYPE_PROMPTS, ...legacyKeys };
}
