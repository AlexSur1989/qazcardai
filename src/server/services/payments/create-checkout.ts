import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { getCreditPackageById } from "@/lib/credit-packages";
import { prisma } from "@/lib/prisma";

import { createStripeCheckoutSession } from "./stripe";
import type { CreateCheckoutResult } from "./types";

/**
 * Создаёт Payment (PENDING) и Stripe Checkout. Кредиты начисляются только в webhook.
 */
export async function createStripeCheckoutForUser(
  userId: string,
  userEmail: string | null | undefined,
  packageId: string,
): Promise<CreateCheckoutResult> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: false, error: "not_configured" };
  }
  const pkg = getCreditPackageById(packageId);
  if (!pkg) {
    return { ok: false, error: "package_unavailable" };
  }
  const payment = await prisma.payment.create({
    data: {
      userId,
      provider: "stripe",
      amount: pkg.amountDecimal,
      currency: pkg.currency,
      credits: pkg.credits,
      status: "PENDING",
      metadata: {
        packageId: pkg.id,
        stripePriceId: pkg.stripePriceId,
        envKey: pkg.stripePriceEnvKey,
      } satisfies Prisma.InputJsonObject,
    },
  });
  const { url } = await createStripeCheckoutSession({
    paymentId: payment.id,
    userId,
    userEmail,
    credits: pkg.credits,
    packageId: pkg.id,
    stripePriceId: pkg.stripePriceId,
  });
  return { ok: true, url };
}
