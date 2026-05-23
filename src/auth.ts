import "@/lib/bootstrap-auth-public-url";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import type { UserRole } from "@/generated/prisma/enums";

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
