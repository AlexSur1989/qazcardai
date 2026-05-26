import { NextResponse } from "next/server";

import {
  DEFAULT_PRODUCT_CARD_WEB_RESEARCH_SETTINGS,
  normalizeWebResearchSettings,
} from "@/lib/product-card-web-research-config";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { getAppSetting, setAppSettingFromRegistry } from "@/server/services/appSettings";

export const dynamic = "force-dynamic";

const KEY = "PRODUCT_CARD_WEB_RESEARCH_SETTINGS";

export async function GET() {
  const gate = await requireAdminApiPermission("models.product_card.manage");
  if (!gate.ok) return gate.response;
  const raw = await getAppSetting(KEY);
  return NextResponse.json(normalizeWebResearchSettings(raw));
}

export async function PATCH(req: Request) {
  const gate = await requireAdminApiPermission("settings.manage");
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const value = normalizeWebResearchSettings({
    ...DEFAULT_PRODUCT_CARD_WEB_RESEARCH_SETTINGS,
    ...(body && typeof body === "object" && !Array.isArray(body) ? body : {}),
  });
  const saved = await setAppSettingFromRegistry({
    key: KEY,
    value,
    adminUserId: gate.user.id,
  });
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, settings: normalizeWebResearchSettings(saved.newValue) });
}
