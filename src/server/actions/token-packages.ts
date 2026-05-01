"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { grantTokenPackageToUser } from "@/server/services/tokenPackages";
import { tokenPackageFormSchema } from "@/lib/validations/token-package";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { getAdminRateLimitError } from "@/server/services/rateLimitService";

import type { Prisma } from "@/generated/prisma/client";

export type TokenPackageActionState = { error?: string; ok?: boolean } | null;

const grantSchema = z.object({
  userId: z.string().cuid("Некорректный userId"),
  tokenPackageId: z.string().cuid("Некорректный пакет"),
});

async function requireAdmin() {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return { error: "Нет доступа" as const };
  }
  return { userId: current.user.id };
}

function formDataToTokenPackageInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase(),
    priceKzt: String(formData.get("priceKzt") ?? ""),
    baseTokens: String(formData.get("baseTokens") ?? ""),
    bonusTokens: String(formData.get("bonusTokens") ?? ""),
    description: String(formData.get("description") ?? "").trim() || undefined,
    sortOrder: String(formData.get("sortOrder") ?? "0"),
    isActive: String(formData.get("isActive") ?? "") === "on",
  };
}

export async function createTokenPackageAction(
  _prev: TokenPackageActionState,
  formData: FormData,
): Promise<TokenPackageActionState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const rateErr = await getAdminRateLimitError(ctx.userId);
  if (rateErr) return { error: rateErr };

  const raw = formDataToTokenPackageInput(formData);
  const parsed = tokenPackageFormSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Проверьте поля";
    return { error: msg };
  }
  const d = parsed.data;

  let created: { id: string };
  try {
    created = await prisma.tokenPackage.create({
      data: {
        name: d.name,
        slug: d.slug,
        priceKzt: d.priceKzt,
        baseTokens: d.baseTokens,
        bonusTokens: d.bonusTokens,
        totalTokens: d.totalTokens,
        description: d.description ?? null,
        isActive: d.isActive,
        sortOrder: d.sortOrder,
      },
    });
  } catch (e) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "Пакет с таким slug уже существует" };
    }
    console.error(e);
    return { error: "Не удалось создать" };
  }

  await writeAdminAuditLog({
    adminUserId: ctx.userId,
    action: "token_package.created",
    targetType: "TokenPackage",
    targetId: created.id,
    newValue: { slug: d.slug, name: d.name, priceKzt: d.priceKzt },
  });

  revalidatePath("/admin/token-packages");
  revalidatePath("/dashboard/billing");
  return { ok: true };
}

export async function updateTokenPackageAction(
  _prev: TokenPackageActionState,
  formData: FormData,
): Promise<TokenPackageActionState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const rateErr = await getAdminRateLimitError(ctx.userId);
  if (rateErr) return { error: rateErr };

  const id = String(formData.get("id") ?? "").trim();
  if (!z.string().cuid().safeParse(id).success) {
    return { error: "Некорректный id" };
  }

  const raw = formDataToTokenPackageInput(formData);
  const parsed = tokenPackageFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }
  const d = parsed.data;

  const before = await prisma.tokenPackage.findUnique({ where: { id } });
  if (!before) {
    return { error: "Пакет не найден" };
  }

  try {
    await prisma.tokenPackage.update({
      where: { id },
      data: {
        name: d.name,
        slug: d.slug,
        priceKzt: d.priceKzt,
        baseTokens: d.baseTokens,
        bonusTokens: d.bonusTokens,
        totalTokens: d.totalTokens,
        description: d.description ?? null,
        isActive: d.isActive,
        sortOrder: d.sortOrder,
      },
    });
  } catch (e) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return { error: "Пакет с таким slug уже существует" };
    }
    console.error(e);
    return { error: "Не удалось сохранить" };
  }

  if (before.priceKzt !== d.priceKzt) {
    await writeAdminAuditLog({
      adminUserId: ctx.userId,
      action: "token_package.price_changed",
      targetType: "TokenPackage",
      targetId: id,
      oldValue: { priceKzt: before.priceKzt } as Prisma.InputJsonValue,
      newValue: { priceKzt: d.priceKzt } as Prisma.InputJsonValue,
    });
  }
  if (before.isActive && !d.isActive) {
    await writeAdminAuditLog({
      adminUserId: ctx.userId,
      action: "token_package.disabled",
      targetType: "TokenPackage",
      targetId: id,
    });
  }
  if (!before.isActive && d.isActive) {
    await writeAdminAuditLog({
      adminUserId: ctx.userId,
      action: "token_package.enabled",
      targetType: "TokenPackage",
      targetId: id,
    });
  }

  const otherChanged =
    before.name !== d.name ||
    before.slug !== d.slug ||
    before.baseTokens !== d.baseTokens ||
    before.bonusTokens !== d.bonusTokens ||
    before.sortOrder !== d.sortOrder ||
    (before.description ?? "") !== (d.description ?? "");
  if (otherChanged) {
    await writeAdminAuditLog({
      adminUserId: ctx.userId,
      action: "token_package.updated",
      targetType: "TokenPackage",
      targetId: id,
      newValue: {
        name: d.name,
        slug: d.slug,
        baseTokens: d.baseTokens,
        bonusTokens: d.bonusTokens,
        totalTokens: d.totalTokens,
        sortOrder: d.sortOrder,
      } as Prisma.InputJsonValue,
    });
  }

  revalidatePath("/admin/token-packages");
  revalidatePath("/dashboard/billing");
  return { ok: true };
}

export async function deleteTokenPackageAction(
  _prev: TokenPackageActionState,
  formData: FormData,
): Promise<TokenPackageActionState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const rateErr = await getAdminRateLimitError(ctx.userId);
  if (rateErr) return { error: rateErr };

  const id = String(formData.get("id") ?? "").trim();
  if (!z.string().cuid().safeParse(id).success) {
    return { error: "Некорректный id" };
  }

  const linked = await prisma.payment.count({ where: { tokenPackageId: id } });
  if (linked > 0) {
    return {
      error: "Нельзя удалить: есть связанные платежи. Отключите пакет (isActive).",
    };
  }
  const userPurchases = await prisma.userTokenPackage.count({ where: { packageId: id } });
  if (userPurchases > 0) {
    return {
      error: "Нельзя удалить: пакет есть в истории покупок пользователей. Отключите пакет.",
    };
  }

  const row = await prisma.tokenPackage.findUnique({ where: { id } });
  if (!row) {
    return { error: "Пакет не найден" };
  }

  await prisma.tokenPackage.delete({ where: { id } });
  await writeAdminAuditLog({
    adminUserId: ctx.userId,
    action: "token_package.deleted",
    targetType: "TokenPackage",
    targetId: id,
    oldValue: { slug: row.slug, name: row.name } as Prisma.InputJsonValue,
  });
  revalidatePath("/admin/token-packages");
  revalidatePath("/dashboard/billing");
  return { ok: true };
}

export async function adminGrantTokenPackageAction(
  _prev: TokenPackageActionState,
  formData: FormData,
): Promise<TokenPackageActionState> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const rateErr = await getAdminRateLimitError(ctx.userId);
  if (rateErr) return { error: rateErr };

  const raw = {
    userId: String(formData.get("userId") ?? "").trim(),
    tokenPackageId: String(formData.get("tokenPackageId") ?? "").trim(),
  };
  const parsed = grantSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }
  const { userId, tokenPackageId } = parsed.data;

  try {
    await grantTokenPackageToUser({
      userId,
      packageId: tokenPackageId,
      adminUserId: ctx.userId,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (m === "USER_NOT_FOUND") {
      return { error: "Пользователь не найден" };
    }
    if (m === "PACKAGE_NOT_FOUND") {
      return { error: "Пакет не найден" };
    }
    if (m === "PACKAGE_INACTIVE") {
      return { error: "Нельзя начислить неактивный пакет" };
    }
    if (m === "INVALID_TOKENS") {
      return { error: "Некорректный размер пакета" };
    }
    console.error(e);
    return { error: "Не удалось начислить" };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/token-packages");
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return { ok: true };
}
