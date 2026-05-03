
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getTokenPackageByIdForCheckout } from "@/server/services/token-packages-catalog";

import { createStripeCheckoutSession } from "./stripe";
import type { CreateCheckoutResult } from "./types";

/**
 * Создаёт Payment (PENDING) и Stripe Checkout. Токены начисляются только в webhook.
 */
export async function createStripeCheckoutForUser(
  userId: string,
  userEmail: string | null | undefined,
  packageId: string,
): Promise<CreateCheckoutResult> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: false, error: "not_configured" };
  }
  const pkg = await getTokenPackageByIdForCheckout(packageId, {
    requireActive: true,
  });
  if (!pkg) {
    return { ok: false, error: "package_unavailable" };
  }
  const totalTokens = pkg.baseTokens + pkg.bonusTokens;
  if (totalTokens <= 0) {
    return { ok: false, error: "package_unavailable" };
  }
  const payment = await prisma.payment.create({
    data: {
      userId,
      tokenPackageId: pkg.id,
      provider: "stripe",
      amount: new Prisma.Decimal(pkg.priceKzt),
      currency: "kzt",
      credits: totalTokens,
      status: "PENDING",
      metadata: {
        tokenPackageId: pkg.id,
        tokenPackageSlug: pkg.slug,
        priceKzt: pkg.priceKzt,
        baseTokens: pkg.baseTokens,
        bonusTokens: pkg.bonusTokens,
        totalTokens,
      } satisfies Prisma.InputJsonObject,
    },
  });
  const { url } = await createStripeCheckoutSession({
    paymentId: payment.id,
    userId,
    userEmail,
    credits: totalTokens,
    packageId: pkg.id,
    name: pkg.name,
    description: pkg.description,
    priceKzt: pkg.priceKzt,
  });
  return { ok: true, url };
}
