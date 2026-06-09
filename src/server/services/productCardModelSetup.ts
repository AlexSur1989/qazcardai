import { prisma } from "@/lib/prisma";
import { isRecord } from "@/lib/model-pricing-shared";
import { labelProductCardModelType } from "@/lib/product-card-model-type-labels";
import {
  classifierRuntimeGateLabel,
  isClassifierRuntimeEnabled,
} from "@/lib/product-classifier-runtime-gate";
import {
  defaultSlugForProductCardType,
  getProductCardSettings,
  type ProductCardModelType,
  type ProductCardScenarioKey,
} from "@/server/services/productCardSettings";
import { getProductClassifierCommercialSettings } from "@/server/services/productClassifierCommercialSettings";

export type ProductCardModelSlotStatus =
  | "ready"
  | "missing_assignment"
  | "missing_model"
  | "inactive"
  | "wrong_scope";

export type ProductCardReadinessStatus =
  | "Ready"
  | "Missing"
  | "Inactive"
  | "Misconfigured"
  /** Модель настроена и active, но PRODUCT_CLASSIFIER_ALLOW_REAL_KIE выключен */
  | "ConfiguredDisabled";

export type ProductCardModelSlotDiagnostics = {
  productCardModelType: ProductCardModelType;
  scenarioKey: ProductCardScenarioKey | null;
  label: string;
  appSettingKey: string;
  assignedSlug: string;
  status: ProductCardModelSlotStatus;
  readinessStatus: ProductCardReadinessStatus;
  readinessIssues: string[];
  modelId: string | null;
  modelName: string | null;
  modelSlug: string | null;
  adminHint: string;
  generationReady: boolean;
  autoClassifyReady: boolean;
};

type ModelRow = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  scope: string;
  productCardModelType: string | null;
  type: string;
  apiModelId: string;
  endpoint: string | null;
  supportsImageInput: boolean;
  costCredits: number;
  payloadMapping: unknown;
  pricingSchema: unknown;
  settingsSchema: unknown;
};

const SLOT_DEFS: Array<{
  productCardModelType: ProductCardModelType;
  scenarioKey: ProductCardScenarioKey | null;
  appSettingKey: string;
}> = [
  {
    productCardModelType: "PRODUCT_CLASSIFIER",
    scenarioKey: null,
    appSettingKey: "PRODUCT_CARD_DEFAULT_CLASSIFIER_MODEL_SLUG",
  },
  {
    productCardModelType: "PRODUCT_CONCEPT_IMAGE",
    scenarioKey: "conceptPhoto",
    appSettingKey: "PRODUCT_CARD_DEFAULT_CONCEPT_IMAGE_MODEL_SLUG",
  },
  {
    productCardModelType: "PRODUCT_MARKETPLACE_CARD",
    scenarioKey: "marketplaceCard",
    appSettingKey: "PRODUCT_CARD_DEFAULT_MARKETPLACE_CARD_MODEL_SLUG",
  },
  {
    productCardModelType: "PRODUCT_VIDEO",
    scenarioKey: "productVideo",
    appSettingKey: "PRODUCT_CARD_DEFAULT_VIDEO_MODEL_SLUG",
  },
];

function expectedType(t: ProductCardModelType): "IMAGE" | "VIDEO" {
  return t === "PRODUCT_VIDEO" ? "VIDEO" : "IMAGE";
}

function isPlaceholderApiModelId(apiModelId: string): boolean {
  const t = apiModelId.trim().toUpperCase();
  return t === "PLACEHOLDER" || t === "CHANGE_ME" || t.startsWith("PASTE_");
}

function computeReadinessIssues(
  model: ModelRow | null,
  assignedSlug: string,
  productCardModelType: ProductCardModelType,
): string[] {
  const issues: string[] = [];
  if (!assignedSlug.trim()) {
    issues.push("assigned slug missing");
    return issues;
  }
  if (!model) {
    issues.push("AppSetting slug points to missing model");
    return issues;
  }
  if (model.scope !== "PRODUCT_CARD") {
    issues.push("wrong scope");
  }
  if (model.productCardModelType !== productCardModelType) {
    issues.push("wrong productCardModelType");
  }
  if (model.type !== expectedType(productCardModelType)) {
    issues.push(`type must be ${expectedType(productCardModelType)}`);
  }
  if (!model.isActive) {
    issues.push("model is inactive");
  }
  if (!model.apiModelId?.trim()) {
    issues.push("missing apiModelId");
  } else if (isPlaceholderApiModelId(model.apiModelId)) {
    issues.push("apiModelId is PLACEHOLDER");
  }
  if (!model.endpoint?.trim()) {
    issues.push("endpoint missing");
  }
  if (!isRecord(model.payloadMapping) || Object.keys(model.payloadMapping).length === 0) {
    issues.push("payloadMapping missing");
  }
  if (!isRecord(model.pricingSchema) || Object.keys(model.pricingSchema).length === 0) {
    issues.push("pricingSchema missing");
  }
  if (model.costCredits <= 0) {
    issues.push("costCredits must be greater than 0");
  }
  if (
    productCardModelType === "PRODUCT_MARKETPLACE_CARD" &&
    !model.supportsImageInput
  ) {
    issues.push("supportsImageInput=false");
  }
  if (productCardModelType === "PRODUCT_CLASSIFIER" && !model.supportsImageInput) {
    issues.push("supportsImageInput=false");
  }
  return issues;
}

function resolveReadinessStatus(
  slotStatus: ProductCardModelSlotStatus,
  issues: string[],
): ProductCardReadinessStatus {
  if (slotStatus === "missing_assignment" || slotStatus === "missing_model") {
    return "Missing";
  }
  if (slotStatus === "inactive") {
    return "Inactive";
  }
  if (slotStatus === "wrong_scope" || issues.length > 0) {
    return "Misconfigured";
  }
  return "Ready";
}

function buildAdminHint(args: {
  status: ProductCardModelSlotStatus;
  readinessStatus: ProductCardReadinessStatus;
  readinessIssues: string[];
  productCardModelType: ProductCardModelType;
  appSettingKey: string;
  assignedSlug: string;
  modelSlug: string | null;
  modelRow: ModelRow | null;
}): string {
  if (args.readinessIssues.length > 0) {
    return args.readinessIssues.join("; ");
  }
  if (
    args.productCardModelType === "PRODUCT_CLASSIFIER" &&
    args.modelRow &&
    args.status === "ready"
  ) {
    const parts = [
      `slug=${args.modelRow.slug}`,
      `apiModelId=${args.modelRow.apiModelId}`,
      `endpoint=${args.modelRow.endpoint ?? "—"}`,
      `costCredits=${args.modelRow.costCredits}`,
      `runtime gate=${classifierRuntimeGateLabel()}`,
      `dry-run=/admin/models/${args.modelRow.id}/edit?tab=dry-run`,
    ];
    if (args.readinessStatus === "ConfiguredDisabled") {
      parts.push("real Kie disabled — set PRODUCT_CLASSIFIER_ALLOW_REAL_KIE=true before real test");
    }
    return parts.join("; ");
  }
  const typeLabel = labelProductCardModelType(args.productCardModelType);
  switch (args.status) {
    case "ready":
      return `Модель «${args.modelSlug}» активна и назначена (${args.readinessStatus}).`;
    case "missing_assignment":
      return `AppSetting ${args.appSettingKey} пуст — назначьте slug активной модели (${typeLabel}) в /admin/product-card.`;
    case "missing_model":
      return `Slug «${args.assignedSlug}» указан в ${args.appSettingKey}, но модель не найдена в AiModel.`;
    case "inactive":
      return `Модель «${args.assignedSlug}» найдена, но isActive=false. Заполните Kie Model ID и активируйте в /admin/models.`;
    case "wrong_scope":
      return `Slug «${args.assignedSlug}» сопоставлен модели с неверным scope или productCardModelType (${typeLabel}).`;
    default:
      return "";
  }
}

export async function getProductCardModelSetupOverview(): Promise<{
  slots: ProductCardModelSlotDiagnostics[];
  byType: Record<ProductCardModelType, ProductCardModelSlotDiagnostics>;
  byScenario: Partial<Record<ProductCardScenarioKey, ProductCardModelSlotDiagnostics>>;
}> {
  const settings = await getProductCardSettings();
  const commercial = await getProductClassifierCommercialSettings();
  const slugs = SLOT_DEFS.map((d) =>
    defaultSlugForProductCardType(settings, d.productCardModelType).trim(),
  ).filter(Boolean);

  const models =
    slugs.length > 0
      ? await prisma.aiModel.findMany({
          where: { slug: { in: slugs } },
          select: {
            id: true,
            slug: true,
            name: true,
            isActive: true,
            scope: true,
            productCardModelType: true,
            type: true,
            apiModelId: true,
            endpoint: true,
            supportsImageInput: true,
            costCredits: true,
            payloadMapping: true,
            pricingSchema: true,
            settingsSchema: true,
          },
        })
      : [];

  const bySlug = new Map(models.map((m) => [m.slug, m as ModelRow]));

  const slots: ProductCardModelSlotDiagnostics[] = SLOT_DEFS.map((def) => {
    const assignedSlug = defaultSlugForProductCardType(
      settings,
      def.productCardModelType,
    ).trim();
    const label = labelProductCardModelType(def.productCardModelType);
    let status: ProductCardModelSlotStatus = "missing_assignment";
    let modelId: string | null = null;
    let modelName: string | null = null;
    let modelSlug: string | null = null;
    let modelRow: ModelRow | null = null;

    if (assignedSlug) {
      const row = bySlug.get(assignedSlug);
      if (!row) {
        status = "missing_model";
        modelSlug = assignedSlug;
      } else {
        modelRow = row;
        modelId = row.id;
        modelName = row.name;
        modelSlug = row.slug;
        if (row.scope !== "PRODUCT_CARD") {
          status = "wrong_scope";
        } else if (row.productCardModelType !== def.productCardModelType) {
          status = "wrong_scope";
        } else if (row.type !== expectedType(def.productCardModelType)) {
          status = "wrong_scope";
        } else if (!row.isActive) {
          status = "inactive";
        } else {
          status = "ready";
        }
      }
    }

    const readinessIssues = computeReadinessIssues(
      modelRow,
      assignedSlug,
      def.productCardModelType,
    );
    let readinessStatus = resolveReadinessStatus(status, readinessIssues);
    if (
      def.productCardModelType === "PRODUCT_CLASSIFIER" &&
      readinessStatus === "Ready" &&
      !isClassifierRuntimeEnabled()
    ) {
      readinessStatus = "ConfiguredDisabled";
    }
    const generationReady = readinessStatus === "Ready";
    const autoClassifyReady =
      def.productCardModelType === "PRODUCT_CLASSIFIER" &&
      generationReady &&
      commercial.accessMode === "all_users";

    return {
      productCardModelType: def.productCardModelType,
      scenarioKey: def.scenarioKey,
      label,
      appSettingKey: def.appSettingKey,
      assignedSlug,
      status,
      readinessStatus,
      readinessIssues,
      modelId,
      modelName,
      modelSlug,
      adminHint: buildAdminHint({
        status,
        readinessStatus,
        readinessIssues,
        productCardModelType: def.productCardModelType,
        appSettingKey: def.appSettingKey,
        assignedSlug,
        modelSlug,
        modelRow,
      }),
      generationReady,
      autoClassifyReady,
    };
  });

  const byType = Object.fromEntries(
    slots.map((s) => [s.productCardModelType, s]),
  ) as Record<ProductCardModelType, ProductCardModelSlotDiagnostics>;

  const byScenario: Partial<Record<ProductCardScenarioKey, ProductCardModelSlotDiagnostics>> =
    {};
  for (const s of slots) {
    if (s.scenarioKey) byScenario[s.scenarioKey] = s;
  }

  return { slots, byType, byScenario };
}
