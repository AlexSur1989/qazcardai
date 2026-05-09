import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import type { UserRole } from "@/generated/prisma/enums";
import {
  pickLoginRedirectParam,
  postAuthLandingPath,
  maybeRedirectImageVideoToModelsCatalog,
} from "@/lib/auth";
import {
  isMaintenanceAllowAdminEnv,
  isMaintenanceModeEnv,
} from "@/lib/maintenance-mode";

function getMiddlewareJwtSecret(): string | null {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  return s?.trim() || null;
}

/**
 * Имя cookie сессии Auth.js зависит от secure-режима (defaultCookies в @auth/core).
 * Без secureCookie: true на HTTPS getToken ищет не тот cookie → token всегда null.
 */
function shouldUseSecureSessionCookie(req: NextRequest): boolean {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto === "https") return true;
  if (req.nextUrl.protocol === "https:") return true;
  const authBase =
    process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (authBase?.startsWith("https:")) return true;
  return false;
}

function isAdminRouteRole(role: unknown): role is UserRole {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * MAINTENANCE_MODE=1 — для обычных пользователей редирект на /maintenance.
 * MAINTENANCE_ALLOW_ADMIN=1 — ADMIN/SUPER_ADMIN во входе видят сайт как без техработ (кабинет + админка + API).
 * Регистрация по-прежнему закрыта у всех.
 */
async function applyMaintenanceGate(
  req: NextRequest,
): Promise<NextResponse | null> {
  if (!isMaintenanceModeEnv()) {
    return null;
  }

  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  if (
    pathname.startsWith("/_next") ||
    /\.(?:ico|png|jpg|jpeg|gif|webp|svg|txt|xml|woff2?)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }
  if (pathname === "/maintenance") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/webhooks") || pathname === "/api/health") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const secret = getMiddlewareJwtSecret();
  const secureCookie = shouldUseSecureSessionCookie(req);
  const allowAdmin = isMaintenanceAllowAdminEnv();

  let token: Awaited<ReturnType<typeof getToken>> = null;
  if (secret) {
    token = await getToken({
      req,
      secret,
      secureCookie,
    });
  }

  const isAdmin = isAdminRouteRole(token?.role);

  if (pathname === "/register" || pathname === "/auth/register") {
    return NextResponse.redirect(
      new URL("/maintenance?reason=registration", nextUrl.origin),
    );
  }

  if (allowAdmin && token?.sub && isAdmin) {
    return null;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Ведутся технические работы. Сервис временно недоступен." },
      { status: 503 },
    );
  }

  if (!allowAdmin) {
    if (pathname === "/login" || pathname === "/auth/login") {
      return NextResponse.redirect(new URL("/maintenance", nextUrl.origin));
    }
    if (token?.sub && !isAdmin) {
      if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
        return NextResponse.redirect(new URL("/maintenance", nextUrl.origin));
      }
    }
    return NextResponse.redirect(new URL("/maintenance", nextUrl.origin));
  }

  if (pathname === "/login" || pathname === "/auth/login") {
    return null;
  }
  if (pathname.startsWith("/admin")) {
    return null;
  }
  if (token?.sub && !isAdmin) {
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      return NextResponse.redirect(new URL("/maintenance", nextUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/maintenance", nextUrl.origin));
}

export async function middleware(req: NextRequest) {
  const gated = await applyMaintenanceGate(req);
  if (gated !== null) {
    return gated;
  }

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
  const secureCookie = shouldUseSecureSessionCookie(req);

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
      secureCookie,
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
    secureCookie,
  });

  if (!token?.sub) {
    const url = new URL("/login", nextUrl.origin);
    const dest = `${pathname}${nextUrl.search}`;
    url.searchParams.set("next", dest);
    return NextResponse.redirect(url);
  }

  if (isAdmin && !isAdminRouteRole(token.role)) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  const toCatalog = maybeRedirectImageVideoToModelsCatalog(
    pathname,
    nextUrl.searchParams,
  );
  if (toCatalog != null) {
    const redirectRes = NextResponse.redirect(
      new URL(toCatalog, nextUrl.origin),
    );
    redirectRes.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0, must-revalidate",
    );
    return redirectRes;
  }

  const response = NextResponse.next();
  if (isDashboard || isAdmin) {
    response.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0, must-revalidate",
    );
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
