import { parseProjectResultRefs } from "@/lib/product-card-project-results";

export type ProductCardProjectListRow = {
  id: string;
  title: string | null;
  sourceImageUrl: string | null;
  sourceImages?: unknown;
  metadata?: unknown;
  updatedAt: Date | string;
  createdAt: Date | string;
};

export function getProductDisplayTitle(project: {
  title?: string | null;
  metadata?: unknown;
}): string {
  const direct = project.title?.trim();
  if (direct) return direct;

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const classifierResult = meta.classifierResult;
  if (
    classifierResult &&
    typeof classifierResult === "object" &&
    !Array.isArray(classifierResult) &&
    typeof (classifierResult as { productTitle?: unknown }).productTitle === "string"
  ) {
    const t = (classifierResult as { productTitle: string }).productTitle.trim();
    if (t) return t;
  }

  const marketplaceCard = meta.marketplaceCard;
  if (marketplaceCard && typeof marketplaceCard === "object" && !Array.isArray(marketplaceCard)) {
    const simpleCard = (marketplaceCard as Record<string, unknown>).simpleCard;
    if (simpleCard && typeof simpleCard === "object" && !Array.isArray(simpleCard)) {
      const settings = (simpleCard as Record<string, unknown>).settings;
      if (settings && typeof settings === "object" && !Array.isArray(settings)) {
        const label = (settings as { productLabel?: unknown }).productLabel;
        if (typeof label === "string" && label.trim()) return label.trim();
      }
    }
  }

  return "Товар без названия";
}

export function getProductMainImageUrl(project: {
  sourceImageUrl?: string | null;
  sourceImages?: unknown;
}): string | null {
  const direct = project.sourceImageUrl?.trim();
  if (direct) return direct;

  if (Array.isArray(project.sourceImages)) {
    for (const img of project.sourceImages) {
      if (img && typeof img === "object" && "url" in img) {
        const url = (img as { url: unknown }).url;
        if (typeof url === "string" && url.trim()) return url.trim();
      }
    }
  }

  return null;
}

export function countProductResults(metadata: unknown): {
  cards: number;
  concepts: number;
  videos: number;
  total: number;
} {
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const { cards, concepts, videos } = parseProjectResultRefs(meta);
  return {
    cards: cards.length,
    concepts: concepts.length,
    videos: videos.length,
    total: cards.length + concepts.length + videos.length,
  };
}

export function formatProductUpdatedAt(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
