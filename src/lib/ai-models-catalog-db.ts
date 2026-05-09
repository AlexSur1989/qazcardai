import { GENERATION_MODEL_CATALOG } from "@/config/generation-models";
import { Prisma } from "@/generated/prisma/client";

/** Выборка записей AiModel для каталога в кабинете (без пустого `in: []`). */
export function prismaWhereForDashboardModelsCatalog(): Prisma.AiModelWhereInput {
  const slugNeedle = [
    ...new Set(GENERATION_MODEL_CATALOG.flatMap((c) => c.dbSlugCandidates)),
  ].filter((s): s is string => typeof s === "string" && s.length > 0);

  if (slugNeedle.length === 0) {
    return { scope: "GENERAL", productCardModelType: null };
  }

  return {
    OR: [
      /** Без роли карточки товара — иначе «общие» генераторы путаются с PRODUCT_* */
      { scope: "GENERAL", productCardModelType: null },
      { scope: "PRODUCT_CARD", slug: { in: slugNeedle } },
    ],
  };
}
