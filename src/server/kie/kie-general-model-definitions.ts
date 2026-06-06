/**
 * Единый реестр GENERAL Kie-моделей.
 * Каталог очищен — модели добавляются заново по docs.kie.ai + kie.ai playground.
 */

import type { KiePayloadMapping } from "@/server/services/kiePayloadMapping";

export type KieModelDefinition = {
  slug: string;
  name: string;
  familySlug: string;
  familyName: string;
  provider: "KIE_AI";
  type: "IMAGE" | "VIDEO";
  scope: "GENERAL";
  productCardModelType: null;
  isPublic: boolean;
  apiModelId: string;
  endpoint: string;
  statusEndpoint: string | null;
  settingsSchema: Record<string, unknown>;
  payloadMapping: KiePayloadMapping;
  pricingSchema: Record<string, unknown>;
  supportsImageInput: boolean;
  supportsVideoInput: boolean;
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  maxDuration?: number | null;
  metadata: {
    docsUrl: string;
    playgroundUrl?: string;
    docsCheckedAt: string;
    source: "docs.kie.ai + kie.ai playground";
    publicReady: boolean;
    requiresManualKieTest?: boolean;
    pricingNeedsReview?: boolean;
    reason?: string;
    [key: string]: unknown;
  };
  description: string;
  availableAspectRatios: string[];
  availableResolutions: string[];
  costCredits: number;
  realCost: number | null;
};

/** Пустой каталог — пересборка с нуля. */
export const KIE_GENERAL_MODEL_DEFINITIONS: readonly KieModelDefinition[] = [];

export const KIE_GENERAL_MODEL_DEFINITION_SLUG_ORDER =
  KIE_GENERAL_MODEL_DEFINITIONS.map((m) => m.slug);

export function generalKieAllowedSettingsKeysForApiModel(
  _apiModelId: string,
): ReadonlySet<string> | null {
  return null;
}

export function generalKieDefinitionByApiModelId(
  apiModelId: string,
): KieModelDefinition | null {
  const k = apiModelId.trim();
  return KIE_GENERAL_MODEL_DEFINITIONS.find((m) => m.apiModelId === k) ?? null;
}
