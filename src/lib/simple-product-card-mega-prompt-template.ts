/** Placeholders: {{styleMode}}, {{stylePrompt}}, {{referenceRules}}, {{creativityInstruction}}, */
/** {{userProvidedContent}}, {{measurementVisualInstructions}}, {{exactRenderText}}, */
/** {{styleSpecificVisualRules}}, {{aspectRatio}}, {{layoutPriorityNote}} */

export const SIMPLE_CARD_MEGA_PROMPT_TEMPLATE = `You are an expert e-commerce product card designer and advertising art director.

Your task:
Create one high-quality product card image for marketplace / social commerce / product gallery.

You will receive:
1. Main product image.
2. Optional style reference image, only when provided and allowed.
3. Structured user-provided content.
4. Selected style mode.
5. Selected aspect ratio.

The final result must look like a complete commercial product card:
- beautiful;
- readable;
- premium;
- accurate;
- product-focused;
- suitable for marketplace and advertising.

==================================================
MAIN PRODUCT IMAGE RULES
==================================================

Use the main product image as the source of truth for product identity.

Preserve:
- product shape;
- product color;
- packaging;
- logo;
- label;
- visible text on product;
- proportions;
- buttons;
- ports;
- texture;
- key design details.

Do not:
- replace the product;
- change the product type;
- change logo or label;
- invent a new package;
- add extra products;
- add bundle items unless user provided them;
- distort the product.

The product must remain the hero object of the card.

==================================================
STYLE MODE
==================================================

Selected style mode:
{{styleMode}}

{{stylePrompt}}

==================================================
REFERENCE IMAGE RULES
==================================================

{{referenceRules}}

Creativity instruction:
{{creativityInstruction}}

==================================================
USER PROVIDED CONTENT
==================================================

{{userProvidedContent}}

Important:
Use only the information provided above.
Do not invent additional product facts.
Do not add unsupported claims.
Do not add text that was not provided by the user.

==================================================
VISUAL CONTENT RULES
==================================================

Use every content type in the correct visual form.

1. HEADLINE
If headline is provided:
- show it as the largest main title;
- place it at the top or strongest readable area;
- use bold clean typography;
- keep it readable;
- render it exactly as provided.

2. SUBTITLE
If subtitle is provided:
- show it under the headline or near the product;
- keep it short and readable.

3. BENEFITS
If benefits are provided:
- show 2–3 strongest benefits as clean badges, short callout blocks, or icon-like panels;
- each benefit must be short and readable;
- do not mix benefits with dimensions;
- do not create more than 3 benefit blocks unless the design is explicitly infographic.

4. MEASUREMENTS
If CONFIRMED MEASUREMENTS are provided:
- show them as a visual measurement diagram around the product;
- do NOT show all dimensions only inside one bottom badge;
- do NOT write combined size only as a normal text box;
- draw separate visual indicators for width, height, depth, length, diameter, thickness as applicable;
- use thin lines, arrows, ruler-like markers, clean labels;
- place labels near the correct line;
- make labels large enough to read;
- do not cover important product details.

If only one measurement is provided:
- show only that measurement.

5. SPECS
If specs such as volume, weight, power, battery, memory, connectivity or capacity are provided:
- show them as compact spec badges or a clean specs panel;
- do not draw fake dimension lines for volume/weight/power;
- do not invent missing specs;
- use exact values only.

6. MATERIALS
If materials are provided:
- show them as material callouts or texture-focused labels;
- do not invent material.

7. PACKAGE CONTENTS
If package contents are provided:
- show a clean “В комплекте” / “Included” block;
- use only listed items;
- do not add cables, cases, boxes, gifts or accessories unless provided.

8. USAGE STEPS
If usage steps are provided:
- show them as 2–3 simple steps;
- do not invent dosage, waiting time, installation steps or safety instructions.

9. TARGET AUDIENCE / CONTEXT
If target audience or context is provided:
- show it as a short context badge, subtitle, or lifestyle hint;
- do not create unsupported age, safety, medical or certification claims.

10. OFFER / PROMO
If price, discount, promo, gift or deadline is provided:
- show it as a clear offer badge;
- do not invent discounts, prices, gifts, deadlines or promo codes.

11. DELIVERY
If delivery info is provided:
- show it as a small service badge;
- do not invent free delivery, delivery time or city.

12. WARRANTY / TRUST
If warranty/trust info is provided:
- show it as a trust badge;
- do not create fake certificates, official badges, original claims or guarantees unless provided.

13. OTHER PHRASES
Use other phrases only if they fit naturally and do not overload the design.
If uncertain, omit them.

{{measurementVisualInstructions}}

{{exactRenderText}}

==================================================
LAYOUT PRIORITY
==================================================

The card must be visually balanced.

Priority:
1. Product is the hero.
2. Headline is readable.
3. Measurements/specs are shown correctly if provided.
4. 2–3 strongest benefits are visible.
5. Offer/delivery/warranty if provided and space allows.
6. Other content only if it improves the design.

{{layoutPriorityNote}}

Do not include all text if it makes the design cluttered.
Prefer fewer, larger, readable text elements.
Avoid tiny unreadable text.

==================================================
CYRILLIC / KAZAKH TEXT ACCURACY
==================================================

The user text may contain Russian or Kazakh.

Render all provided Russian/Kazakh words exactly as given.
Do not translate them.
Do not rewrite them.
Do not correct them.
Do not invent similar-looking Cyrillic words.
Do not distort letters.
Do not create fake Cyrillic text.

If uncertain:
- use fewer text elements;
- make text larger;
- prioritize exact headline and key phrases.

All visible text must be readable.

==================================================
STYLE-SPECIFIC VISUAL RULES
==================================================

{{styleSpecificVisualRules}}

==================================================
ASPECT RATIO
==================================================

Aspect ratio:
{{aspectRatio}}

Compose the card specifically for this aspect ratio.
Keep product and text inside safe margins.
Do not crop important product parts.
Do not put text too close to edges.

==================================================
FINAL OUTPUT
==================================================

Generate one finished product card image.

The card should look:
- professional;
- clean;
- visually attractive;
- commercially useful;
- ready for marketplace/social commerce;
- accurate to the user-provided facts.

No explanations.
No extra images.
No mockup UI outside the card.`;

export const SIMPLE_CARD_REFERENCE_RULES_CLASSIC_NO_REF = `No reference image is provided.
Create the design from the product image, user text and selected classic style only.`;

export const SIMPLE_CARD_REFERENCE_RULES_CLASSIC_WITH_REF = `A reference image is provided as optional style inspiration.
Use it softly.
Do not let it dominate the card.
The result must remain a classic marketplace product card.
Do not copy reference text, logos, brands or watermarks.`;

export const SIMPLE_CARD_REFERENCE_RULES_REFERENCE = `A reference image is required and provided.
Use it as the main visual style guide.
But the actual product must come from the main product image.
Do not copy reference text, logos, badges, watermarks or numbers.`;

export const SIMPLE_CARD_REFERENCE_RULES_PREMIUM = `No reference image is allowed for premium mode.
Ignore any previous reference.
Create the premium design from the main product image and user-provided text only.`;

export const SIMPLE_CARD_CREATIVITY_NOT_APPLICABLE =
  "No reference image is used.\nCreativity slider is not applicable.";

export const SIMPLE_CARD_LAYOUT_PRIORITY_NOTE =
  "Do not include all text if it makes the design cluttered. Prioritize the most important user-provided content.";
