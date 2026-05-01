import "server-only";

import { auth } from "@/auth";
import type { UserRole, UserStatus } from "@/generated/prisma/enums";
import { canAccessAdminPanel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type FreshSessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
};

export type FreshSessionUserResult =
  | { ok: true; user: FreshSessionUser }
  | { ok: false; reason: "unauthenticated" | "not_found" | "inactive" };

export type FreshAdminUserResult =
  | { ok: true; user: FreshSessionUser }
  | { ok: false; reason: "unauthenticated" | "not_found" | "inactive" | "forbidden" };

export async function getFreshSessionUser(): Promise<FreshSessionUserResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "unauthenticated" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  });
  if (!user) {
    return { ok: false, reason: "not_found" };
  }
  if (user.status !== "ACTIVE") {
    return { ok: false, reason: "inactive" };
  }

  return { ok: true, user };
}

export async function getFreshAdminSessionUser(): Promise<FreshAdminUserResult> {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    return current;
  }
  if (!canAccessAdminPanel(current.user.role)) {
    return { ok: false, reason: "forbidden" };
  }
  return current;
}
