"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { canAccessAdminPanel } from "@/lib/auth";
import {
  adminManualRefundGeneration,
  CreditServiceError,
} from "@/server/services/credits";
import { getAdminRateLimitError } from "@/server/services/rateLimitService";

export type AdminGenRefundState = { error?: string; ok?: boolean } | null;

export async function adminRefundGenerationAction(
  _prev: AdminGenRefundState,
  formData: FormData,
): Promise<AdminGenRefundState> {
  const session = await auth();
  if (!session?.user?.id || !canAccessAdminPanel(session.user.role)) {
    return { error: "Нет доступа" };
  }
  const rateErr = await getAdminRateLimitError(session.user.id);
  if (rateErr) return { error: rateErr };

  const generationId = String(formData.get("generationId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!generationId) return { error: "Нет generationId" };

  try {
    await adminManualRefundGeneration({
      generationId,
      adminUserId: session.user.id,
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
