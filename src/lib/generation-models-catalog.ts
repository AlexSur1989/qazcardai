import type { AiModelProvider, GenerationType } from "@/generated/prisma/enums";

import {
  GENERATION_MODEL_CATALOG,
  type CatalogModelDefinition,
  type GenerationModelCategory,
  type GenerationTaskId,
  TASK_LABELS_RU,
} from "@/config/generation-models";

export type AiModelCatalogRow = {
  id: string;
  name: string;
  slug: string;
  provider: AiModelProvider;
  type: GenerationType;
  scope: string;
  /** Заполнен для моделей карточки товара — не должны висеть в общем каталоге */
  productCardModelType: string | null;
  costCredits: number;
  /** Минимум для отображения «от N», сервер (= getCreditsUiFloor), иначе costCredits */
  creditsUiMin?: number;
  description: string | null;
  isActive: boolean;
  supportsImageInput: boolean;
  supportsVideoInput: boolean;
};

export type MergedCatalogModelCard = {
  catalogSlug: string;
  displayName: string;
  providerLabel: string;
  description: string;
  tasks: GenerationTaskId[];
  category: GenerationModelCategory;
  costCreditsMin: number | null;
  dbSlug: string | null;
  isActiveInDb: boolean;
  hasDbMatch: boolean;
  openHref: string;
  status: "active" | "disabled" | "coming_soon";
  detailHref: string;
  gradientClass: string;
  /** См. CatalogModelDefinition.hideFromModelsCatalog */
  hideFromModelsCatalog: boolean;
};

export function providerToLabel(provider: AiModelProvider): string {
  if (provider === "KIE_AI") {
    return "Kie.ai";
  }
  return "Провайдер";
}

export function inferTasksFromDbModel(row: AiModelCatalogRow): GenerationTaskId[] {
  if (row.type === "VIDEO") {
    if (row.slug === "veo-get-4k-video" || row.slug === "veo-get-1080p-video") {
      return ["video_editing"];
    }
    if (row.slug === "veo-extend") {
      return ["video_to_video", "video_editing"];
    }
  }

  const tasks: GenerationTaskId[] = [];
  if (row.type === "IMAGE") {
    tasks.push("text_to_image");
    if (row.supportsImageInput) {
      tasks.push("image_to_image", "image_editing");
    }
  } else {
    tasks.push("text_to_video");
    if (row.supportsImageInput) {
      tasks.push("image_to_video");
    }
    if (row.supportsVideoInput) {
      tasks.push("video_to_video", "video_editing");
      tasks.push("lip_sync");
    }
  }
  return tasks;
}

function buildGeneratorHref(kind: "image" | "video", urlSlug: string): string {
  const base =
    kind === "image"
      ? "/dashboard/create/image"
      : "/dashboard/create/video";
  return `${base}?model=${encodeURIComponent(urlSlug)}`;
}

function resolveOpenHref(
  def: CatalogModelDefinition,
  row: AiModelCatalogRow | null,
  urlSlugEffective: string,
): string {
  const b = def.openBehavior;
  if (b.kind === "product_card") {
    return "/dashboard/create/product-card";
  }
  if (b.kind === "image") {
    return buildGeneratorHref("image", urlSlugEffective);
  }
  if (b.kind === "video") {
    return buildGeneratorHref("video", urlSlugEffective);
  }
  // detail_only — сначала страница возможностей модели
  return `/dashboard/models/${encodeURIComponent(def.catalogSlug)}`;
}

function resolveDetailHref(catalogSlug: string): string {
  return `/dashboard/models/${encodeURIComponent(catalogSlug)}`;
}

/**
 * Объединяет статический каталог с записями AiModel из БД.
 * Модели из БД без совпадения по slug добавляются в конец как «общий каталог».
 */
export function mergeGenerationCatalog(params: {
  dbModels: AiModelCatalogRow[];
  productFlowMinCredits: number | null;
}): MergedCatalogModelCard[] {
  const { dbModels, productFlowMinCredits } = params;
  const bySlug = new Map(dbModels.map((m) => [m.slug, m]));
  const consumed = new Set<string>();

  const merged: MergedCatalogModelCard[] = [];

  for (const def of GENERATION_MODEL_CATALOG) {
    let row: AiModelCatalogRow | null = null;
    let matchedSlug: string | null = null;
    for (const s of def.dbSlugCandidates) {
      const hit = bySlug.get(s);
      if (hit) {
        row = hit;
        matchedSlug = hit.slug;
        break;
      }
    }

    const slugConsumeList =
      def.familyDbSlugCandidates && def.familyDbSlugCandidates.length > 0
        ? def.familyDbSlugCandidates
        : matchedSlug != null
          ? [matchedSlug]
          : [];
    const multiVariantFamily =
      def.familyDbSlugCandidates != null && def.familyDbSlugCandidates.length > 1;

    for (const s of slugConsumeList) {
      if (bySlug.has(s)) {
        consumed.add(s);
      }
    }

    let urlSlugForOpen: string;
    if (def.urlSlugForGenerator) {
      urlSlugForOpen = def.urlSlugForGenerator;
    } else if (def.openBehavior.kind === "image") {
      urlSlugForOpen = def.openBehavior.querySlug;
    } else if (def.openBehavior.kind === "video") {
      urlSlugForOpen = def.openBehavior.querySlug;
    } else {
      urlSlugForOpen = row?.slug ?? def.catalogSlug;
    }

    const urlSlugEffective = urlSlugForOpen;

    let costMin: number | null = row?.creditsUiMin ?? row?.costCredits ?? null;
    if (multiVariantFamily && def.familyDbSlugCandidates) {
      let floor: number | null = null;
      for (const s of def.familyDbSlugCandidates) {
        const r = bySlug.get(s);
        if (!r?.isActive) continue;
        const c = r.creditsUiMin ?? r.costCredits;
        if (floor == null || c < floor) floor = c;
      }
      if (floor != null) costMin = floor;
    }

    let hasDbMatch = !!row;
    if (multiVariantFamily && def.familyDbSlugCandidates) {
      hasDbMatch = def.familyDbSlugCandidates.some((s) => bySlug.has(s));
    }

    let isActiveInDb = row?.isActive ?? false;
    if (multiVariantFamily && def.familyDbSlugCandidates) {
      isActiveInDb = def.familyDbSlugCandidates.some(
        (s) => bySlug.get(s)?.isActive === true,
      );
    }

    let status: MergedCatalogModelCard["status"] = "coming_soon";

    if (def.openBehavior.kind === "product_card") {
      status = "active";
    } else if (hasDbMatch) {
      status = isActiveInDb ? "active" : "disabled";
    }

    const displayTitle = multiVariantFamily
      ? def.displayName
      : (row?.name ?? def.displayName);
    const displayDescriptionRaw = multiVariantFamily
      ? def.descriptionFallback
      : (row?.description ?? def.descriptionFallback);

    let costCreditsMinEffective = costMin;
    if (def.openBehavior.kind === "product_card") {
      costCreditsMinEffective = productFlowMinCredits;
    }

    merged.push({
      catalogSlug: def.catalogSlug,
      displayName: displayTitle,
      providerLabel: def.providerLabel,
      description: displayDescriptionRaw.trim(),
      tasks: def.tasks,
      category: def.category,
      costCreditsMin: costCreditsMinEffective,
      dbSlug: matchedSlug,
      hasDbMatch,
      isActiveInDb,
      openHref: resolveOpenHref(def, row, String(urlSlugEffective)),
      detailHref: resolveDetailHref(def.catalogSlug),
      status,
      gradientClass: def.gradientClass,
      hideFromModelsCatalog: def.hideFromModelsCatalog === true,
    });
  }

  for (const row of dbModels) {
    if (
      row.scope !== "GENERAL" ||
      row.productCardModelType != null ||
      consumed.has(row.slug)
    ) {
      continue;
    }
    const tasks = inferTasksFromDbModel(row);
    const openHref =
      row.type === "IMAGE"
        ? buildGeneratorHref("image", row.slug)
        : buildGeneratorHref("video", row.slug);

    merged.push({
      catalogSlug: row.slug,
      displayName: row.name,
      providerLabel: providerToLabel(row.provider),
      description: row.description ?? "",
      tasks,
      category: row.type === "IMAGE" ? "image" : "video",
      costCreditsMin: row.creditsUiMin ?? row.costCredits,
      dbSlug: row.slug,
      hasDbMatch: true,
      isActiveInDb: row.isActive,
      openHref,
      detailHref: resolveDetailHref(row.slug),
      status: row.isActive ? "active" : "disabled",
      gradientClass:
        row.type === "IMAGE"
          ? "from-slate-500/80 via-sky-600/78 to-blue-900/85"
          : "from-indigo-500/82 via-purple-600/78 to-violet-900/85",
      hideFromModelsCatalog: false,
    });
  }

  merged.sort((a, b) => {
    const byCat = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (byCat !== 0) return byCat;
    return a.displayName.localeCompare(b.displayName, "ru");
  });

  return merged;
}

/** Карточки для списка /dashboard/models (без сценариев только для карточки товара). */
export function visibleInModelsCatalog(
  merged: MergedCatalogModelCard[],
): MergedCatalogModelCard[] {
  return merged.filter((m) => !m.hideFromModelsCatalog);
}

const CATEGORY_ORDER: Record<GenerationModelCategory, number> = {
  image: 0,
  product_card: 1,
  video: 2,
  chat: 3,
};

export function matchesTaskFilter(card: MergedCatalogModelCard, filters: GenerationTaskId[]) {
  if (filters.length === 0) return true;
  return filters.some((tid) => card.tasks.includes(tid));
}

/** Поиск по названию, провайдеру, описанию, slug, задачам (RU). */
export function matchesSearchQuery(card: MergedCatalogModelCard, q: string) {
  if (!q.trim()) return true;
  const n = q.trim().toLowerCase();
  const hay = [
    card.displayName,
    card.providerLabel,
    card.description,
    card.catalogSlug,
    card.dbSlug ?? "",
    ...card.tasks.map((t) => TASK_LABELS_RU[t]),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(n);
}
