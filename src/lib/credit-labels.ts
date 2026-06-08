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

/** Понятная подпись типа операции для пользователя в биллинге. */
export function creditTransactionUserTypeLabel(
  type: CreditTransactionType,
  reason?: string | null,
): string {
  const r = (reason ?? "").toLowerCase();
  if (type === "RESERVE" && r.includes("карточка товара")) {
    return "Создание карточки товара";
  }
  if (type === "REFUND" && (r.includes("карточка") || r.includes("генерац"))) {
    return "Возврат за неудачную генерацию";
  }
  if (type === "CAPTURE" && r.includes("подтвержден")) {
    return "Подтверждение генерации";
  }
  if (type === "PURCHASE") return "Покупка токенов";
  if (type === "PROMO") return "Промо-начисление";
  if (type === "ADMIN_ADJUSTMENT") return "Корректировка баланса";
  return creditTypeLabel(type);
}

/** Скрыть техническую CAPTURE 0 — пользователь уже видит RESERVE как фактическое списание. */
export function shouldShowCreditTransactionToUser(tx: {
  type: CreditTransactionType;
  amount: number;
}): boolean {
  if (tx.type === "CAPTURE" && tx.amount === 0) return false;
  return true;
}

/** Комментарий к операции: без дублирования типа, коротко для пользователя. */
export function creditTransactionUserComment(
  type: CreditTransactionType,
  reason?: string | null,
): string | null {
  if (type === "CAPTURE" && (reason ?? "").includes("резерв списан")) {
    return null;
  }
  if (type === "RESERVE" && (reason ?? "").includes("карточка товара")) {
    return null;
  }
  if (type === "REFUND") return null;
  const trimmed = reason?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
