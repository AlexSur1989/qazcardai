import type { PaymentStatus } from "@/generated/prisma/enums";

export function paymentStatusLabel(s: PaymentStatus): string {
  const m: Record<PaymentStatus, string> = {
    PENDING: "Ожидает",
    PROCESSING: "В обработке",
    COMPLETED: "Оплачен",
    FAILED: "Ошибка",
    REFUNDED: "Возврат",
    CANCELLED: "Отмена",
  };
  return m[s] ?? s;
}
