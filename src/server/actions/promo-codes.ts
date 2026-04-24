"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { canAccessAdminPanel } from "@/lib/auth";
import { getAdminRateLimitError } from "@/server/services/rateLimitService";
import { prisma } from "@/lib/prisma";

export type PromoCodeActionState = { error?: string; ok?: boolean } | null;

function requireAdmin() {
  return auth().then((session) => {
    if (!session?.user?.id || !canAccessAdminPanel(session.user.role)) {
      return { error: "Нет доступа" as const };
    }
    return { userId: session.user.id };
  });
}

function parseValue(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: false, message: "Укажите значение" };
  if (!/^-?\d+(\.\d+)?$/.test(t)) {
    return { ok: false, message: "Некорректное десятичное значение" };
  }
  return { ok: true, value: t };
}

function parseIntOpt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  if (Number.isNaN(n) || n < 0) return -1;
  return n;
}

export async function createPromoCodeAction(
  _prev: PromoCodeActionState,
  formData: FormData,
): Promise<PromoCodeActionState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const rateErr = await getAdminRateLimitError(ctx.userId);
  if (rateErr) return { error: rateErr };

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const type = String(formData.get("type") ?? "").trim().slice(0, 32);
  const valueRaw = String(formData.get("value") ?? "");
  const maxUses = parseIntOpt(String(formData.get("maxUses") ?? ""));
  const expiresRaw = String(formData.get("expiresAt") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "on";

  if (code.length < 2) return { error: "Код слишком короткий" };
  if (!type) return { error: "Укажите type (например FIXED_CREDITS)" };
  const pv = parseValue(valueRaw);
  if (!pv.ok) return { error: pv.message };
  if (maxUses === -1) return { error: "maxUses: неотрицательное число" };

  let expiresAt: Date | null = null;
  if (expiresRaw) {
    const d = new Date(expiresRaw);
    if (Number.isNaN(d.getTime())) return { error: "Некорректная дата" };
    expiresAt = d;
  }

  let created: { id: string };
  try {
    created = await prisma.promoCode.create({
      data: {
        code,
        type,
        value: pv.value,
        maxUses: maxUses ?? null,
        isActive,
        expiresAt,
      },
    });
  } catch (e) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "Промокод с таким кодом уже есть" };
    }
    console.error(e);
    return { error: "Не удалось создать" };
  }

  await writeAdminAuditLog({
    adminUserId: ctx.userId,
    action: "promo_code.created",
    targetType: "PromoCode",
    targetId: created.id,
    newValue: { code, type, isActive },
  });

  revalidatePath("/admin/promo-codes");
  revalidatePath("/admin/audit-logs");
  return { ok: true };
}

export async function updatePromoCodeAction(
  _prev: PromoCodeActionState,
  formData: FormData,
): Promise<PromoCodeActionState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const rateErr = await getAdminRateLimitError(ctx.userId);
  if (rateErr) return { error: rateErr };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Нет id" };

  const existing = await prisma.promoCode.findUnique({ where: { id } });
  if (!existing) return { error: "Промокод не найден" };

  const type = String(formData.get("type") ?? "").trim().slice(0, 32);
  const valueRaw = String(formData.get("value") ?? "");
  const maxUses = parseIntOpt(String(formData.get("maxUses") ?? ""));
  const expiresRaw = String(formData.get("expiresAt") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "on";

  if (!type) return { error: "Укажите type" };
  const pv = parseValue(valueRaw);
  if (!pv.ok) return { error: pv.message };
  if (maxUses === -1) return { error: "maxUses: неотрицательное число" };

  let expiresAt: Date | null = null;
  if (expiresRaw) {
    const d = new Date(expiresRaw);
    if (Number.isNaN(d.getTime())) return { error: "Некорректная дата" };
    expiresAt = d;
  }

  const before = {
    type: existing.type,
    value: existing.value.toString(),
    maxUses: existing.maxUses,
    isActive: existing.isActive,
    expiresAt: existing.expiresAt?.toISOString() ?? null,
  };

  await prisma.promoCode.update({
    where: { id },
    data: {
      type,
      value: pv.value,
      maxUses: maxUses ?? null,
      isActive,
      expiresAt,
    },
  });

  await writeAdminAuditLog({
    adminUserId: ctx.userId,
    action: "promo_code.updated",
    targetType: "PromoCode",
    targetId: id,
    oldValue: before,
    newValue: { type, isActive, maxUses: maxUses ?? null },
  });

  revalidatePath("/admin/promo-codes");
  revalidatePath("/admin/audit-logs");
  return { ok: true };
}
