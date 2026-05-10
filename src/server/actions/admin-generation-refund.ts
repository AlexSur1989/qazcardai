"use server";

import { revalidatePath } from "next/cache";

import {
  adminManualRefundGeneration,
  CreditServiceError,
} from "@/server/services/credits";
import { hasPermission } from "@/lib/permissions";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { getAdminRateLimitError } from "@/server/services/rateLimitService";

export type AdminGenRefundState = { error?: string; ok?: boolean } | null;

export async function adminRefundGenerationAction(
  _prev: AdminGenRefundState,
  formData: FormData,
): Promise<AdminGenRefundState> {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return { error: "Нет доступа" };
  }
  if (!hasPermission(current.user.role, "generations.refund")) {
    return { error: "Нет права выполнять возврат генерации" };
  }
  const rateErr = await getAdminRateLimitError(current.user.id);
  if (rateErr) return { error: rateErr };

  const generationId = String(formData.get("generationId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!generationId) return { error: "Нет generationId" };

  try {
    await adminManualRefundGeneration({
      generationId,
      adminUserId: current.user.id,
      reason: reason || "Ручной возврат",
    });
  } catch (e) {
    if (e instanceof CreditServiceError) {
      return { error: e.message };
    }
    console.error(e);
    return { error: "Не удалось выполнить возврат" };
  }

  revalidatePath("/admin/generations");
  revalidatePath(`/admin/generations/${generationId}`);
  revalidatePath("/admin/audit-logs");
  return { ok: true };
}
