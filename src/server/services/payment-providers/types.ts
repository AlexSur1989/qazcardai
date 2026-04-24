import type { CreateCheckoutResult } from "@/server/services/payments/types";

/**
 * Ключи провайдеров для будущих: YooKassa, CloudPayments, Kaspi Pay.
 * Сейчас реализован только stripe.
 */
export type PaymentCheckoutProviderId = "stripe";

export type CreateCheckoutInput = {
  userId: string;
  userEmail: string | null | undefined;
  packageId: string;
};

export type IPaymentCheckoutProvider = {
  id: PaymentCheckoutProviderId;
  createCheckout: (input: CreateCheckoutInput) => Promise<CreateCheckoutResult>;
};
