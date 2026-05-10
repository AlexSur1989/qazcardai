"use server";

import { revalidatePath } from "next/cache";

import {
  adminAdjustCredits,
  CreditServiceError,
} from "@/server/services/credits";
import { hasPermission } from "@/lib/permissions";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { getAdminRateLimitError } from "@/server/services/rateLimitService";

export type AdminCreditsFormState = {
  error?: string;
  ok?: boolean;
} | null;

export async function adminAdjustUserCreditsAction(
  _prev: AdminCreditsFormState,
  formData: FormData,
): Promise<AdminCreditsFormState> {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    if (current.reason === "unauthenticated") {
      return { error: "Сессия истекла" };
    }
    if (current.reason === "inactive") {
      return { error: "Аккаунт недоступен" };
    }
    return { error: "Нет прав" };
  }
  if (!hasPermission(current.user.role, "users.adjust_balance")) {
    return { error: "Недостаточно прав для корректировки баланса" };
  }
  const rateErr = await getAdminRateLimitError(current.user.id);
  if (rateErr) {
    return { error: rateErr };
  }
  const userId = String(formData.get("userId") ?? "").trim();
  const deltaStr = String(formData.get("delta") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId) {
    return { error: "Некорректный пользователь" };
  }
  if (reason.length < 2) {
    return { error: "Укажите причину (от 2 символов)" };
  }
  const delta = parseInt(deltaStr, 10);
  if (Number.isNaN(delta) || delta === 0) {
    return { error: "Введите ненулевое целое число: + — начислить, − — списать" };
  }
  try {
    await adminAdjustCredits({
      userId,
      adminUserId: current.user.id,
      adminRole: current.user.role,
      delta,
      reason,
    });
  } catch (e) {
    if (e instanceof CreditServiceError) {
      return { error: e.message };
    }
    console.error(e);
    return { error: "Внутренняя ошибка" };
  }
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/audit-logs");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/credit-transactions");
  return { ok: true };
}
