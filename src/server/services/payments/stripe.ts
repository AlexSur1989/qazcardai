import "server-only";

import Stripe from "stripe";

import { getAppBaseUrl } from "@/lib/payment-config";

let stripeClient: Stripe | null = null;

function getSecretKey(): string {
  const k = process.env.STRIPE_SECRET_KEY?.trim();
  if (!k) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return k;
}

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(getSecretKey());
  }
  return stripeClient;
}

export async function createStripeCheckoutSession(args: {
  paymentId: string;
  userId: string;
  userEmail: string | null | undefined;
  credits: number;
  packageId: string;
  name: string;
  description: string | null;
  /** Сумма в тенге (KZT, zero-decimal в Stripe). */
  priceKzt: number;
}): Promise<{ url: string }> {
  const base = getAppBaseUrl();
  const stripe = getStripeClient();
  const desc = args.description?.trim();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "kzt",
          product_data: {
            name: args.name,
            ...(desc ? { description: desc.slice(0, 500) } : {}),
          },
          unit_amount: args.priceKzt,
        },
        quantity: 1,
      },
    ],
    success_url: `${base}/dashboard/billing?checkout=success`,
    cancel_url: `${base}/dashboard/billing?checkout=cancel`,
    client_reference_id: args.paymentId,
    metadata: {
      paymentId: args.paymentId,
      userId: args.userId,
      credits: String(args.credits),
      packageId: args.packageId,
    },
    ...(args.userEmail ? { customer_email: args.userEmail } : {}),
  });
  if (!session.url) {
    throw new Error("Stripe: empty checkout URL");
  }
  return { url: session.url };
}
