
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

export async function getTokenPackageBySlugForCheckout(
  slug: string,
  options?: { requireActive?: boolean },
) {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const requireActive = options?.requireActive ?? true;
  return prisma.tokenPackage.findFirst({
    where: {
      slug: normalized,
      ...(requireActive ? { isActive: true } : {}),
    },
  });
}

export async function listAllTokenPackagesForAdmin() {
  return prisma.tokenPackage.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
