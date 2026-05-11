/** Значения полей формы — без React. */

export type AiModelFormFieldValues = {
  name: string;
  slug: string;
  provider: string;
  type: string;
  scope: string;
  productCardModelType: string;
  apiModelId: string;
  endpoint: string;
  statusEndpoint: string;
  costCredits: number;
  realCost: string;
  isActive: boolean;
  isPublic: boolean;
  metadataJson: string;
  payloadMappingJson: string;
  settingsSchema: string;
  description: string;
  supportsImageInput: boolean;
  supportsVideoInput: boolean;
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  maxDuration: string;
  availableAspectRatios: string;
  availableResolutions: string;
};

export function fromDbModelToFormFields(m: {
  name: string;
  slug: string;
  provider: string;
  type: string;
  scope: string;
  productCardModelType: string | null;
  apiModelId: string;
  endpoint: string | null;
  statusEndpoint?: string | null;
  costCredits: number;
  realCost: unknown;
  isActive: boolean;
  isPublic?: boolean | null;
  payloadMapping?: unknown | null;
  metadata?: unknown | null;
  settingsSchema: unknown;
  description: string | null;
  supportsImageInput: boolean;
  supportsVideoInput: boolean;
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  maxDuration: number | null;
  availableAspectRatios: unknown;
  availableResolutions: unknown;
}): AiModelFormFieldValues {
  return {
    name: m.name,
    slug: m.slug,
    provider: m.provider,
    type: m.type,
    scope: m.scope,
    productCardModelType: m.productCardModelType ?? "",
    apiModelId: m.apiModelId,
    endpoint: m.endpoint ?? "",
    statusEndpoint: m.statusEndpoint ?? "",
    costCredits: m.costCredits,
    realCost:
      m.realCost != null
        ? typeof m.realCost === "object" && "toString" in m.realCost
          ? (m.realCost as { toString: () => string }).toString()
          : String(m.realCost)
        : "",
    isActive: m.isActive,
    isPublic: m.isPublic === true,
    metadataJson:
      m.metadata == null ? "{}" : JSON.stringify(m.metadata, null, 2),
    payloadMappingJson:
      m.payloadMapping == null
        ? "{}"
        : JSON.stringify(m.payloadMapping, null, 2),
    settingsSchema:
      m.settingsSchema == null
        ? ""
        : JSON.stringify(m.settingsSchema, null, 2),
    description: m.description ?? "",
    supportsImageInput: m.supportsImageInput,
    supportsVideoInput: m.supportsVideoInput,
    supportsNegativePrompt: m.supportsNegativePrompt,
    supportsSeed: m.supportsSeed,
    maxDuration: m.maxDuration != null ? String(m.maxDuration) : "",
    availableAspectRatios:
      m.availableAspectRatios == null
        ? ""
        : JSON.stringify(m.availableAspectRatios, null, 2),
    availableResolutions:
      m.availableResolutions == null
        ? ""
        : JSON.stringify(m.availableResolutions, null, 2),
  };
}
