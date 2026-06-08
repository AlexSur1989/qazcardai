import { prisma } from "@/lib/prisma";
import { labelProductCardModelType } from "@/lib/product-card-model-type-labels";
import {
  defaultSlugForProductCardType,
  getProductCardSettings,
  type ProductCardModelType,
  type ProductCardScenarioKey,
} from "@/server/services/productCardSettings";

export type ProductCardModelSlotStatus =
  | "ready"
  | "missing_assignment"
  | "missing_model"
  | "inactive"
  | "wrong_scope";

export type ProductCardModelSlotDiagnostics = {
  productCardModelType: ProductCardModelType;
  scenarioKey: ProductCardScenarioKey | null;
  label: string;
  appSettingKey: string;
  assignedSlug: string;
  status: ProductCardModelSlotStatus;
  modelId: string | null;
  modelName: string | null;
  modelSlug: string | null;
  adminHint: string;
  /** Можно запускать AI-генерацию для сценария */
  generationReady: boolean;
  /** Автоклассификация доступна (только classifier) */
  autoClassifyReady: boolean;
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

function buildAdminHint(args: {
  status: ProductCardModelSlotStatus;
  productCardModelType: ProductCardModelType;
  appSettingKey: string;
  assignedSlug: string;
  modelSlug: string | null;
}): string {
  const typeLabel = labelProductCardModelType(args.productCardModelType);
  switch (args.status) {
    case "ready":
      return `Модель «${args.modelSlug}» активна и назначена.`;
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
          },
        })
      : [];

  const bySlug = new Map(models.map((m) => [m.slug, m]));

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

    if (assignedSlug) {
      const row = bySlug.get(assignedSlug);
      if (!row) {
        status = "missing_model";
        modelSlug = assignedSlug;
      } else if (row.scope !== "PRODUCT_CARD") {
        status = "wrong_scope";
        modelId = row.id;
        modelName = row.name;
        modelSlug = row.slug;
      } else if (row.productCardModelType !== def.productCardModelType) {
        status = "wrong_scope";
        modelId = row.id;
        modelName = row.name;
        modelSlug = row.slug;
      } else if (row.type !== expectedType(def.productCardModelType)) {
        status = "wrong_scope";
        modelId = row.id;
        modelName = row.name;
        modelSlug = row.slug;
      } else if (!row.isActive) {
        status = "inactive";
        modelId = row.id;
        modelName = row.name;
        modelSlug = row.slug;
      } else {
        status = "ready";
        modelId = row.id;
        modelName = row.name;
        modelSlug = row.slug;
      }
    }

    const generationReady = status === "ready";
    const autoClassifyReady =
      def.productCardModelType === "PRODUCT_CLASSIFIER" && generationReady;

    return {
      productCardModelType: def.productCardModelType,
      scenarioKey: def.scenarioKey,
      label,
      appSettingKey: def.appSettingKey,
      assignedSlug,
      status,
      modelId,
      modelName,
      modelSlug,
      adminHint: buildAdminHint({
        status,
        productCardModelType: def.productCardModelType,
        appSettingKey: def.appSettingKey,
        assignedSlug,
        modelSlug,
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
