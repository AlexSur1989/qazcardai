import { MANUAL_PRODUCT_CATEGORY_OPTIONS } from "@/config/product-card-manual-categories";

/** JSON schema для Gemini 3 Flash classifier (Kie chat/completions). */
export const PRODUCT_CLASSIFIER_KIE_JSON_SCHEMA = `{
  "category": "one of manual category ids",
  "categoryLabel": "Russian label",
  "productTitle": "short product title in Russian",
  "visibleProduct": "what is visible on the photo in Russian",
  "suggestedBenefits": ["benefit 1", "benefit 2"],
  "detectedAttributes": [
    { "label": "Материал", "value": "керамика", "confidence": 0.7 }
  ],
  "confidence": 0.82,
  "warnings": []
}`;

const CATEGORY_IDS = MANUAL_PRODUCT_CATEGORY_OPTIONS.map((o) => o.id).join(", ");

export const PRODUCT_CLASSIFIER_KIE_SYSTEM_PROMPT =
  "You are a product recognition assistant for marketplace card creation. Return only valid JSON matching the requested schema.";

export function getProductClassifierKieUserText(): string {
  return `Analyze the product photo and return JSON with category, product title, visible product description, suggested benefits, detected attributes, confidence and warnings.

Allowed category ids (use exactly one): ${CATEGORY_IDS}.
If unsure, use category "universal".

Category hints (pick the best match; never default to apparel unless the product is worn clothing):
- home_appliances: large home/fitness equipment (treadmill, exercise bike, elliptical), kitchen appliances, vacuum cleaners, climate devices
- electronics: phones, tablets, laptops, headphones, TVs, cameras, small gadgets, gaming devices
- apparel: clothing worn on the body (shirts, pants, dresses, jackets)
- footwear: shoes, sneakers, boots
- furniture: tables, chairs, sofas, beds, cabinets
- home_goods: decor, kitchenware, textiles, storage, small home items (not large appliances)
- auto: car parts and accessories
- beauty_and_care: cosmetics, skincare, hair care
- kids: children's products
- accessories: bags, watches, jewelry, glasses (not clothing)
- universal: mixed or unclear

Use Russian language for categoryLabel, productTitle, visibleProduct, suggestedBenefits and detectedAttributes labels/values.
Do not invent brand names or technical specs if they are not visible on the photo.
Return at most 7 suggestedBenefits and at most 10 detectedAttributes.

JSON schema:
${PRODUCT_CLASSIFIER_KIE_JSON_SCHEMA}`;
}

/** Dry-run sample image (public HTTPS, no Kie call). */
export const PRODUCT_CLASSIFIER_DRY_RUN_SAMPLE_IMAGE =
  "https://example.com/product-classifier-dry-run.jpg";
