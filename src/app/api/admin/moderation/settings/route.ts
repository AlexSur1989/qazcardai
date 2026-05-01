import { NextResponse } from "next/server";

import {
  MODERATION_APP_SETTING_KEYS,
  parseModerationSettingsBody,
  validateAndCoerceModerationValue,
  type ModerationAppSettingKey,
} from "@/lib/moderation-app-settings";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSetting } from "@/server/services/appSettings";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { getRegistryEntry } from "@/config/app-settings-registry";
import { clearModerationConfigCache } from "@/server/services/moderation";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  const settings: Record<string, unknown> = {};
  for (const key of MODERATION_APP_SETTING_KEYS) {
    settings[key] = await getAppSetting(key);
  }
  return NextResponse.json({ settings, role: current.user.role });
}

export async function PATCH(req: Request) {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  if (!isSuperAdmin(current.user.role)) {
    return NextResponse.json({ error: "super_admin_only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = parseModerationSettingsBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  for (const k of Object.keys(parsed.patch) as ModerationAppSettingKey[]) {
    const def = getRegistryEntry(k);
    if (!def) {
      return NextResponse.json({ error: "unknown_key" }, { status: 400 });
    }
    const coerced = validateAndCoerceModerationValue(k, parsed.patch[k]);
    if (!coerced.ok) {
      return NextResponse.json({ error: coerced.message }, { status: 400 });
    }
    before[k] = await getAppSetting(k);
    await prisma.appSetting.upsert({
      where: { key: k },
      create: {
        key: k,
        type: def.type,
        value: coerced.value,
        description: def.description,
        updatedBy: current.user.id,
      },
      update: {
        type: def.type,
        value: coerced.value,
        description: def.description,
        updatedBy: current.user.id,
      },
    });
    after[k] = await getAppSetting(k);
  }

  clearModerationConfigCache();
  await writeAdminAuditLog({
    adminUserId: current.user.id,
    action: "MODERATION_SETTINGS_UPDATED",
    targetType: "Moderation",
    targetId: "settings",
    oldValue: before,
    newValue: after,
  });

  return NextResponse.json({ ok: true, before, after });
}
