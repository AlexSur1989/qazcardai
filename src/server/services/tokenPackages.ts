
import type { UserTokenPackageStatus } from "@/generated/prisma/enums";
import { Prisma, type TokenPackage } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { applyPurchaseInTransaction } from "@/server/services/credits";
import { listActiveTokenPackagesForBilling } from "@/server/services/token-packages-catalog";

export { listActiveTokenPackagesForBilling as getActiveTokenPackages };

const COMPLETED: UserTokenPackageStatus = "COMPLETED";

type Tx = Prisma.TransactionClient;

/**
 * Idempotent: РїСЂРё С‚РѕРј Р¶Рµ paymentId Р·Р°РїРёСЃСЊ РЅРµ РґСѓР±Р»РёСЂСѓРµС‚СЃСЏ (РґР»СЏ РїРѕРІС‚РѕСЂРѕРІ webhook).
 */
export async function createUserTokenPackageInTransaction(
  tx: Tx,
  args: {
    userId: string;
    packageId: string;
    paymentId: string | null;
    packageName: string;
    priceKzt: number;
    baseTokens: number;
    bonusTokens: number;
    totalTokens: number;
    status: UserTokenPackageStatus;
  },
): Promise<void> {
  if (args.paymentId) {
    const existing = await tx.userTokenPackage.findFirst({
      where: { paymentId: args.paymentId },
    });
    if (existing) return;
  }
  await tx.userTokenPackage.create({
    data: {
      userId: args.userId,
      packageId: args.packageId,
      paymentId: args.paymentId,
      packageName: args.packageName,
      priceKzt: args.priceKzt,
      baseTokens: args.baseTokens,
      bonusTokens: args.bonusTokens,
      totalTokens: args.totalTokens,
      status: args.status,
    },
  });
}

/**
 * РќР°С‡РёСЃР»РµРЅРёРµ С‚РѕРєРµРЅРѕРІ + CreditTransaction + UserTokenPackage (РїРѕСЃР»Рµ РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅРѕРіРѕ РїР»Р°С‚РµР¶Р°).
 */
export async function purchaseTokenPackageInTransaction(
  tx: Tx,
  args: {
    userId: string;
    paymentId: string;
    credits: number;
    reason: string;
    pkg: TokenPackage;
  },
): Promise<void> {
  const { userId, paymentId, credits, reason, pkg } = args;
  const total = pkg.baseTokens + pkg.bonusTokens;
  if (total !== credits) {
    throw new Error("mismatch: package tokens vs payment credits");
  }
  await applyPurchaseInTransaction(tx, {
    userId,
    credits,
    paymentId,
    reason,
  });
  await createUserTokenPackageInTransaction(tx, {
    userId,
    packageId: pkg.id,
    paymentId,
    packageName: pkg.name,
    priceKzt: pkg.priceKzt,
    baseTokens: pkg.baseTokens,
    bonusTokens: pkg.bonusTokens,
    totalTokens: total,
    status: COMPLETED,
  });
}

export const purchaseTokenPackage = purchaseTokenPackageInTransaction;

export async function getUserLastTokenPackage(userId: string) {
  return prisma.userTokenPackage.findFirst({
    where: { userId, status: "COMPLETED" },
    orderBy: { purchasedAt: "desc" },
  });
}

export async function getUserTokenPackageHistory(userId: string, take = 100) {
  return prisma.userTokenPackage.findMany({
    where: { userId },
    orderBy: { purchasedAt: "desc" },
    take: Math.min(take, 200),
  });
}

/**
 * Р СѓС‡РЅРѕРµ РЅР°С‡РёСЃР»РµРЅРёРµ: Р±Р°Р»Р°РЅСЃ, PURCHASE, UserTokenPackage, AdminAuditLog РІ РѕРґРЅРѕР№ С‚СЂР°РЅР·Р°РєС†РёРё.
 */
export async function grantTokenPackageToUser(args: {
  userId: string;
  packageId: string;
  adminUserId: string;
}): Promise<{ newBalance: number }> {
  const { userId, packageId, adminUserId } = args;

  return prisma.$transaction(async (tx) => {
    const pkg = await tx.tokenPackage.findUnique({ where: { id: packageId } });
    if (!pkg) {
      throw new Error("PACKAGE_NOT_FOUND");
    }
    if (!pkg.isActive) {
      throw new Error("PACKAGE_INACTIVE");
    }
    const total = pkg.baseTokens + pkg.bonusTokens;
    if (total <= 0) {
      throw new Error("INVALID_TOKENS");
    }
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { balanceCredits: { increment: total } },
      select: { balanceCredits: true },
    });
    const reason = `Token package purchase: ${pkg.name}`.slice(0, 512);
    await tx.creditTransaction.create({
      data: {
        userId,
        type: "PURCHASE",
        amount: total,
        reason,
        metadata: {
          source: "admin_grant",
          tokenPackageId: pkg.id,
          tokenPackageSlug: pkg.slug,
        } satisfies Prisma.InputJsonObject,
      },
    });
    await createUserTokenPackageInTransaction(tx, {
      userId,
      packageId: pkg.id,
      paymentId: null,
      packageName: pkg.name,
      priceKzt: pkg.priceKzt,
      baseTokens: pkg.baseTokens,
      bonusTokens: pkg.bonusTokens,
      totalTokens: total,
      status: COMPLETED,
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "token_package.manually_granted",
        targetType: "User",
        targetId: userId,
        newValue: {
          tokenPackageId: pkg.id,
          packageName: pkg.name,
          tokens: total,
          newBalance: updated.balanceCredits,
        } as Prisma.InputJsonValue,
      },
    });
    return { newBalance: updated.balanceCredits };
  });
}

export async function getUserTokenPackageHistoryForAdmin(userId: string) {
  return prisma.userTokenPackage.findMany({
    where: { userId },
    orderBy: { purchasedAt: "desc" },
    take: 200,
    include: {
      payment: { select: { id: true, provider: true, status: true } },
    },
  });
}
