import { z } from "zod";

import {
  CARD_BUILDER_PROMPTS_DEFAULTS,
  CARD_BUILDER_PROMPTS_KNOWN_CARD_TYPE_KEYS,
  CARD_BUILDER_PROMPTS_KNOWN_CATEGORY_KEYS,
  CARD_BUILDER_PROMPTS_KNOWN_TEMPLATE_KEYS,
  CARD_BUILDER_PROMPTS_SETTING_VERSION,
  type CardBuilderPromptsSetting,
} from "@/config/card-builder-prompts-defaults";

export const CARD_BUILDER_PROMPT_MAX_LEN = 16_000;

const Z_PROMPT_STRING = z.string().trim().min(1).max(CARD_BUILDER_PROMPT_MAX_LEN);

const Z_OPTIONAL_PROMPT_MAP = z.record(z.string(), Z_PROMPT_STRING);

export const cardBuilderPromptsSettingSchema = z
  .object({
    version: z.string().trim().min(3).max(64),
    enabled: z.boolean(),
    visionPrompt: Z_PROMPT_STRING,
    galleryPlannerPrompt: Z_PROMPT_STRING,
    slidePromptBase: Z_PROMPT_STRING,
    textLockPrompt: Z_PROMPT_STRING,
    preserveProductPrompt: Z_PROMPT_STRING,
    negativeRulesPrompt: Z_PROMPT_STRING,
    styleReferencePrompt: Z_PROMPT_STRING,
    categoryPrompts: Z_OPTIONAL_PROMPT_MAP,
    cardTypePrompts: Z_OPTIONAL_PROMPT_MAP,
    templatePrompts: Z_OPTIONAL_PROMPT_MAP,
  })
  .strict();

export type CardBuilderPromptsValidationResult =
  | { ok: true; value: CardBuilderPromptsSetting; warnings: string[] }
  | { ok: false; errors: string[] };

function unknownKeys(
  record: Record<string, string>,
  known: readonly string[],
  label: string,
): string[] {
  const knownSet = new Set(known);
  return Object.keys(record)
    .filter((k) => !knownSet.has(k))
    .map((k) => `${label}: неизвестный ключ «${k}» (сохранён как custom).`);
}

/** Валидация перед сохранением AppSetting (strict). */
export function validateCardBuilderPromptsForSave(raw: unknown): CardBuilderPromptsValidationResult {
  const parsed = cardBuilderPromptsSettingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
    };
  }
  const warnings = [
    ...unknownKeys(parsed.data.categoryPrompts, CARD_BUILDER_PROMPTS_KNOWN_CATEGORY_KEYS, "categoryPrompts"),
    ...unknownKeys(parsed.data.cardTypePrompts, CARD_BUILDER_PROMPTS_KNOWN_CARD_TYPE_KEYS, "cardTypePrompts"),
    ...unknownKeys(parsed.data.templatePrompts, CARD_BUILDER_PROMPTS_KNOWN_TEMPLATE_KEYS, "templatePrompts"),
  ];
  if (!parsed.data.slidePromptBase.trim()) {
    return { ok: false, errors: ["slidePromptBase: базовый prompt не может быть пустым"] };
  }
  return { ok: true, value: parsed.data as CardBuilderPromptsSetting, warnings };
}

/** Мягкая нормализация при чтении (fallback на defaults). */
export function mergeCardBuilderPromptsWithDefaults(
  raw: unknown,
): { prompts: CardBuilderPromptsSetting; source: "app_setting" | "code_default"; warnings: string[] } {
  const warnings: string[] = [];
  const base = structuredClone(CARD_BUILDER_PROMPTS_DEFAULTS);

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    warnings.push("AppSetting PRODUCT_CARD_CARD_BUILDER_PROMPTS отсутствует или не объект — используются defaults из кода.");
    return { prompts: base, source: "code_default", warnings };
  }

  const strict = validateCardBuilderPromptsForSave(raw);
  if (!strict.ok) {
    warnings.push("AppSetting PRODUCT_CARD_CARD_BUILDER_PROMPTS невалиден — используются defaults из кода.");
    warnings.push(...strict.errors.slice(0, 8));
    return { prompts: base, source: "code_default", warnings };
  }

  warnings.push(...strict.warnings);

  const o = strict.value;
  if (!o.enabled) {
    warnings.push("AppSetting enabled=false — используются defaults из кода.");
    return { prompts: base, source: "code_default", warnings };
  }

  const mergeMap = (
    defaults: Record<string, string>,
    overrides: Record<string, string>,
  ): Record<string, string> => ({ ...defaults, ...overrides });

  return {
    prompts: {
      version: o.version || CARD_BUILDER_PROMPTS_SETTING_VERSION,
      enabled: true,
      visionPrompt: o.visionPrompt.trim() || base.visionPrompt,
      galleryPlannerPrompt: o.galleryPlannerPrompt.trim() || base.galleryPlannerPrompt,
      slidePromptBase: o.slidePromptBase.trim() || base.slidePromptBase,
      textLockPrompt: o.textLockPrompt.trim() || base.textLockPrompt,
      preserveProductPrompt: o.preserveProductPrompt.trim() || base.preserveProductPrompt,
      negativeRulesPrompt: o.negativeRulesPrompt.trim() || base.negativeRulesPrompt,
      styleReferencePrompt: o.styleReferencePrompt.trim() || base.styleReferencePrompt,
      categoryPrompts: mergeMap(base.categoryPrompts, o.categoryPrompts),
      cardTypePrompts: mergeMap(base.cardTypePrompts, o.cardTypePrompts),
      templatePrompts: mergeMap(base.templatePrompts, o.templatePrompts),
    },
    source: "app_setting",
    warnings,
  };
}
