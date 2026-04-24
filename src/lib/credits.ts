/**
 * Публичный API сервиса кредитов (только сервер: импортируйте из API routes, RSC, server actions).
 * Реализация: `src/server/services/credits.ts`.
 */
import "server-only";

export {
  getBalance,
  addCredits,
  reserveCredits,
  confirmCredits,
  refundCredits,
  listTransactions,
  adminAdjustCredits,
  CreditServiceError,
} from "@/server/services/credits";

export type { ListTxOptions } from "@/server/services/credits";
