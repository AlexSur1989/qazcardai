import "server-only";

import { prisma } from "@/lib/prisma";

export async function listActiveTokenPackagesForBilling() {
  return prisma.tokenPackage.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      priceKzt: true,
      baseTokens: true,
      bonusTokens: true,
      totalTokens: true,
      description: true,
      sortOrder: true,
    },
  });
}

export async function getTokenPackageByIdForCheckout(
  id: string,
  options?: { requireActive?: boolean },
) {
  const requireActive = options?.requireActive ?? true;
  return prisma.tokenPackage.findFirst({
    where: {
      id,
      ...(requireActive ? { isActive: true } : {}),
    },
  });
}

export async function listAllTokenPackagesForAdmin() {
  return prisma.tokenPackage.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
