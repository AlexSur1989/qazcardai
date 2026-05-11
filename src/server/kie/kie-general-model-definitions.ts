import type { KiePayloadMapping } from "@/server/services/kiePayloadMapping";

import { GENERAL_PHASE1_MODELS } from "@/server/kie/general-phase1-models";
import { ADDITIONAL_KIE_GENERAL_MODELS } from "@/server/kie/kie-additional-general-models";
import { HAPPYHORSE_MODELS } from "@/server/kie/kie-happyhorse-models";
import { WAN_27_VIDEO_MODELS } from "@/server/kie/kie-wan-27-video-models";

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
  statusEndpoint: string;
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

function metaWithPublicGate(
  metadata: Record<string, unknown>,
): KieModelDefinition["metadata"] {
  return {
    ...(metadata as KieModelDefinition["metadata"]),
    publicReady:
      typeof metadata.publicReady === "boolean" ? metadata.publicReady : true,
  };
}

function familySlugFor(familyName: string): string {
  const n = familyName.toLowerCase();
  if (n.includes("gpt image 2")) return "gpt-image-2";
  if (n.includes("kling 2.6")) return "kling-2-6";
  if (n.includes("happyhorse")) return "happyhorse-1-0";
  if (n.includes("wan 2.7")) return "wan-2-7";
  if (n.includes("seedance 2.0 fast")) return "seedance-2-fast";
  if (n.includes("seedance 2.0")) return "seedance-2";
  if (n.includes("nano banana 2")) return "nano-banana-2";
  if (n.includes("nano banana pro")) return "nano-banana-pro";
  if (n.includes("seedream 5.0")) return "seedream-5-lite";
  if (n.includes("seedream 4.5")) return "seedream-4-5";
  if (n.includes("flux 2")) return "flux-2";
  if (n.includes("grok imagine")) return "grok-imagine";
  if (n.includes("qwen2")) return "qwen2";
  if (n.includes("qwen")) return "qwen";
  if (n.includes("ideogram")) return "ideogram-v3";
  return n.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeDefinition(
  row: {
    slug: string;
    name: string;
    type: "IMAGE" | "VIDEO";
    apiModelId: string;
    supportsImageInput: boolean;
    supportsVideoInput?: boolean;
    supportsNegativePrompt?: boolean;
    supportsSeed?: boolean;
    maxDuration?: number | null;
    metadata: Record<string, unknown>;
    description: string;
    availableAspectRatios: string[];
    availableResolutions: string[];
    settingsSchema: Record<string, unknown>;
    payloadMapping: KiePayloadMapping;
    pricingSchema: Record<string, unknown>;
    costCredits: number;
    realCost: number | null;
  },
): KieModelDefinition {
  const familyName = String(row.metadata.kieModelFamily ?? row.name);
  return {
    slug: row.slug,
    name: row.name,
    familySlug: familySlugFor(familyName),
    familyName,
    provider: "KIE_AI",
    type: row.type,
    scope: "GENERAL",
    productCardModelType: null,
    isPublic: metaWithPublicGate(row.metadata).publicReady === true,
    apiModelId: row.apiModelId,
    endpoint: "/api/v1/jobs/createTask",
    statusEndpoint: "/api/v1/jobs/recordInfo",
    settingsSchema: row.settingsSchema,
    payloadMapping: row.payloadMapping,
    pricingSchema: row.pricingSchema,
    supportsImageInput: row.supportsImageInput,
    supportsVideoInput: row.supportsVideoInput ?? false,
    supportsNegativePrompt: row.supportsNegativePrompt ?? false,
    supportsSeed: row.supportsSeed ?? false,
    maxDuration: row.maxDuration ?? null,
    metadata: metaWithPublicGate(row.metadata),
    description: row.description,
    availableAspectRatios: row.availableAspectRatios,
    availableResolutions: row.availableResolutions,
    costCredits: row.costCredits,
    realCost: row.realCost,
  };
}

export const KIE_GENERAL_MODEL_DEFINITIONS: readonly KieModelDefinition[] = [
  ...GENERAL_PHASE1_MODELS.map((m) =>
    normalizeDefinition({
      ...m,
      supportsVideoInput: false,
      supportsNegativePrompt: false,
      supportsSeed: false,
    }),
  ),
  ...HAPPYHORSE_MODELS.map((m) =>
    normalizeDefinition({
      ...m,
      supportsNegativePrompt: false,
    }),
  ),
  ...WAN_27_VIDEO_MODELS.map((m) => normalizeDefinition(m)),
  ...ADDITIONAL_KIE_GENERAL_MODELS.map((m) => normalizeDefinition(m)),
];

export const KIE_GENERAL_MODEL_DEFINITION_SLUG_ORDER =
  KIE_GENERAL_MODEL_DEFINITIONS.map((m) => m.slug);

const ALLOWED_SETTINGS_BY_API_MODEL = new Map<string, ReadonlySet<string>>(
  KIE_GENERAL_MODEL_DEFINITIONS.map((m) => {
    const fields = (
      (m.settingsSchema as { fields?: { name?: string }[] }).fields ?? []
    ).map((f) => f.name).filter(Boolean) as string[];
    return [m.apiModelId, new Set(fields)] as const;
  }),
);

export function generalKieAllowedSettingsKeysForApiModel(
  apiModelId: string,
): ReadonlySet<string> | null {
  return ALLOWED_SETTINGS_BY_API_MODEL.get(apiModelId.trim()) ?? null;
}

export function generalKieDefinitionByApiModelId(
  apiModelId: string,
): KieModelDefinition | null {
  const k = apiModelId.trim();
  return KIE_GENERAL_MODEL_DEFINITIONS.find((m) => m.apiModelId === k) ?? null;
}
