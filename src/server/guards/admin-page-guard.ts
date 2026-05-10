import { redirect } from "next/navigation";

import type { Permission } from "@/lib/permissions";
import {
  defaultAdminLandingPath,
  hasPermission,
} from "@/lib/permissions";
import type { FreshSessionUser } from "@/server/services/fresh-session-user";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

/** Доступ к странице админки: иначе редирект на дефолтный раздел роли (модератор → /admin/moderation). */
export async function requireAdminPagePermission(
  permission: Permission,
): Promise<FreshSessionUser> {
  const s = await getFreshAdminSessionUser();
  if (!s.ok) {
    redirect("/login?next=/admin");
  }
  if (!hasPermission(s.user.role, permission)) {
    redirect(defaultAdminLandingPath(s.user.role));
  }
  return s.user;
}
