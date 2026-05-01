import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import type { UserRole } from "@/generated/prisma/enums";

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

  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!isDashboard && !isAdmin) {
    return NextResponse.next();
  }

  const secret = getMiddlewareJwtSecret();
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
