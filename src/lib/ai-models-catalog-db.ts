import { GENERATION_MODEL_CATALOG } from "@/config/generation-models";
import { Prisma } from "@/generated/prisma/client";

/** Выборка записей AiModel для каталога в кабинете (без пустого `in: []`). */
export function prismaWhereForDashboardModelsCatalog(): Prisma.AiModelWhereInput {
  const slugNeedle = [
    ...new Set(GENERATION_MODEL_CATALOG.flatMap((c) => c.dbSlugCandidates)),
  ].filter((s): s is string => typeof s === "string" && s.length > 0);

  if (slugNeedle.length === 0) {
    return { scope: "GENERAL" };
  }

  return {
    OR: [
      { scope: "GENERAL" },
      { scope: "PRODUCT_CARD", slug: { in: slugNeedle } },
    ],
  };
}
