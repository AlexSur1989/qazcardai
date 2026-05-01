import { NextResponse } from "next/server";

import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { getEmailTemplates } from "@/server/services/emailTemplates";
import { getNotificationAdminState } from "@/server/services/notificationSettings";

export const dynamic = "force-dynamic";

/**
 * Сводка: настройки, шаблоны, статусы env (без секретов).
 */
export async function GET() {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
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
