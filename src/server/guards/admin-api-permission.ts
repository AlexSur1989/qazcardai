import { NextResponse } from "next/server";

import type { Permission } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export function adminForbidden(body: Record<string, unknown> = {}) {
  return NextResponse.json({ error: "forbidden", ...body }, { status: 403 });
}

export function adminUnauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** Проверка для route handlers `/api/admin/**`: при ошибке вернуть второй член — готовый NextResponse. */
export async function requireAdminApiPermission(permission: Permission) {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return {
      ok: false as const,
      response:
        current.reason === "unauthenticated"
          ? adminUnauthorized()
          : adminForbidden(),
    };
  }
  if (!hasPermission(current.user.role, permission)) {
    return { ok: false as const, response: adminForbidden() };
  }
  return { ok: true as const, user: current.user };
}
