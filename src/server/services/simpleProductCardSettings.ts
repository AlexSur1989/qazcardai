import type { AiModel } from "@/generated/prisma/client";
import { resolveDefaultMarketplaceCardModel } from "@/server/services/productCardModelResolver";
import { modelSupportsSimpleCardReferenceImage } from "@/lib/simple-product-card-model";
import { prisma } from "@/lib/prisma";
import {
  PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS,
} from "@/config/simple-product-card-prompts-defaults";
import {
  SIMPLE_CARD_DEFAULT_ASPECT_RATIO,
  SIMPLE_CARD_DEFAULT_STYLE_MODE,
  type SimpleCardAspectRatio,
  type SimpleCardStyleMode,
} from "@/config/simple-product-card";
import { mergeSimpleProductCardPromptsWithDefaults } from "@/lib/validations/simple-product-card-prompts-setting";
import { getAppSetting } from "@/server/services/appSettings";
import { getProductCardSettings } from "@/server/services/productCardSettings";

export type SimpleProductCardRuntimeSettings = {
  enabled: boolean;
  defaultStyleMode: SimpleCardStyleMode;
  defaultAspectRatio: SimpleCardAspectRatio;
  modelSlug: string;
  referenceModelSlug: string;
  referenceEnabled: boolean;
  prompts: ReturnType<typeof mergeSimpleProductCardPromptsWithDefaults>["prompts"];
  promptsSource: "app_setting" | "code_default";
  promptWarnings: string[];
};

function parseBool(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return fallback;
}

function parseStyleMode(raw: unknown): SimpleCardStyleMode {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "classic" || s === "reference" || s === "premium") return s;
  return SIMPLE_CARD_DEFAULT_STYLE_MODE;
}

function parseAspect(raw: unknown): SimpleCardAspectRatio {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "9:16" || s === "3:4" || s === "1:1" || s === "4:3" || s === "16:9") return s;
  return SIMPLE_CARD_DEFAULT_ASPECT_RATIO;
}

let cached: { at: number; value: SimpleProductCardRuntimeSettings } | null = null;
const CACHE_MS = 5_000;

export async function getSimpleProductCardRuntimeSettings(): Promise<SimpleProductCardRuntimeSettings> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.value;

  const [enabledRaw, defaultStyleRaw, modelSlugRaw, refModelSlugRaw, promptsRaw, aspectRaw, refEnabledRaw] =
    await Promise.all([
      getAppSetting(PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS.enabled),
      getAppSetting(PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS.defaultStyle),
      getAppSetting(PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS.modelSlug),
      getAppSetting(PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS.referenceModelSlug),
      getAppSetting(PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS.prompts),
      getAppSetting(PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS.defaultAspectRatio),
      getAppSetting(PRODUCT_CARD_SIMPLE_CARD_SETTING_KEYS.referenceEnabled),
    ]);

  const pcSettings = await getProductCardSettings();
  const mergedPrompts = mergeSimpleProductCardPromptsWithDefaults(promptsRaw);

  const value: SimpleProductCardRuntimeSettings = {
    enabled: parseBool(enabledRaw, true),
    defaultStyleMode: parseStyleMode(defaultStyleRaw ?? mergedPrompts.prompts.defaultStyleMode),
    defaultAspectRatio: parseAspect(aspectRaw ?? mergedPrompts.prompts.defaultAspectRatio),
    modelSlug:
      (typeof modelSlugRaw === "string" ? modelSlugRaw.trim() : "") ||
      pcSettings.marketplaceCardModelSlug,
    referenceModelSlug:
      (typeof refModelSlugRaw === "string" ? refModelSlugRaw.trim() : "") ||
      pcSettings.marketplaceCardModelSlug,
    referenceEnabled: parseBool(refEnabledRaw, mergedPrompts.prompts.referenceEnabled),
    prompts: mergedPrompts.prompts,
    promptsSource: mergedPrompts.source,
    promptWarnings: mergedPrompts.warnings,
  };

  cached = { at: now, value };
  return value;
}

export function clearSimpleProductCardSettingsCache(): void {
  cached = null;
}

export async function resolveSimpleProductCardImageModel(options: {
  needsReference: boolean;
  settings: SimpleProductCardRuntimeSettings;
}): Promise<{ model: AiModel; fallbackFromMarketplaceCard: boolean; supportsReference: boolean } | null> {
  const slug = options.needsReference
    ? options.settings.referenceModelSlug
    : options.settings.modelSlug;

  if (slug.trim()) {
    const bySlug = await prisma.aiModel.findFirst({
      where: { slug: slug.trim(), scope: "PRODUCT_CARD", isActive: true, type: "IMAGE" },
    });
    if (bySlug?.supportsImageInput) {
      return {
        model: bySlug,
        fallbackFromMarketplaceCard: bySlug.productCardModelType !== "PRODUCT_MARKETPLACE_CARD",
        supportsReference: modelSupportsSimpleCardReferenceImage(bySlug),
      };
    }
  }

  const marketplaceModel = await resolveDefaultMarketplaceCardModel();
  if (marketplaceModel?.supportsImageInput) {
    return {
      model: marketplaceModel,
      fallbackFromMarketplaceCard: true,
      supportsReference: modelSupportsSimpleCardReferenceImage(marketplaceModel),
    };
  }

  return null;
}
