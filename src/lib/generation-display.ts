import type { GenerationStatus, GenerationType } from "@/generated/prisma/enums";
import { CARD_BUILDER_MARKETPLACES } from "@/config/card-builder-config";
import { getPublicProductCategories } from "@/config/product-card-categories";
import { getFirstOutputPreviewUrl, parseOutputFilesList } from "@/lib/generation-output-utils";
import { sanitizeUserFacingErrorMessage } from "@/lib/user-facing-copy";

function asRecord(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readString(meta: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function getProductCardTab(meta: Record<string, unknown>): string | null {
  const nested = asRecord(meta.productCard);
  return (
    readString(meta, "tab") ??
    readString(nested, "tab") ??
    readString(meta, "productCardTab") ??
    null
  );
}

function getProjectId(meta: Record<string, unknown>): string | null {
  return readString(meta, "projectId") ?? readString(asRecord(meta.productCard), "projectId");
}

/** Человекочитаемый сценарий Product Card / card_builder. */
export function getUserFacingScenarioLabel(metadata: unknown): string | null {
  const meta = asRecord(metadata);
  const scenarioKey = readString(meta, "scenarioKey");
  if (scenarioKey === "card_builder") return "Создать карточку";

  const tab = getProductCardTab(meta);
  if (tab === "card_builder") return "Создать карточку";
  if (tab === "marketplace_card") return "Карточка товара";
  if (tab === "concept_photo") return "Фото с концепциями";
  if (tab === "video") return "Видео товара";

  if (readString(meta, "flow") === "product_card") {
    return "Карточка товара";
  }
  return null;
}

const SLIDE_ROLE_LABELS: Record<string, string> = {
  main_photo: "Главное фото",
  benefits_infographic: "Преимущества",
  detail_closeup: "Детали",
  materials: "Материалы",
  dimensions: "Размеры",
  lifestyle: "Lifestyle",
  premium_poster: "Постер",
  ad_banner: "Рекламный баннер",
  package: "Упаковка / комплект",
};

/** Человекочитаемый тип слайда card_builder. */
export function getUserFacingSlideLabel(
  slideRole: string | null | undefined,
): string | null {
  if (!slideRole?.trim()) return null;
  const key = slideRole.trim();
  return SLIDE_ROLE_LABELS[key] ?? key.replace(/_/g, " ");
}

/** Маркетплейс из metadata (id → подпись). */
export function getUserFacingMarketplaceLabel(
  marketplace: string | null | undefined,
): string | null {
  if (!marketplace?.trim()) return null;
  const id = marketplace.trim();
  const found = CARD_BUILDER_MARKETPLACES.find((m) => m.id === id);
  return found?.label ?? id.replace(/_/g, " ");
}

/** Статус генерации для пользователя. */
export function getUserFacingGenerationStatus(
  status: GenerationStatus,
): string {
  switch (status) {
    case "CREATED":
    case "QUEUED":
      return "Ожидает";
    case "PROCESSING":
      return "Генерируется";
    case "COMPLETED":
      return "Готово";
    case "FAILED":
    case "BLOCKED":
    case "CANCELLED":
      return "Ошибка";
    case "REFUNDED":
      return "Токены возвращены";
    default:
      return status;
  }
}

/** Статус из API / локального прогресса (строка). */
export function getUserFacingGenerationStatusFromRaw(
  status: string | null | undefined,
): string {
  if (!status?.trim()) return "—";
  const raw = status.trim();
  const upper = raw.toUpperCase() as GenerationStatus;
  const known: GenerationStatus[] = [
    "CREATED",
    "QUEUED",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
    "BLOCKED",
    "CANCELLED",
    "REFUNDED",
  ];
  if (known.includes(upper)) {
    return getUserFacingGenerationStatus(upper);
  }
  const lower = raw.toLowerCase();
  if (lower === "done" || lower === "готово") return "Готово";
  if (lower === "queued" || lower === "в очереди") return "Ожидает";
  if (lower === "generating" || lower === "генерация") return "Генерируется";
  if (lower === "error" || lower === "ошибка") return "Ошибка";
  return raw;
}

/** Тип генерации без провайдера / slug. */
export function getUserFacingGenerationKindLabel(
  type: GenerationType,
  metadata: unknown,
): string {
  const scenario = getUserFacingScenarioLabel(metadata);
  if (scenario === "Создать карточку") return "Генерация слайда";
  if (scenario === "Карточка товара") return "Генерация карточки";
  if (scenario === "Фото с концепциями") return "AI изображение";
  if (scenario === "Видео товара") return "AI видео";
  return type === "IMAGE" ? "AI изображение" : "AI видео";
}

function getCategoryLabel(metadata: unknown): string | null {
  const meta = asRecord(metadata);
  const id =
    readString(meta, "selectedCategory") ??
    readString(asRecord(meta.cardBuilderSettingsSnapshot), "selectedCategory");
  if (!id) return null;
  const cat = getPublicProductCategories().find((c) => c.id === id);
  return cat?.label ?? id;
}

function getSlideRoleFromMeta(meta: Record<string, unknown>): string | null {
  return (
    readString(meta, "slideRole") ??
    readString(meta, "cardBuilderSlideRole") ??
    readString(meta, "imageRole")
  );
}

function buildListTitle(
  type: GenerationType,
  metadata: unknown,
  slideLabel: string | null,
): string {
  const scenario = getUserFacingScenarioLabel(metadata);
  if (scenario) {
    if (slideLabel) return `${scenario} · ${slideLabel}`;
    return scenario;
  }
  return getUserFacingGenerationKindLabel(type, metadata);
}

function buildListSubtitle(metadata: unknown): string | null {
  const meta = asRecord(metadata);
  const marketplace = getUserFacingMarketplaceLabel(readString(meta, "marketplace"));
  if (marketplace) return `Маркетплейс: ${marketplace}`;
  const galleryTitle = readString(meta, "gallerySlideTitle");
  if (galleryTitle) return galleryTitle;
  return getCategoryLabel(metadata);
}

export function mapGenerationErrorToUserMessage(
  errorMessage: string | null | undefined,
  metadata?: unknown,
): string | null {
  const meta = asRecord(metadata);
  const code = (
    readString(meta, "code") ??
    readString(meta, "errorCode") ??
    readString(asRecord(meta.priceHint), "code") ??
    ""
  ).toUpperCase();

  if (code === "PRICE_CHANGED") {
    return "Стоимость изменилась. Обновите оценку и запустите снова.";
  }
  if (code === "PLAN_CHANGED") {
    return "Структура карточки изменилась. Обновите оценку.";
  }

  const raw = errorMessage?.trim();
  if (!raw) return null;

  if (/PRICE_CHANGED|стоимость изменилась/i.test(raw)) {
    return "Стоимость изменилась. Обновите оценку и запустите снова.";
  }
  if (/PLAN_CHANGED|структур/i.test(raw)) {
    return "Структура карточки изменилась. Обновите оценку.";
  }
  if (/timeout|timed\s*out|заняла слишком/i.test(raw)) {
    return "Генерация заняла слишком много времени. Попробуйте ещё раз.";
  }
  if (/moderation|blocked|MODERATION|проверк/i.test(raw)) {
    return "Запрос не прошёл проверку. Измените текст или изображение.";
  }
  if (
    /KIE_AI|kie\.ai|providerTaskId|apiModelId|payload|modelSlug|endpoint|queue job/i.test(
      raw,
    )
  ) {
    return "Не удалось создать результат. Попробуйте позже.";
  }
  if (/\b(500|502|503|504)\b|provider|upstream/i.test(raw)) {
    return "Не удалось создать результат. Попробуйте позже.";
  }

  if (raw.length > 280) {
    return sanitizeUserFacingErrorMessage(`${raw.slice(0, 280)}…`) ?? `${raw.slice(0, 280)}…`;
  }
  return sanitizeUserFacingErrorMessage(raw) ?? raw;
}

export function getUserFacingRepeatHref(input: {
  id: string;
  type: GenerationType;
  metadata: unknown;
  modelId: string;
}): string | null {
  const meta = asRecord(input.metadata);
  const projectId = getProjectId(meta);
  if (readString(meta, "flow") === "product_card" && projectId) {
    return "/dashboard/create/product-card";
  }
  const path =
    input.type === "IMAGE" ? "/dashboard/create/image" : "/dashboard/create/video";
  const p = new URLSearchParams();
  p.set("modelId", input.modelId);
  return `${path}?${p.toString()}`;
}

export function getUserFacingVideoSourceHref(input: {
  id: string;
  type: GenerationType;
  status: GenerationStatus;
  metadata: unknown;
  hasOutput: boolean;
}): string | null {
  if (input.type !== "IMAGE" || input.status !== "COMPLETED" || !input.hasOutput) {
    return null;
  }
  const meta = asRecord(input.metadata);
  if (readString(meta, "flow") !== "product_card") return null;
  const tab = getProductCardTab(meta);
  if (
    tab !== "concept_photo" &&
    tab !== "marketplace_card" &&
    tab !== "card_builder"
  ) {
    return null;
  }
  return `/dashboard/create/product-card?videoSource=${encodeURIComponent(input.id)}`;
}

export type UserFacingHistoryListItem = {
  id: string;
  type: GenerationType;
  status: GenerationStatus;
  title: string;
  subtitle: string | null;
  scenarioLabel: string | null;
  slideLabel: string | null;
  marketplaceLabel: string | null;
  statusLabel: string;
  kindLabel: string;
  costCredits: number;
  createdAt: Date;
  previewUrl: string | null;
  canDownload: boolean;
  downloadUrl: string | null;
  productCardProjectId: string | null;
  repeatHref: string | null;
  videoSourceHref: string | null;
  /** Для повтора без промпта в URL */
  modelId: string;
};

export type UserFacingGenerationDetail = {
  id: string;
  type: GenerationType;
  status: GenerationStatus;
  title: string;
  subtitle: string | null;
  scenarioLabel: string | null;
  slideLabel: string | null;
  slidePurpose: string | null;
  marketplaceLabel: string | null;
  categoryLabel: string | null;
  statusLabel: string;
  kindLabel: string;
  costCredits: number;
  createdAt: Date;
  completedAt: Date | null;
  previewUrl: string | null;
  finalUrl: string | null;
  downloadUrl: string | null;
  outputFiles: { url: string | null; kind?: string }[];
  errorMessage: string | null;
  productCardProjectId: string | null;
  repeatHref: string | null;
  videoSourceHref: string | null;
  canDownloadIndices: number[];
};

type ListRowInput = {
  id: string;
  type: GenerationType;
  status: GenerationStatus;
  costCredits: number;
  createdAt: Date;
  outputFiles: unknown;
  metadata: unknown;
  model: { id: string };
};

type DetailRowInput = ListRowInput & {
  completedAt: Date | null;
  errorMessage: string | null;
};

export function serializeGenerationListItemForUser(
  row: ListRowInput,
): UserFacingHistoryListItem {
  const meta = asRecord(row.metadata);
  const slideRole = getSlideRoleFromMeta(meta);
  const slideLabel = getUserFacingSlideLabel(slideRole);
  const scenarioLabel = getUserFacingScenarioLabel(row.metadata);
  const marketplaceLabel = getUserFacingMarketplaceLabel(readString(meta, "marketplace"));
  const files = parseOutputFilesList(row.outputFiles);
  const canDownload =
    row.status === "COMPLETED" &&
    files.some((f) => Boolean(f.url?.trim() || f.storageKey));
  const previewUrl = getFirstOutputPreviewUrl(row.outputFiles);
  const downloadUrl = canDownload
    ? `/api/generations/${row.id}/download?index=0`
    : null;

  return {
    id: row.id,
    type: row.type,
    status: row.status,
    title: buildListTitle(row.type, row.metadata, slideLabel),
    subtitle: buildListSubtitle(row.metadata),
    scenarioLabel,
    slideLabel,
    marketplaceLabel,
    statusLabel: getUserFacingGenerationStatus(row.status),
    kindLabel: getUserFacingGenerationKindLabel(row.type, row.metadata),
    costCredits: row.costCredits,
    createdAt: row.createdAt,
    previewUrl,
    canDownload,
    downloadUrl,
    productCardProjectId: getProjectId(meta),
    repeatHref: getUserFacingRepeatHref({
      id: row.id,
      type: row.type,
      metadata: row.metadata,
      modelId: row.model.id,
    }),
    videoSourceHref: getUserFacingVideoSourceHref({
      id: row.id,
      type: row.type,
      status: row.status,
      metadata: row.metadata,
      hasOutput: canDownload,
    }),
    modelId: row.model.id,
  };
}

export function serializeGenerationForUser(row: DetailRowInput): UserFacingGenerationDetail {
  const meta = asRecord(row.metadata);
  const slideRole = getSlideRoleFromMeta(meta);
  const slideLabel = getUserFacingSlideLabel(slideRole);
  const files = parseOutputFilesList(row.outputFiles);
  const canDownloadIndices = files
    .map((f, i) =>
      row.status === "COMPLETED" && (f.url?.trim() || f.storageKey) ? i : -1,
    )
    .filter((i) => i >= 0);
  const previewUrl = getFirstOutputPreviewUrl(row.outputFiles);
  const finalUrl = previewUrl;
  const downloadUrl =
    canDownloadIndices.length > 0
      ? `/api/generations/${row.id}/download?index=${canDownloadIndices[0]}`
      : null;

  return {
    id: row.id,
    type: row.type,
    status: row.status,
    title: buildListTitle(row.type, row.metadata, slideLabel),
    subtitle: buildListSubtitle(row.metadata),
    scenarioLabel: getUserFacingScenarioLabel(row.metadata),
    slideLabel,
    slidePurpose: readString(meta, "gallerySlideTitle"),
    marketplaceLabel: getUserFacingMarketplaceLabel(readString(meta, "marketplace")),
    categoryLabel: getCategoryLabel(row.metadata),
    statusLabel: getUserFacingGenerationStatus(row.status),
    kindLabel: getUserFacingGenerationKindLabel(row.type, row.metadata),
    costCredits: row.costCredits,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    previewUrl,
    finalUrl,
    downloadUrl,
    outputFiles: files.map((f) => ({
      url: f.url?.trim() || null,
      kind: f.kind,
    })),
    errorMessage: mapGenerationErrorToUserMessage(row.errorMessage, row.metadata),
    productCardProjectId: getProjectId(meta),
    repeatHref: getUserFacingRepeatHref({
      id: row.id,
      type: row.type,
      metadata: row.metadata,
      modelId: row.model.id,
    }),
    videoSourceHref: getUserFacingVideoSourceHref({
      id: row.id,
      type: row.type,
      status: row.status,
      metadata: row.metadata,
      hasOutput: canDownloadIndices.length > 0,
    }),
    canDownloadIndices,
  };
}
