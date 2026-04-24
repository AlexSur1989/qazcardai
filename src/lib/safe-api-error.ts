import "server-only";

import { CreditServiceError } from "@/server/services/credits";

/**
 * Сообщение для клиента: в production не отдаём внутренние тексты исключений.
 */
export function publicApiErrorMessage(e: unknown, safeFallback: string): string {
  if (e instanceof CreditServiceError) {
    return e.message;
  }
  if (process.env.NODE_ENV === "production") {
    return safeFallback;
  }
  if (e instanceof Error) {
    return e.message;
  }
  return safeFallback;
}
