export type ProjectResultKind = "marketplace_card" | "concept" | "video";

export type ProjectResultRef = {
  key: string;
  kind: ProjectResultKind;
  generationId: string;
  createdAt?: string;
  /** Для кнопки «Использовать для видео» */
  videoSourceType?: "concept_generation" | "marketplace_card_generation";
  duration?: number;
};

function readGenerationId(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("generationId" in value)) return null;
  const g = (value as { generationId: unknown }).generationId;
  return typeof g === "string" && g.trim() ? g.trim() : null;
}

function readCreatedAt(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || !("createdAt" in value)) return undefined;
  const c = (value as { createdAt: unknown }).createdAt;
  return typeof c === "string" && c.trim() ? c.trim() : undefined;
}

function pushUnique(
  target: ProjectResultRef[],
  seen: Set<string>,
  row: ProjectResultRef,
) {
  if (seen.has(row.generationId)) return;
  seen.add(row.generationId);
  target.push(row);
}

/** Ссылки на генерации проекта из JSON metadata (без Prisma migration). */
export function parseProjectResultRefs(metadata: Record<string, unknown>): {
  cards: ProjectResultRef[];
  concepts: ProjectResultRef[];
  videos: ProjectResultRef[];
} {
  const cards: ProjectResultRef[] = [];
  const concepts: ProjectResultRef[] = [];
  const videos: ProjectResultRef[] = [];
  const seenCards = new Set<string>();
  const seenConcepts = new Set<string>();
  const seenVideos = new Set<string>();

  const marketplaceCard = metadata.marketplaceCard;
  if (marketplaceCard && typeof marketplaceCard === "object" && !Array.isArray(marketplaceCard)) {
    const simpleCard = (marketplaceCard as Record<string, unknown>).simpleCard;
    if (simpleCard && typeof simpleCard === "object" && !Array.isArray(simpleCard)) {
      const gens = (simpleCard as Record<string, unknown>).generations;
      if (Array.isArray(gens)) {
        for (const x of gens) {
          const id = readGenerationId(x);
          if (!id) continue;
          pushUnique(
            cards,
            seenCards,
            {
              key: `simple-card-${id}`,
              kind: "marketplace_card",
              generationId: id,
              createdAt: readCreatedAt(x),
              videoSourceType: "marketplace_card_generation",
            },
          );
        }
      }
    }
  }

  const cardBuilder = metadata.cardBuilder;
  if (cardBuilder && typeof cardBuilder === "object" && !Array.isArray(cardBuilder)) {
    const simpleCard = (cardBuilder as Record<string, unknown>).simpleCard;
    if (simpleCard && typeof simpleCard === "object" && !Array.isArray(simpleCard)) {
      const gens = (simpleCard as Record<string, unknown>).generations;
      if (Array.isArray(gens)) {
        for (const x of gens) {
          const id = readGenerationId(x);
          if (!id) continue;
          pushUnique(cards, seenCards, {
            key: `legacy-simple-${id}`,
            kind: "marketplace_card",
            generationId: id,
            createdAt: readCreatedAt(x),
            videoSourceType: "marketplace_card_generation",
          });
        }
      }
    }
  }

  const mList = metadata.marketplaceCardGenerations;
  if (Array.isArray(mList)) {
    for (const x of mList) {
      const id = readGenerationId(x);
      if (!id) continue;
      pushUnique(cards, seenCards, {
        key: `marketplace-${id}`,
        kind: "marketplace_card",
        generationId: id,
        createdAt: readCreatedAt(x),
        videoSourceType: "marketplace_card_generation",
      });
    }
  }

  const cList = metadata.conceptGenerations;
  if (Array.isArray(cList)) {
    for (const x of cList) {
      const id = readGenerationId(x);
      if (!id) continue;
      pushUnique(concepts, seenConcepts, {
        key: `concept-${id}`,
        kind: "concept",
        generationId: id,
        createdAt: readCreatedAt(x),
        videoSourceType: "concept_generation",
      });
    }
  }

  const vList = metadata.videoGenerations;
  if (Array.isArray(vList)) {
    for (const x of vList) {
      const id = readGenerationId(x);
      if (!id) continue;
      const duration =
        x && typeof x === "object" && "duration" in x && typeof (x as { duration: unknown }).duration === "number"
          ? (x as { duration: number }).duration
          : undefined;
      pushUnique(videos, seenVideos, {
        key: `video-${id}`,
        kind: "video",
        generationId: id,
        createdAt: readCreatedAt(x),
        duration,
      });
    }
  }

  const byNewest = (a: ProjectResultRef, b: ProjectResultRef) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  };

  cards.sort(byNewest);
  concepts.sort(byNewest);
  videos.sort(byNewest);

  return { cards, concepts, videos };
}

export function formatProjectResultDate(iso?: string): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const PROJECT_RESULT_KIND_LABEL: Record<ProjectResultKind, string> = {
  marketplace_card: "Карточка товара",
  concept: "Фото с концепциями",
  video: "Видео",
};
