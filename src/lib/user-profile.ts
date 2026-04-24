import { prisma } from "@/lib/prisma";

export type UserProfileResult =
  | {
      ok: true;
      email: string;
      name: string | null;
      role: string;
      balanceCredits: number;
    }
  | { ok: false; error: "not_found" | "database" };

/** Профиль только для владельца (по userId из сессии). */
export async function getUserProfile(
  userId: string,
): Promise<UserProfileResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        role: true,
        balanceCredits: true,
      },
    });
    if (!user) {
      return { ok: false, error: "not_found" };
    }
    return {
      ok: true,
      email: user.email,
      name: user.name,
      role: user.role,
      balanceCredits: user.balanceCredits,
    };
  } catch {
    return { ok: false, error: "database" };
  }
}
