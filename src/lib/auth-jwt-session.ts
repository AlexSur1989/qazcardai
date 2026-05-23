import { encode } from "@auth/core/jwt";
import { cookies } from "next/headers";

import type { UserRole } from "@/generated/prisma/enums";
import { authUsesSecureCookies } from "@/lib/auth-public-url";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export type AuthSessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: UserRole;
};

/** Создаёт JWT-сессию NextAuth (strategy: jwt) совместимую с middleware/getToken. */
export async function setAuthJwtSession(user: AuthSessionUser): Promise<void> {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET не задан");
  }

  const secure = authUsesSecureCookies();
  const cookieName = secure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const token = await encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name ?? undefined,
      picture: user.image ?? undefined,
      role: user.role,
    },
    secret,
    salt: cookieName,
    maxAge: SESSION_MAX_AGE,
  });

  const jar = await cookies();
  jar.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secure,
    maxAge: SESSION_MAX_AGE,
  });
}
