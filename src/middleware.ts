import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import type { UserRole } from "@/generated/prisma/enums";

function authSecret(): string {
  const s =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;
  if (!s) {
    throw new Error(
      "AUTH_SECRET or NEXTAUTH_SECRET must be set for middleware (see .env.example)",
    );
  }
  return s;
}

function isAdminRouteRole(role: unknown): role is UserRole {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!isDashboard && !isAdmin) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: authSecret(),
  });

  if (!token?.sub) {
    const url = new URL("/auth/login", nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdmin && !isAdminRouteRole(token.role)) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
