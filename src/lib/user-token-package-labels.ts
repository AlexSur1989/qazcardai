import type { UserTokenPackageStatus } from "@/generated/prisma/enums";

export function userTokenPackageStatusLabel(s: UserTokenPackageStatus): string {
  const m: Record<UserTokenPackageStatus, string> = {
    COMPLETED: "Завершена",
    ACTIVE: "Активна",
    CANCELLED: "Отменена",
    REFUNDED: "Возврат",
  };
  return m[s] ?? s;
}
