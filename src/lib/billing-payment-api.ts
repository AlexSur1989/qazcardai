import type { PaymentStatus } from "@/generated/prisma/enums";

/** Публичный статус для API оплаты Kaspi (SUCCESS вместо COMPLETED). */
export function paymentStatusForBillingApi(status: PaymentStatus): string {
  if (status === "COMPLETED") return "SUCCESS";
  return status;
}
