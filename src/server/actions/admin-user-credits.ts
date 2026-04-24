"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { canAccessAdminPanel } from "@/lib/auth";
import {
  adminAdjustCredits,
  CreditServiceError,
} from "@/server/services/credits";

export type AdminCreditsFormState = {
  error?: string;
  ok?: boolean;
} | null;

export async function adminAdjustUserCreditsAction(
  _prev: AdminCreditsFormState,
  formData: FormData,
): Promise<AdminCreditsFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Сессия истекла" };
  }
  if (!canAccessAdminPanel(session.user.role)) {
    return { error: "Нет прав" };
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
      adminUserId: session.user.id,
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
  return { ok: true };
}
