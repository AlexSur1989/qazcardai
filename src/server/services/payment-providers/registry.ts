import "server-only";

import { createStripeCheckoutForUser } from "@/server/services/payments/create-checkout";

import type { CreateCheckoutInput, IPaymentCheckoutProvider } from "./types";

const stripeProvider: IPaymentCheckoutProvider = {
  id: "stripe",
  createCheckout: (input) =>
    createStripeCheckoutForUser(input.userId, input.userEmail, input.packageId),
};

const providers: Record<string, IPaymentCheckoutProvider> = {
  stripe: stripeProvider,
};

export function getPaymentCheckoutProvider(
  id: string,
): IPaymentCheckoutProvider | undefined {
  return providers[id];
}

export { stripeProvider };
