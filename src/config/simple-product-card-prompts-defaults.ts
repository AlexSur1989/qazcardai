export const SIMPLE_PRODUCT_CARD_PROMPTS_SETTING_VERSION = "simple_product_card_prompts_v2" as const;

export type SimpleProductCardCreativityBand = {
  min: number;
  max: number;
  instruction: string;
};

export type SimpleProductCardPromptsSetting = {
  version: typeof SIMPLE_PRODUCT_CARD_PROMPTS_SETTING_VERSION | string;
  enabled: boolean;
  globalRules: string;
  promptClassic: string;
  promptClassicWithReference: string;
  promptReference: string;
  promptPremium: string;
  dimensionsPrompt: string;
  negativePrompt: string;
  creativityBands: SimpleProductCardCreativityBand[];
  defaultAspectRatio: string;
  defaultStyleMode: string;
  maxTextBlocks: number;
  maxKeyPhrases: number;
  requireText: boolean;
  preserveProductIdentity: boolean;
  referenceEnabled: boolean;
};

const GLOBAL_RULES = `You are a professional e-commerce product card designer.

Main goal:
Create one ready-to-use product card based on:
- main product image;
- user-provided text;
- selected style mode;
- selected aspect ratio;
- optional style reference image, only when provided and allowed.

Product identity is mandatory:
Use the main product image as the source of truth for:
- product shape;
- product color;
- logo;
- packaging;
- label;
- visible text;
- proportions;
- key design details.

Do not change the product identity.
Do not replace the product with another item.
Do not invent a different package, label, logo, color, material or form.

Text rules:
Use only the user-provided text.
You may structure it into a headline, subtitle and short benefit phrases.
Do not invent product features.
Do not add unsupported claims.
Do not add medical, safety, health, certification, guarantee or "best seller" claims unless they are explicitly provided by the user.
Keep text readable and commercially clean.
Do not overload the card with too much text.
If user text is long, use only the strongest 2–4 phrases.
Keep Russian and Kazakh text intact.
Do not translate, rewrite or distort brand/product names.

Design rules:
Make the card look like a high-quality marketplace/product advertising card.
Keep enough empty space.
Make typography readable.
Do not add watermarks.
Do not add fake marketplace badges, ratings, certificates, discounts or logos.
Do not add extra products or bundle items unless provided by the user.

DIMENSIONS AND MEASUREMENTS RULES

If the user provides confirmed dimensions, size, volume, weight or numeric specs:
- visualize them clearly on the card;
- use elegant measurement lines, arrows, side labels, ruler-style overlays, callout boxes or technical markers;
- place size labels near the relevant side of the product;
- show height vertically, width horizontally, depth with perspective or side arrow if appropriate;
- keep the product readable and central;
- make measurement typography clean and premium;
- use only the exact values provided by the user.

Do not invent dimensions.
Do not estimate size from the image.
Do not add numbers, units or specs that were not provided.
If dimensions are missing, do not create measurement lines with fake values.
If only one dimension is provided, show only that dimension.
If product shape does not allow clear measurement visualization, use a clean specs callout block instead.

Output:
Generate one final product card in the selected aspect ratio.`;

const PROMPT_CLASSIC = `Style mode:
Classic marketplace product card without reference image.

Design direction:
Create a clean, clear and marketplace-friendly product card.
Use a simple professional background, soft light, readable typography and a balanced product composition.

Composition:
- product is the main object;
- clean background;
- no visual clutter;
- 1 headline + up to 2–4 short key phrases if suitable;
- use simple shapes/panels only if they improve readability.

Do not:
- overdesign;
- create luxury poster style;
- add too many decorations;
- add unsupported claims.

If user provides dimensions/specs:
Create a clean marketplace infographic layout with elegant measurement lines around the product.
Use thin arrows and labels to show width, height, depth, volume or weight where applicable.
Place measurements near the relevant side of the product:
- height label on the vertical side;
- width label below or above the product;
- depth label with a diagonal or side arrow;
- volume/weight in a small specs badge.
Keep the layout clean, readable and marketplace-friendly.

Visual style for measurements:
- white or light neutral background;
- thin gray/black measurement lines;
- clean typography;
- simple rounded callout boxes;
- no clutter.

Forbidden for measurements:
Do not invent any dimension or numeric value.
Do not show ruler lines if no dimensions are provided.
Do not make the card look like a technical manual unless the product requires it.

Best result:
A clear product card that looks reliable, understandable and suitable for marketplace listing or product gallery.`;

const PROMPT_CLASSIC_WITH_REFERENCE = `Style mode:
Classic marketplace product card with optional style reference.

Inputs:
Image A = main product image.
Image B = optional style reference image.

Use Image A as the product identity source.
Use Image B only as a soft visual reference for:
- background style;
- color mood;
- composition direction;
- typography mood;
- decorative elements.

Important:
This is still a classic marketplace product card.
Do not overcopy the reference.
Do not create a premium poster unless the reference naturally suggests it and it remains marketplace-friendly.
Keep the product clear, readable and commercial.

Creativity instruction:
{{creativity_instruction}}

Do not copy from reference:
- чужие бренды;
- logos;
- watermarks;
- exact text;
- marketplace badges;
- certificates;
- ratings;
- discounts.

If reference image is provided and user also provides dimensions/specs:
Use the reference for style, background and composition mood, but integrate the confirmed dimensions in a clean way.
Do not copy fake measurements from the reference.
Only use measurements from userText.
Adapt measurement lines and labels to match the reference style, while keeping them readable.

If the reference style conflicts with readability:
Prioritize clean product card readability over exact reference copying.

Best result:
A clean marketplace-friendly product card that borrows visual inspiration from the reference but keeps the product and text clear.`;

const PROMPT_REFERENCE = `Style mode:
Reference-based product card.

Inputs:
Image A = main product image.
Image B = style reference image.

Use Image A as the product identity source.
Use Image B as the main visual reference for:
- background;
- composition;
- color palette;
- mood;
- lighting;
- decorative elements;
- general design logic.

Important:
The reference image must not replace the product.
Do not copy чужие бренды, logos, watermarks, exact text or marketplace badges from the reference.
Borrow only visual style and composition principles.

Creativity instruction:
{{creativity_instruction}}

Composition:
- preserve the product from Image A;
- adapt the reference style to the actual product;
- keep the design clean and readable;
- use the user text as the only text source;
- optimize final card for selected aspect ratio.

If the reference is too cluttered:
Simplify it. Prioritize product readability and clean commercial design.

If user provides confirmed dimensions/specs:
Integrate them into the reference-inspired design as premium callouts, measurement arrows, side labels or spec panels.
Borrow the reference's visual mood, but do not copy any unconfirmed numbers or claims from the reference image.
Use only user-provided dimensions/specs.

For dimension visualization:
- height should appear along the vertical side of the product;
- width should appear along the bottom/top side;
- depth should appear as a side/diagonal indicator if visually appropriate;
- volume/weight can appear in a small clean spec badge;
- keep labels large enough to read.

Do not:
- invent measurements;
- copy reference text;
- copy reference brand/logos;
- overload the design.`;

const PROMPT_PREMIUM = `Style mode:
Premium product card.

Important:
Premium style does not use a reference image.
Create the premium design from the main product image and user text only.

Design direction:
Create a premium, high-end commercial product card.
Use elegant lighting, clean composition, tasteful background, soft shadows, subtle gradients, reflections or premium materials where appropriate.

Composition:
- product is the hero;
- strong visual focus;
- elegant typography;
- minimal but powerful text;
- premium spacing;
- no clutter;
- no fake awards or luxury claims.

Visual mood:
Modern, expensive, clean, stylish, рекламный, suitable for premium e-commerce.

Text:
Use 1 strong headline and up to 2–3 short phrases from the user text.
If the user text is simple, make the design premium without inventing new claims.

Do not:
- use reference image;
- invent premium materials;
- write "luxury", "premium quality", "best", "№1", "original", "certified" unless user provided it;
- add fake badges;
- change product identity.

If user provides dimensions/specs:
Show them in a premium, elegant way.
Use refined technical callouts, subtle measurement lines, thin arrows, glass-like panels, luxury typography or minimalist spec badges.
The result should feel premium, not like a dry technical drawing.

Premium measurement design:
- thin elegant lines;
- soft shadows;
- subtle metallic or glass panels if appropriate;
- high-end typography;
- balanced spacing;
- product remains hero object.

Examples:
- vertical height line on the side of the product;
- horizontal width line under the product;
- small premium badge for volume/weight;
- elegant "key specs" block with 2–4 values.

Forbidden for measurements:
Do not make up missing dimensions.
Do not create fake technical specs.
Do not make the card overcrowded.
Do not turn premium design into a boring engineering drawing.

Best result:
A premium advertising-style product card with strong visual appeal and clean readable text.`;

const NEGATIVE_PROMPT = `Do not change product identity.
Do not alter logo, label, packaging, shape, color, proportions or visible product text.
Do not invent product features, materials, dimensions, ingredients, compatibility, warranty, certificates, safety claims, medical claims, health claims, ratings, discounts or marketplace badges.
Do not add extra accessories or bundle items unless user provided them.
Do not copy reference image text, brands, logos or watermarks.
Do not create unreadable tiny text.
Do not overload the design.
Do not translate or distort Russian/Kazakh text.
Do not create fake before/after results.
Do not add dangerous or misleading usage claims.

Do not invent measurements.
Do not invent size, height, width, depth, volume, capacity, weight or numeric specs.
Do not estimate dimensions from the image.
Do not create measurement arrows with fake values.
Do not copy measurements from the reference image unless they were provided by the user.
Do not add technical specs that are not in user text or verified facts.
Do not add unreadable tiny measurement labels.
Do not place dimension lines in a way that hides the product.`;

const DIMENSIONS_PROMPT = `DIMENSIONS VISUALIZATION PROMPT

When confirmed dimensions, size, volume, weight or numeric specs are provided, turn them into a beautiful visual layer on the product card.

Use:
- measurement arrows;
- side dimension lines;
- ruler-style overlays;
- clean spec badges;
- technical callout panels;
- height/width/depth labels;
- minimal infographic elements.

Placement:
- height: vertical line beside the product;
- width: horizontal line above or below the product;
- depth: diagonal or side perspective line;
- volume/weight: small spec badge or clean text panel;
- other specs: grouped in a concise "key specs" block.

Style:
The measurement design must match the selected style mode:
- classic: clean marketplace technical clarity;
- reference: match the reference mood but stay readable;
- premium: elegant, subtle, high-end callouts.

Rules:
Use only confirmed values from userText or verified productFacts.
Never invent numbers.
Never estimate dimensions from the image.
Never copy numbers from reference image.
If no dimensions are provided, do not show measurement lines.
If only partial dimensions are provided, show only provided values.
Keep text readable and not too small.`;

const CREATIVITY_BANDS: SimpleProductCardCreativityBand[] = [
  {
    min: 0,
    max: 20,
    instruction:
      "Follow the reference very closely. Keep a similar composition, background logic, color mood and layout structure, but preserve the product from the main product image.",
  },
  {
    min: 21,
    max: 40,
    instruction:
      "Follow the reference closely, with minor adaptation for the product. Keep the overall style and composition recognizable.",
  },
  {
    min: 41,
    max: 60,
    instruction:
      "Use the reference as a strong base, with balanced adaptation. Borrow style, background, mood and composition, but optimize the card for the product.",
  },
  {
    min: 61,
    max: 80,
    instruction:
      "Use the reference as inspiration. Adapt the composition more freely while keeping a similar visual mood.",
  },
  {
    min: 81,
    max: 100,
    instruction:
      "Use the reference only as loose inspiration. Create a new product card with a similar mood, but do not copy the reference composition exactly.",
  },
];

export const SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS: SimpleProductCardPromptsSetting = {
  version: SIMPLE_PRODUCT_CARD_PROMPTS_SETTING_VERSION,
  enabled: true,
  globalRules: GLOBAL_RULES,
  promptClassic: PROMPT_CLASSIC,
  promptClassicWithReference: PROMPT_CLASSIC_WITH_REFERENCE,
  promptReference: PROMPT_REFERENCE,
  promptPremium: PROMPT_PREMIUM,
  dimensionsPrompt: DIMENSIONS_PROMPT,
  negativePrompt: NEGATIVE_PROMPT,
  creativityBands: CREATIVITY_BANDS,
  defaultAspectRatio: "1:1",
  defaultStyleMode: "classic",
  maxTextBlocks: 6,
  maxKeyPhrases: 4,
  requireText: true,
  preserveProductIdentity: true,
  referenceEnabled: true,
};

export const PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS = {
  enabled: "PRODUCT_CARD_SIMPLE_CARD_ENABLED",
  defaultStyle: "PRODUCT_CARD_SIMPLE_CARD_DEFAULT_STYLE",
  modelSlug: "PRODUCT_CARD_SIMPLE_CARD_MODEL_SLUG",
  referenceModelSlug: "PRODUCT_CARD_SIMPLE_CARD_REFERENCE_MODEL_SLUG",
  prompts: "PRODUCT_CARD_SIMPLE_CARD_PROMPTS",
  defaultAspectRatio: "PRODUCT_CARD_SIMPLE_CARD_DEFAULT_ASPECT_RATIO",
  referenceEnabled: "PRODUCT_CARD_SIMPLE_CARD_REFERENCE_ENABLED",
} as const;
