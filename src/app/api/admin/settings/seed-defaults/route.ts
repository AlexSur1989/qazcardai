import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isSuperAdmin } from "@/lib/auth";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { ensureDefaultAppSettings } from "@/server/services/appSettings";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { clearRateUploadSettingsCache } from "@/lib/rate-upload-settings";

export const dynamic = "force-dynamic";

export async function POST() {
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

  const { created } = await ensureDefaultAppSettings(current.user.id);
  clearRateUploadSettingsCache();
  await writeAdminAuditLog({
    adminUserId: current.user.id,
    action: "APP_SETTINGS_DEFAULTS_SEEDED",
    targetType: "AppSetting",
    targetId: "registry",
    newValue: { created },
  });
  revalidatePath("/admin/settings");
  return NextResponse.json({ ok: true, created });
}
