import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import type { UserRole } from "@/generated/prisma/enums";
import {
  pickLoginRedirectParam,
  postAuthLandingPath,
} from "@/lib/auth";

function getMiddlewareJwtSecret(): string | null {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  return s?.trim() || null;
}

function isAdminRouteRole(role: unknown): role is UserRole {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/auth/login" ||
    pathname === "/register" ||
    pathname === "/auth/register";

  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  const secret = getMiddlewareJwtSecret();

  if (isAuthPage) {
    if (!secret) {
      return new NextResponse(
        "Server configuration error: set AUTH_SECRET or NEXTAUTH_SECRET in .env (see .env.example).",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
    const token = await getToken({
      req,
      secret,
    });
    if (token?.sub) {
      const role = token.role as UserRole | undefined;
      const p = pickLoginRedirectParam(
        nextUrl.searchParams.get("next"),
        nextUrl.searchParams.get("callbackUrl"),
      );
      const target = postAuthLandingPath(p, role);
      return NextResponse.redirect(new URL(target, nextUrl.origin));
    }
    return NextResponse.next();
  }

  if (!isDashboard && !isAdmin) {
    return NextResponse.next();
  }

  if (!secret) {
    return new NextResponse(
      "Server configuration error: set AUTH_SECRET or NEXTAUTH_SECRET in .env (see .env.example).",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const token = await getToken({
    req,
    secret,
  });

  if (!token?.sub) {
    const url = new URL("/login", nextUrl.origin);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdmin && !isAdminRouteRole(token.role)) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/auth/login",
    "/register",
    "/auth/register",
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
