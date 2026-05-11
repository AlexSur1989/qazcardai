/**
 * Актуальные активные GENERAL-модели Kie (фаза 1).
 * См. archive-legacy-general-models.ts и verify-kie-general-models.ts.
 */
export const KIE_GENERAL_MODEL_SLUG_WHITELIST = [
  "gpt-image-2-text-to-image",
  "gpt-image-2-image-to-image",
  "kling-2-6-text-to-video",
  "kling-2-6-image-to-video",
] as const;

export type KieGeneralModelSlug =
  (typeof KIE_GENERAL_MODEL_SLUG_WHITELIST)[number];
