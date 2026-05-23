import {
  CARD_BUILDER_PROMPTS_DEFAULTS,
  CARD_BUILDER_PROMPTS_SETTING_VERSION,
  CARD_BUILDER_SLIDE_ROLE_TO_CARD_TYPE,
  PRODUCT_CARD_VISION_ANALYSIS_OUTPUT_SCHEMA,
  type CardBuilderPromptsSetting,
} from "@/config/card-builder-prompts-defaults";
import { mergeCardBuilderPromptsWithDefaults } from "@/lib/validations/card-builder-prompts-setting";
import { getAppSetting } from "@/server/services/appSettings";

export const PRODUCT_CARD_CARD_BUILDER_PROMPTS_KEY = "PRODUCT_CARD_CARD_BUILDER_PROMPTS" as const;

export type CardBuilderPromptConfigBundle = {
  prompts: CardBuilderPromptsSetting;
  source: "app_setting" | "code_default";
  warnings: string[];
};

export type CardBuilderPromptSelectionMeta = {
  promptVersion: string;
  promptSource: "app_setting" | "code_default";
  categoryPromptKey: string;
  cardTypePromptKey: string;
  templatePromptKey: string;
  promptWarnings?: string[];
};

let cached: { at: number; bundle: CardBuilderPromptConfigBundle } | null = null;
const CACHE_MS = 5_000;

export async function getCardBuilderPromptsSettings(): Promise<CardBuilderPromptConfigBundle> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.bundle;

  const raw = await getAppSetting(PRODUCT_CARD_CARD_BUILDER_PROMPTS_KEY);
  const merged = mergeCardBuilderPromptsWithDefaults(raw);
  const bundle: CardBuilderPromptConfigBundle = {
    prompts: merged.prompts,
    source: merged.source,
    warnings: merged.warnings,
  };
  cached = { at: now, bundle };
  return bundle;
}

export function clearCardBuilderPromptsSettingsCache(): void {
  cached = null;
}

export function resolveCategoryPromptKey(categoryKey?: string | null): string {
  const k = (categoryKey ?? "other").trim();
  if (k === "auto" || !k) return "other";
  return k;
}

export function resolveCardTypePromptKey(slideRole: string): string {
  return CARD_BUILDER_SLIDE_ROLE_TO_CARD_TYPE[slideRole] ?? "main_photo";
}

export function resolveTemplatePromptKey(templateId?: string | null): string {
  const id = templateId?.trim();
  return id && id.length > 0 ? id : "hero_clean";
}

export function pickCategoryPrompt(
  prompts: CardBuilderPromptsSetting,
  categoryKey: string,
): string {
  const key = resolveCategoryPromptKey(categoryKey);
  return prompts.categoryPrompts[key] ?? prompts.categoryPrompts.other ?? "";
}

export function pickCardTypePrompt(prompts: CardBuilderPromptsSetting, slideRole: string): string {
  const key = resolveCardTypePromptKey(slideRole);
  return prompts.cardTypePrompts[key] ?? prompts.cardTypePrompts.main_photo ?? "";
}

export function pickTemplatePrompt(prompts: CardBuilderPromptsSetting, templateId?: string): string {
  const key = resolveTemplatePromptKey(templateId);
  return prompts.templatePrompts[key] ?? "";
}

export function buildCardBuilderPromptSelectionMeta(input: {
  bundle: CardBuilderPromptConfigBundle;
  categoryKey?: string | null;
  slideRole: string;
  templateId?: string | null;
}): CardBuilderPromptSelectionMeta {
  return {
    promptVersion: input.bundle.prompts.version || CARD_BUILDER_PROMPTS_SETTING_VERSION,
    promptSource: input.bundle.source,
    categoryPromptKey: resolveCategoryPromptKey(input.categoryKey),
    cardTypePromptKey: resolveCardTypePromptKey(input.slideRole),
    templatePromptKey: resolveTemplatePromptKey(input.templateId),
    ...(input.bundle.warnings.length ? { promptWarnings: input.bundle.warnings.slice(0, 12) } : {}),
  };
}

export async function getCardBuilderVisionPromptFromSettings(): Promise<{
  prompt: string;
  source: CardBuilderPromptConfigBundle["source"];
  version: string;
  warnings: string[];
}> {
  const bundle = await getCardBuilderPromptsSettings();
  const base = bundle.prompts.visionPrompt.trim() || CARD_BUILDER_PROMPTS_DEFAULTS.visionPrompt;
  const prompt = base.replace("{{OUTPUT_SCHEMA}}", PRODUCT_CARD_VISION_ANALYSIS_OUTPUT_SCHEMA);
  return {
    prompt,
    source: bundle.source,
    version: bundle.prompts.version,
    warnings: bundle.warnings,
  };
}

export function getCardBuilderGalleryPlannerPromptFromBundle(
  bundle: CardBuilderPromptConfigBundle,
): string {
  return bundle.prompts.galleryPlannerPrompt.trim() || CARD_BUILDER_PROMPTS_DEFAULTS.galleryPlannerPrompt;
}
