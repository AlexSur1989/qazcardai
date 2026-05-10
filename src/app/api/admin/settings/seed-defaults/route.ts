import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { ensureDefaultAppSettings } from "@/server/services/appSettings";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { clearRateUploadSettingsCache } from "@/lib/rate-upload-settings";

export const dynamic = "force-dynamic";

export async function POST() {
  const gate = await requireAdminApiPermission("settings.critical.manage");
  if (!gate.ok) {
    return gate.response;
  }

  const { created } = await ensureDefaultAppSettings(gate.user.id);
  clearRateUploadSettingsCache();
  await writeAdminAuditLog({
    adminUserId: gate.user.id,
    action: "APP_SETTINGS_DEFAULTS_SEEDED",
    targetType: "AppSetting",
    targetId: "registry",
    newValue: { created },
  });
  revalidatePath("/admin/settings");
  return NextResponse.json({ ok: true, created });
}
