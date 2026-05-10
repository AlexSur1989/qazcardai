import { NextResponse } from "next/server";

import { getEmailTemplates } from "@/server/services/emailTemplates";
import { getNotificationAdminState } from "@/server/services/notificationSettings";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

/**
 * Сводка: настройки, шаблоны, статусы env (без секретов).
 */
export async function GET() {
  const gate = await requireAdminApiPermission("notifications.manage");
  if (!gate.ok) {
    return gate.response;
  }
  const [state, templates] = await Promise.all([
    getNotificationAdminState(),
    getEmailTemplates(),
  ]);
  return NextResponse.json({
    ...state,
    templates,
  });
}
