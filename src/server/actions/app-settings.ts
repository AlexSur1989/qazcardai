"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import {
  canDeleteAppSettingKey,
  isValidAppSettingKey,
} from "@/lib/app-setting-protected";
import { clearModerationConfigCache } from "@/server/services/moderation";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { clearRateUploadSettingsCache } from "@/lib/rate-upload-settings";
import { MODERATION_APP_SETTING_KEY } from "@/lib/moderation-defaults";
import { RATE_UPLOAD_APP_SETTING_KEY } from "@/lib/rate-upload-settings";
import { getAdminRateLimitError } from "@/server/services/rateLimitService";
import { isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AppSettingActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
} | null;

const TYPES = new Set(["string", "number", "boolean", "json"]);

function parseValueByType(
  type: string,
  raw: string,
): { ok: true; value: Prisma.InputJsonValue } | { ok: false; message: string } {
  const t = type.trim();
  if (!TYPES.has(t)) {
    return { ok: false, message: "Некорректный тип" };
  }
  const s = raw.trim();
  if (t === "string") {
    return { ok: true, value: s };
  }
  if (t === "number") {
    const n = Number(s);
    if (!Number.isFinite(n)) {
      return { ok: false, message: "Нужно конечное число" };
    }
    return { ok: true, value: n };
  }
  if (t === "boolean") {
    if (s === "true" || s === "1") return { ok: true, value: true };
    if (s === "false" || s === "0") return { ok: true, value: false };
    return { ok: false, message: "Для boolean укажите true/false" };
  }
  try {
    const parsed: unknown = JSON.parse(s || "null");
    if (
      parsed !== null &&
      typeof parsed !== "object" &&
      typeof parsed !== "string" &&
      typeof parsed !== "number" &&
      typeof parsed !== "boolean"
    ) {
      return { ok: false, message: "JSON: неподдерживаемый примитив" };
    }
    return { ok: true, value: parsed as Prisma.InputJsonValue };
  } catch {
    return { ok: false, message: "Некорректный JSON" };
  }
}

async function requireSuperAdmin() {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return { error: "Нет доступа" as const };
  }
  if (!isSuperAdmin(current.user.role)) {
    return { error: "Только SUPER_ADMIN может менять настройки" as const };
  }
  return { userId: current.user.id };
}

function maybeClearCaches(key: string) {
  if (key === MODERATION_APP_SETTING_KEY) clearModerationConfigCache();
  if (key === RATE_UPLOAD_APP_SETTING_KEY) clearRateUploadSettingsCache();
}

export async function createAppSettingAction(
  _prev: AppSettingActionState,
  formData: FormData,
): Promise<AppSettingActionState> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const rateErr = await getAdminRateLimitError(ctx.userId);
  if (rateErr) return { error: rateErr };

  const key = String(formData.get("key") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const rawValue = String(formData.get("value") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!isValidAppSettingKey(key)) {
    return {
      error:
        "Ключ: латиница, цифры, _, начинается с буквы, до 127 символов",
    };
  }
  const parsed = parseValueByType(type, rawValue);
  if (!parsed.ok) return { error: parsed.message };

  const existing = await prisma.appSetting.findUnique({ where: { key } });
  if (existing) {
    return { error: "Настройка с таким ключом уже есть" };
  }

  const created = await prisma.appSetting.create({
    data: {
      key,
      type,
      value: parsed.value,
      description,
      updatedBy: ctx.userId,
    },
  });

  await writeAdminAuditLog({
    adminUserId: ctx.userId,
    action: "app_setting.created",
    targetType: "AppSetting",
    targetId: created.id,
    newValue: { key, type, description },
  });

  maybeClearCaches(key);
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function updateAppSettingAction(
  _prev: AppSettingActionState,
  formData: FormData,
): Promise<AppSettingActionState> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const rateErr = await getAdminRateLimitError(ctx.userId);
  if (rateErr) return { error: rateErr };

  const id = String(formData.get("id") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const rawValue = String(formData.get("value") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!id) return { error: "Нет id" };

  const row = await prisma.appSetting.findUnique({ where: { id } });
  if (!row) return { error: "Запись не найдена" };

  const parsed = parseValueByType(type, rawValue);
  if (!parsed.ok) return { error: parsed.message };

  const oldSnap = {
    key: row.key,
    type: row.type,
    value: row.value,
    description: row.description,
  };

  const updated = await prisma.appSetting.update({
    where: { id },
    data: {
      type,
      value: parsed.value,
      description,
      updatedBy: ctx.userId,
    },
  });

  await writeAdminAuditLog({
    adminUserId: ctx.userId,
    action: "app_setting.updated",
    targetType: "AppSetting",
    targetId: id,
    oldValue: oldSnap,
    newValue: {
      key: updated.key,
      type: updated.type,
      description: updated.description,
    },
  });

  maybeClearCaches(row.key);
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function deleteAppSettingAction(
  _prev: AppSettingActionState,
  formData: FormData,
): Promise<AppSettingActionState> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const rateErr = await getAdminRateLimitError(ctx.userId);
  if (rateErr) return { error: rateErr };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Нет id" };

  const row = await prisma.appSetting.findUnique({ where: { id } });
  if (!row) return { error: "Запись не найдена" };

  if (!canDeleteAppSettingKey(row.key)) {
    return {
      error:
        "Этот системный ключ нельзя удалить из панели (см. документацию / Prisma Studio при крайней необходимости)",
    };
  }

  await prisma.appSetting.delete({ where: { id } });

  await writeAdminAuditLog({
    adminUserId: ctx.userId,
    action: "app_setting.deleted",
    targetType: "AppSetting",
    targetId: id,
    oldValue: { key: row.key, type: row.type },
  });

  maybeClearCaches(row.key);
  revalidatePath("/admin/settings");
  return { ok: true };
}

/** Примеры из спецификации: создаёт только отсутствующие ключи. */
const EXAMPLE_SETTINGS: Array<{
  key: string;
  type: string;
  value: Prisma.InputJsonValue;
  description: string;
}> = [
  {
    key: "freeCreditsForNewUsers",
    type: "number",
    value: 0,
    description: "Стартовые кредиты для нового пользователя",
  },
  {
    key: "maintenanceMode",
    type: "boolean",
    value: false,
    description: "Режим обслуживания (заглушка для будущей логики)",
  },
  {
    key: "defaultImageModel",
    type: "string",
    value: "",
    description: "Slug AI-модели по умолчанию для изображений",
  },
  {
    key: "defaultVideoModel",
    type: "string",
    value: "",
    description: "Slug AI-модели по умолчанию для видео",
  },
  {
    key: "maxActiveGenerationsPerUser",
    type: "number",
    value: 5,
    description: "Макс. одновременно активных генераций на пользователя",
  },
  { key: "referralBonus", type: "number", value: 0, description: "Бонус за реферала (кредиты)" },
  {
    key: "maxImageUploadMb",
    type: "number",
    value: 10,
    description: "Лимит загрузки изображений, МБ (см. also rate_upload_limits / env)",
  },
  { key: "maxVideoUploadMb", type: "number", value: 100, description: "Лимит загрузки видео, МБ" },
  {
    key: "moderationEnabled",
    type: "boolean",
    value: true,
    description: "Включить модерацию (совместно с moderation_settings в БД)",
  },
  {
    key: "rateLimitGenerationPerMinute",
    type: "number",
    value: 10,
    description: "Лимит генераций/мин (при дублировании согласовать с rate_upload_limits)",
  },
];

export async function seedExampleAppSettingsAction(
  _prev: AppSettingActionState,
  _formData: FormData,
): Promise<AppSettingActionState> {
  const ctx = await requireSuperAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const rateErr = await getAdminRateLimitError(ctx.userId);
  if (rateErr) return { error: rateErr };

  let n = 0;
  for (const row of EXAMPLE_SETTINGS) {
    const exist = await prisma.appSetting.findUnique({ where: { key: row.key } });
    if (exist) continue;
    await prisma.appSetting.create({
      data: {
        key: row.key,
        type: row.type,
        value: row.value,
        description: row.description,
        updatedBy: ctx.userId,
      },
    });
    n += 1;
  }

  if (n > 0) {
    await writeAdminAuditLog({
      adminUserId: ctx.userId,
      action: "app_setting.seeded_examples",
      targetType: "AppSetting",
      newValue: { insertedCount: n },
    });
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/audit-logs");
  if (n === 0) {
    return { ok: true, message: "Все примеры уже есть в базе" };
  }
  return { ok: true, message: `Добавлено записей: ${n}` };
}
