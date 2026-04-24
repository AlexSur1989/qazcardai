import type { CreditTransactionType } from "@/generated/prisma/enums";

export function creditTypeLabel(t: CreditTransactionType): string {
  const m: Record<CreditTransactionType, string> = {
    PURCHASE: "Покупка",
    RESERVE: "Резерв",
    CAPTURE: "Списание",
    REFUND: "Возврат",
    ADMIN_ADJUSTMENT: "Админ",
    PROMO: "Промо",
  };
  return m[t] ?? t;
}
