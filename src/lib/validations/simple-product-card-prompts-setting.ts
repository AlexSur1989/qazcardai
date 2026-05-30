import { z } from "zod";

import {
  SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS,
  SIMPLE_PRODUCT_CARD_PROMPTS_SETTING_VERSION,
  type SimpleProductCardPromptsSetting,
} from "@/config/simple-product-card-prompts-defaults";

export const SIMPLE_CARD_PROMPT_MAX_LEN = 16_000;

const Z_PROMPT = z.string().trim().min(1).max(SIMPLE_CARD_PROMPT_MAX_LEN);

const Z_CREATIVITY_BAND = z
  .object({
    min: z.number().int().min(0).max(100),
    max: z.number().int().min(0).max(100),
    instruction: Z_PROMPT,
  })
  .strict();

export const simpleProductCardPromptsSettingSchema = z
  .object({
    version: z.string().trim().min(3).max(64),
    enabled: z.boolean(),
    megaPromptTemplate: Z_PROMPT,
    globalRules: Z_PROMPT,
    promptClassic: Z_PROMPT,
    promptClassicWithReference: Z_PROMPT,
    promptReference: Z_PROMPT,
    promptPremium: Z_PROMPT,
    referenceRulesClassicNoRef: Z_PROMPT,
    referenceRulesClassicWithRef: Z_PROMPT,
    referenceRulesReference: Z_PROMPT,
    referenceRulesPremium: Z_PROMPT,
    dimensionsPrompt: Z_PROMPT,
    negativePrompt: Z_PROMPT,
    creativityBands: z.array(Z_CREATIVITY_BAND).min(1).max(10),
    defaultAspectRatio: z.string().trim().min(3).max(16),
    defaultStyleMode: z.enum(["classic", "reference", "premium"]),
    maxTextBlocks: z.number().int().min(1).max(20),
    maxKeyPhrases: z.number().int().min(1).max(12),
    maxBenefits: z.number().int().min(1).max(12).optional(),
    maxSpecs: z.number().int().min(1).max(12).optional(),
    maxPackageItems: z.number().int().min(1).max(12).optional(),
    maxUsageSteps: z.number().int().min(1).max(12).optional(),
    requireText: z.boolean(),
    preserveProductIdentity: z.boolean(),
    referenceEnabled: z.boolean(),
  })
  .strict()
  .transform((data) => ({
    ...data,
    maxBenefits: data.maxBenefits ?? data.maxKeyPhrases,
    maxSpecs: data.maxSpecs ?? 4,
    maxPackageItems: data.maxPackageItems ?? 4,
    maxUsageSteps: data.maxUsageSteps ?? 3,
  }));

export function mergeSimpleProductCardPromptsWithDefaults(raw: unknown): {
  prompts: SimpleProductCardPromptsSetting;
  source: "app_setting" | "code_default";
  warnings: string[];
} {
  const warnings: string[] = [];
  const base = structuredClone(SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS);

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    warnings.push("PRODUCT_CARD_SIMPLE_CARD_PROMPTS отсутствует — defaults из кода.");
    return { prompts: base, source: "code_default", warnings };
  }

  const merged = { ...base, ...(raw as Record<string, unknown>) };
  const parsed = simpleProductCardPromptsSettingSchema.safeParse(merged);
  if (!parsed.success) {
    warnings.push("PRODUCT_CARD_SIMPLE_CARD_PROMPTS невалиден — defaults из кода.");
    return { prompts: base, source: "code_default", warnings };
  }

  if (parsed.data.version !== SIMPLE_PRODUCT_CARD_PROMPTS_SETTING_VERSION) {
    warnings.push(`Версия промптов ${parsed.data.version} — ожидалась ${SIMPLE_PRODUCT_CARD_PROMPTS_SETTING_VERSION}.`);
  }

  return { prompts: parsed.data as SimpleProductCardPromptsSetting, source: "app_setting", warnings };
}

export function validateSimpleProductCardPromptsForSave(raw: unknown):
  | { ok: true; value: SimpleProductCardPromptsSetting; warnings: string[] }
  | { ok: false; errors: string[] } {
  const base = structuredClone(SIMPLE_PRODUCT_CARD_PROMPTS_DEFAULTS);
  const merged =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...base, ...(raw as Record<string, unknown>) }
      : base;
  const parsed = simpleProductCardPromptsSettingSchema.safeParse(merged);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
    };
  }
  return { ok: true, value: parsed.data as SimpleProductCardPromptsSetting, warnings: [] };
}
