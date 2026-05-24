import type { PaymentStatus } from "@/generated/prisma/enums";

/** Пользовательские подписи статуса ручной заявки (без технических терминов). */
export function manualPaymentUserStatusLabel(
  status: PaymentStatus,
  expired?: boolean,
): string {
  if (expired && (status === "PENDING" || status === "PROCESSING")) {
    return "Истекло";
  }
  switch (status) {
    case "PENDING":
    case "PROCESSING":
      return "Ожидает проверки";
    case "COMPLETED":
      return "Подтверждено";
    case "FAILED":
      return "Отклонено";
    case "CANCELLED":
      return "Отменено";
    case "REFUNDED":
      return "Возврат";
    default:
      return "Неизвестно";
  }
}

export function manualPaymentContactChannelLabel(channel: string | null | undefined): string {
  if (channel === "whatsapp") return "WhatsApp";
  return "Kaspi перевод";
}
