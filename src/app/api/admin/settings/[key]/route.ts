import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isSuperAdmin } from "@/lib/auth";
import { setAppSettingFromRegistry } from "@/server/services/appSettings";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";
import { clearRateUploadSettingsCache } from "@/lib/rate-upload-settings";

export const dynamic = "force-dynamic";

const CACHE_CLEAR_KEYS = new Set([
  "MAX_IMAGE_UPLOAD_MB",
  "MAX_VIDEO_UPLOAD_MB",
  "MAX_AUDIO_UPLOAD_MB",
]);

type Ctx = { params: Promise<{ key: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
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

  const { key: rawKey } = await ctx.params;
  const key = decodeURIComponent(rawKey);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("value" in body)) {
    return NextResponse.json({ error: "value_required" }, { status: 400 });
  }
  const value = (body as { value: unknown }).value;

  const res = await setAppSettingFromRegistry({
    key,
    value,
    adminUserId: current.user.id,
  });

  if (!res.ok) {
    const status =
      res.error === "unknown_key"
        ? 404
        : res.error === "read_only" || res.error === "sensitive"
          ? 403
          : 400;
    return NextResponse.json({ error: res.error }, { status });
  }

  if (CACHE_CLEAR_KEYS.has(key)) {
    clearRateUploadSettingsCache();
  }

  revalidatePath("/admin/settings");
  return NextResponse.json({ ok: true, value: res.newValue });
}
