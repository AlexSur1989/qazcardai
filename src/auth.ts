import "@/lib/bootstrap-auth-public-url";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import type { UserRole } from "@/generated/prisma/enums";
import TelegramProvider from "@/auth/providers/telegram-oidc";
import type { TelegramOidcProfile } from "@/auth/providers/telegram-oidc";
import {
  isTelegramAuthConfigured,
  warnIfTelegramAllowedOriginMismatch,
} from "@/lib/telegram-auth-config";
import { logAuthEventSafe } from "@/server/services/authEventLog";
import { resolveTelegramOAuthUser } from "@/server/services/telegramAccountService";

warnIfTelegramAllowedOriginMismatch();

const credentialsProvider = Credentials({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  authorize: async (credentials) => {
    const emailRaw = credentials?.email;
    const passwordRaw = credentials?.password;
    if (
      typeof emailRaw !== "string" ||
      typeof passwordRaw !== "string" ||
      !emailRaw.trim() ||
      !passwordRaw
    ) {
      return null;
    }

    const { prisma } = await import("@/lib/prisma");
    const { verifyPassword } = await import("@/lib/password");

    const email = emailRaw.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    if (user.status !== "ACTIVE") return null;

    const valid = await verifyPassword(passwordRaw, user.passwordHash);
    if (!valid) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role as UserRole,
    };
  },
});

const providers: NextAuthConfig["providers"] = [credentialsProvider];

if (isTelegramAuthConfigured()) {
  const clientId = process.env.TELEGRAM_CLIENT_ID?.trim();
  const clientSecret = process.env.TELEGRAM_CLIENT_SECRET?.trim();
  if (clientId && clientSecret) {
    providers.push(
      TelegramProvider({
        clientId,
        clientSecret,
      }),
    );
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "telegram") return true;
      if (!profile || typeof profile !== "object") {
        await logAuthEventSafe({
          action: "telegram.sign_in_failed",
          provider: "telegram",
          metadata: { reason: "no_profile" },
        });
        return false;
      }

      const p = profile as TelegramOidcProfile;
      const res = await resolveTelegramOAuthUser(p);
      if (!res.ok) {
        await logAuthEventSafe({
          action:
            res.code === "BLOCKED"
              ? "telegram.sign_in_denied_blocked"
              : res.code === "INACTIVE"
                ? "telegram.sign_in_denied_inactive"
                : "telegram.sign_in_failed",
          provider: "telegram",
          metadata: {
            code: res.code,
            sub: typeof p.sub === "string" ? p.sub : undefined,
          },
        });
        return false;
      }

      user.id = res.user.id;
      user.email = res.user.email;
      user.name = res.user.name ?? undefined;
      user.role = res.user.role;
      if (res.user.image) {
        user.image = res.user.image;
      }

      if (res.telegramIdentityLinked) {
        await logAuthEventSafe({
          action: "telegram.identity_linked",
          provider: "telegram",
          userId: res.user.id,
          metadata:
            typeof p.sub === "string"
              ? { telegramUserId: p.sub.slice(0, 255) }
              : undefined,
        });
      }

      await logAuthEventSafe({
        action: "telegram.sign_in_success",
        provider: "telegram",
        userId: res.user.id,
        metadata: {
          sub: typeof p.sub === "string" ? p.sub : undefined,
        },
      });

      return true;
    },
    async redirect({ url, baseUrl }) {
      try {
        if (url.startsWith(baseUrl)) return url;
        if (url.startsWith("/")) return new URL(url, baseUrl).toString();
      } catch {
        return baseUrl;
      }
      return baseUrl;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (token.role) {
          session.user.role = token.role;
        }
      }
      return session;
    },
  },
});
