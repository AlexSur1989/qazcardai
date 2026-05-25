
import type { Prisma } from "@/generated/prisma/client";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import {
  validateAppSettingValueForType,
} from "@/lib/app-setting-value";
import { validateCardBuilderPromptsForSave } from "@/lib/validations/card-builder-prompts-setting";
import {
  clearCardBuilderPromptsSettingsCache,
  PRODUCT_CARD_CARD_BUILDER_PROMPTS_KEY,
} from "@/server/services/cardBuilderPromptsSettings";
import {
  isMaintenanceAllowAdminEnv,
  isMaintenanceModeEnv,
} from "@/lib/maintenance-mode";

import { prisma } from "@/lib/prisma";
import {
  APP_SETTINGS_REGISTRY,
  APP_SETTING_GROUPS,
  getRegistryEntry,
  type AppSettingGroupId,
  type AppSettingRegistryEntry,
} from "@/config/app-settings-registry";

function coerceStoredValue(
  def: AppSettingRegistryEntry,
  raw: unknown,
): unknown {
  if (def.type === "string") {
    if (raw == null) return "";
    if (typeof raw === "string") return raw;
    return String(raw);
  }
  if (def.type === "number") {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() !== "") {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
    return def.defaultValue;
  }
  if (def.type === "boolean") {
    if (raw === true || raw === false) return raw;
    if (raw === "true" || raw === 1) return true;
    if (raw === "false" || raw === 0) return false;
    return def.defaultValue;
  }
  if (def.type === "json") {
    if (raw === null || raw === undefined) return def.defaultValue;
    return raw;
  }
  return def.defaultValue;
}

export async function getAppSetting(key: string): Promise<unknown> {
  const def = getRegistryEntry(key);
  if (!def) {
    return null;
  }
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    if (!row) {
      return def.defaultValue;
    }
    return coerceStoredValue(def, row.value);
  } catch (e) {
    console.error("[getAppSetting]", key, e);
    return def.defaultValue;
  }
}

export async function getAppSettingsByGroup(
  group: AppSettingGroupId,
): Promise<
  (AppSettingRegistryEntry & { value: unknown; inDatabase: boolean })[]
> {
  const inGroup = APP_SETTINGS_REGISTRY.filter((e) => e.group === group);
  const keys = inGroup.map((e) => e.key);
  const rows =
    keys.length === 0
      ? []
      : await prisma.appSetting.findMany({ where: { key: { in: keys } } });
  const byKey = new Map(rows.map((r) => [r.key, r] as const));
  return inGroup.map((def) => {
    const row = byKey.get(def.key);
    return {
      ...def,
      value: row ? coerceStoredValue(def, row.value) : def.defaultValue,
      inDatabase: Boolean(row),
    };
  });
}

export type AppSettingListGroup = {
  group: string;
  label: string;
  settings: {
    key: string;
    group: string;
    label: string;
    description: string;
    type: string;
    value: unknown;
    defaultValue: unknown;
    inDatabase: boolean;
    editable: boolean;
    sensitive: boolean;
  }[];
};

export async function getAllAppSettingsForAdminResponse(): Promise<{
  groups: AppSettingListGroup[];
}> {
  const keys = APP_SETTINGS_REGISTRY.map((e) => e.key);
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: keys } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r] as const));
  const byGroup = new Map<AppSettingGroupId, AppSettingListGroup["settings"]>();
  for (const g of APP_SETTING_GROUPS) {
    byGroup.set(g.id, []);
  }
  for (const def of APP_SETTINGS_REGISTRY) {
    const row = byKey.get(def.key);
    const list = byGroup.get(def.group);
    if (!list) continue;
    if (list.some((item) => item.key === def.key)) continue;
    list.push({
      key: def.key,
      group: def.group,
      label: def.label,
      description: def.description,
      type: def.type,
      value: row ? coerceStoredValue(def, row.value) : def.defaultValue,
      defaultValue: def.defaultValue,
      inDatabase: Boolean(row),
      editable: def.editable,
      sensitive: def.sensitive,
    });
  }
  return {
    groups: APP_SETTING_GROUPS.map((g) => ({
      group: g.id,
      label: g.label,
      settings: byGroup.get(g.id) ?? [],
    })),
  };
}

/**
 * Создать в БД только отсутствующие записи реестра (без перезаписи).
 */
export async function ensureDefaultAppSettings(
  adminUserId: string,
): Promise<{ created: number }> {
  let created = 0;
  for (const def of APP_SETTINGS_REGISTRY) {
    const exist = await prisma.appSetting.findUnique({
      where: { key: def.key },
      select: { id: true },
    });
    if (exist) continue;
    await prisma.appSetting.create({
      data: {
        key: def.key,
        type: def.type,
        value: def.defaultValue as Prisma.InputJsonValue,
        description: def.description,
        updatedBy: adminUserId,
      },
    });
    created += 1;
  }
  return { created };
}

export async function setAppSettingFromRegistry(input: {
  key: string;
  value: unknown;
  adminUserId: string;
}): Promise<
  | { ok: true; newValue: unknown }
  | { ok: false; error: string; status?: number }
> {
  const def = getRegistryEntry(input.key);
  if (!def) {
    return { ok: false, error: "unknown_key" };
  }
  if (!def.editable) {
    return { ok: false, error: "read_only" };
  }
  if (def.sensitive) {
    return { ok: false, error: "sensitive" };
  }
  if (def.key === PRODUCT_CARD_CARD_BUILDER_PROMPTS_KEY) {
    const promptsValid = validateCardBuilderPromptsForSave(input.value);
    if (!promptsValid.ok) {
      return { ok: false, error: promptsValid.errors.join("; ") };
    }
    input.value = promptsValid.value;
  }
  const valid = validateAppSettingValueForType(def.type, input.value);
  if (!valid.ok) {
    return { ok: false, error: valid.message };
  }
  const oldRow = await prisma.appSetting.findUnique({ where: { key: def.key } });
  const oldValue = oldRow
    ? coerceStoredValue(def, oldRow.value)
    : def.defaultValue;
  const updated = await prisma.appSetting.upsert({
    where: { key: def.key },
    create: {
      key: def.key,
      type: def.type,
      value: valid.value,
      description: def.description,
      updatedBy: input.adminUserId,
    },
    update: {
      type: def.type,
      value: valid.value,
      description: def.description,
      updatedBy: input.adminUserId,
    },
  });
  const newValue = coerceStoredValue(def, updated.value);
  await writeAdminAuditLog({
    adminUserId: input.adminUserId,
    action: "APP_SETTING_UPDATED",
    targetType: "AppSetting",
    targetId: def.key,
    oldValue: { value: oldValue, key: def.key, group: def.group },
    newValue: { value: newValue, key: def.key, group: def.group },
    metadata: { key: def.key, group: def.group },
  });
  if (def.key === PRODUCT_CARD_CARD_BUILDER_PROMPTS_KEY) {
    clearCardBuilderPromptsSettingsCache();
  }
  return { ok: true, newValue };
}

export async function getMaintenanceFlags(): Promise<{
  maintenanceMode: boolean;
  message: string;
  allowAdmin: boolean;
}> {
  const [mode, message, allowAdmin] = await Promise.all([
    getAppSetting("MAINTENANCE_MODE"),
    getAppSetting("MAINTENANCE_MESSAGE"),
    getAppSetting("ALLOW_ADMIN_DURING_MAINTENANCE"),
  ]);
  return {
    maintenanceMode: isMaintenanceModeEnv() || mode === true,
    message:
      typeof message === "string" && message.trim()
        ? message
        : "Ведутся технические работы. Скоро открытие — сервис временно недоступен.",
    allowAdmin: allowAdmin !== false || isMaintenanceAllowAdminEnv(),
  };
}
