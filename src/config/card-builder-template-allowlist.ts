import type { ProductCardMarketplaceProfile } from "@/config/product-card-marketplace-profiles";
import type { PlannerBucket } from "@/config/card-builder-planner-bucket";
import {
  inferPlannerBucket,
  type GallerySequenceInput,
} from "@/config/card-builder-planner-bucket";
import {
  type CardBuilderTemplateDefinition,
  getCardBuilderTemplate,
  listTemplatesForSlideRole,
  type CardBuilderTemplateSlideRole,
} from "@/config/card-builder-templates";

/** Есть хотя бы одна цифра в поле размеров — можно схемы с цифрами; иначе только масштаб без выдумывания. */
export function hasUserDimensionMeasures(dimensions?: string | null): boolean {
  const d = dimensions?.trim() ?? "";
  if (!d) return false;
  return /\d/.test(d);
}

export type GetAllowedTemplatesForSlideArgs = {
  categoryKey: string;
  marketplaceProfile: ProductCardMarketplaceProfile;
  imageRole: CardBuilderTemplateSlideRole;
  currentTemplateId?: string;
  hasConcreteDimensions: boolean;
  mustShowScale: boolean;
};

function profileAllowsRole(
  profile: ProductCardMarketplaceProfile,
  role: CardBuilderTemplateSlideRole,
): boolean {
  return (profile.allowedSlideTypes as readonly string[]).includes(role);
}

function allowSetForRole(
  bucket: PlannerBucket,
  role: CardBuilderTemplateSlideRole,
  hasDims: boolean,
  mustScale: boolean,
): Set<string> | null {
  switch (role) {
    case "detail_closeup": {
      if (bucket === "gadgets") {
        return new Set(["interface_detail", "feature_callouts", "texture_closeup"]);
      }
      if (bucket === "apparel_clothing") {
        return new Set(["texture_closeup", "fabric_closeup", "feature_callouts"]);
      }
      if (bucket === "footwear") {
        return new Set(["texture_closeup", "fabric_closeup", "feature_callouts"]);
      }
      if (bucket === "beauty" || bucket === "food") {
        return new Set(["texture_closeup", "feature_callouts"]);
      }
      if (bucket === "furniture" || bucket === "jewelry_accessories") {
        return new Set(["texture_closeup", "fabric_closeup", "feature_callouts"]);
      }
      if (bucket === "universal") {
        return new Set(["texture_closeup", "fabric_closeup", "feature_callouts"]);
      }
      return new Set([
        "texture_closeup",
        "fabric_closeup",
        "feature_callouts",
        "interface_detail",
      ]);
    }
    case "materials": {
      if (bucket === "beauty" || bucket === "food") {
        return new Set(["material_focus", "ingredients_effect"]);
      }
      if (bucket === "gadgets" || bucket === "apparel_clothing" || bucket === "footwear") {
        return new Set(["material_focus"]);
      }
      if (bucket === "furniture" || bucket === "jewelry_accessories") {
        return new Set(["material_focus"]);
      }
      return new Set(["material_focus", "ingredients_effect"]);
    }
    case "dimensions": {
      if (hasDims) {
        if (bucket === "food") {
          return new Set(["dimensions_schema", "size_scale"]);
        }
        return new Set(["dimensions_schema", "size_range", "size_scale"]);
      }
      if (mustScale) {
        return new Set(["size_scale"]);
      }
      return new Set(["size_scale"]);
    }
    case "lifestyle": {
      if (bucket === "furniture") {
        return new Set(["interior_lifestyle", "lifestyle_card", "fashion_catalog"]);
      }
      return new Set(["lifestyle_card", "fashion_catalog", "interior_lifestyle"]);
    }
    case "main_photo": {
      if (bucket === "food") {
        return new Set(["hero_clean", "realistic_listing"]);
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Шаблоны для dropdown «Изменить шаблон» и серверных проверок.
 * currentTemplateId: если не входит в allowlist, добавляем в начало списка, чтобы не ломать сохранённый план.
 */
export function getAllowedTemplatesForSlide(
  args: GetAllowedTemplatesForSlideArgs,
): CardBuilderTemplateDefinition[] {
  const seqIn: GallerySequenceInput = { selectedCategory: args.categoryKey.trim() };
  const bucket = inferPlannerBucket(seqIn);
  const allow = allowSetForRole(
    bucket,
    args.imageRole,
    args.hasConcreteDimensions,
    args.mustShowScale,
  );

  const all = listTemplatesForSlideRole(args.imageRole);
  let filtered = allow
    ? all.filter(
        (t) =>
          allow.has(t.templateId) && profileAllowsRole(args.marketplaceProfile, t.slideRole),
      )
    : all.filter((t) => profileAllowsRole(args.marketplaceProfile, t.slideRole));

  const cur = args.currentTemplateId?.trim();
  if (cur) {
    const def = getCardBuilderTemplate(cur);
    if (
      def &&
      def.slideRole === args.imageRole &&
      !filtered.some((x) => x.templateId === cur)
    ) {
      filtered = [def, ...filtered];
    }
  }

  return filtered.sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

export function resolveTemplateWithFallback(
  templateId: string,
  args: Omit<GetAllowedTemplatesForSlideArgs, "currentTemplateId">,
): string {
  const def = getCardBuilderTemplate(templateId);
  if (!def || def.slideRole !== args.imageRole) {
    const allowed = getAllowedTemplatesForSlide({ ...args, currentTemplateId: undefined });
    return allowed[0]?.templateId ?? templateId;
  }
  const allowed = getAllowedTemplatesForSlide({
    ...args,
    imageRole: def.slideRole,
    currentTemplateId: undefined,
  });
  if (allowed.some((t) => t.templateId === templateId)) return templateId;
  return allowed[0]?.templateId ?? templateId;
}
