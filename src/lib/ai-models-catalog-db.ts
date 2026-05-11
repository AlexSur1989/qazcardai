import { Prisma } from "@/generated/prisma/client";

/**
 * Каталог «AI модели» в кабинете: только обычные генерации, без product-card моделей.
 */
export function prismaWhereForDashboardModelsCatalog(): Prisma.AiModelWhereInput {
  return {
    scope: "GENERAL",
    isActive: true,
    isPublic: true,
    productCardModelType: null,
  };
}
