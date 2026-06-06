import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken, type JWT } from "next-auth/jwt";

import type { UserRole } from "@/generated/prisma/enums";
import {
  canAccessAdminPanel,
  isModeratorAllowedAdminPath,
  isStaffMaintenanceRole,
} from "@/lib/permissions";
import {
  pickLoginRedirectParam,
  postAuthLandingPath,
  maybeRedirectImageVideoToModelsCatalog,
} from "@/lib/auth";
import {
  isMaintenanceAllowAdminEnv,
  isMaintenanceModeEnv,
} from "@/lib/maintenance-mode";
import { getLandingUrl } from "@/lib/app-name";

function redirectAppRootToLanding(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (req.nextUrl.pathname !== "/") return null;
  return NextResponse.redirect(getLandingUrl());
}

function getMiddlewareJwtSecret(): string | null {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  return s?.trim() || null;
}

/**
 * HTTPS «как видит браузер» за reverse proxy: иначе getToken ставит secureCookie=false
 * и не находит __Secure-* cookie → ложный гость и петля /dashboard ↔ /login.
 */
function shouldUseSecureSessionCookie(req: NextRequest): boolean {
  const forwardedProtoRaw = req.headers.get("x-forwarded-proto");
  if (forwardedProtoRaw) {
    const first = forwardedProtoRaw.split(",")[0]?.trim()?.toLowerCase();
    if (first === "https") return true;
  }
  if (req.headers.get("x-forwarded-ssl")?.toLowerCase() === "on") return true;
  if (req.nextUrl.protocol === "https:") return true;
  const authBase =
    process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (authBase?.startsWith("https:")) return true;
  return false;
}

/**
 * Два режима имени/decrypt cookie; при несовпадении с прокси срабатывает fallback.
 */
async function getMiddlewareToken(
  req: NextRequest,
  secret: string,
): Promise<JWT | null> {
  const primary = shouldUseSecureSessionCookie(req);
  let tok = await getToken({ req, secret, secureCookie: primary });
  if (
    typeof tok === "string" ||
    tok == null ||
    !tok.sub
  ) {
    tok = await getToken({ req, secret, secureCookie: !primary });
  }
  if (typeof tok === "string" || tok == null || !tok.sub) return null;
  return tok;
}

function isAdminDashboardRole(role: unknown): role is UserRole {
  return canAccessAdminPanel(role as UserRole);
}

/**
 * MAINTENANCE_MODE=1 — для обычных пользователей редирект на /maintenance.
 * MAINTENANCE_ALLOW_ADMIN=1 — персонал (MODERATOR/ADMIN/SUPER_ADMIN) видит кабинет и админку как без техработ.
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
  const allowAdmin = isMaintenanceAllowAdminEnv();

  let token: JWT | null = null;
  if (secret) {
    token = await getMiddlewareToken(req, secret);
  }

  const isStaff = isStaffMaintenanceRole(token?.role);

  if (pathname === "/register" || pathname === "/auth/register") {
    return NextResponse.redirect(
      new URL("/maintenance?reason=registration", nextUrl.origin),
    );
  }

  if (allowAdmin && token?.sub && isStaff) {
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
    if (token?.sub && !isStaff) {
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
  if (token?.sub && !isStaff) {
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      return NextResponse.redirect(new URL("/maintenance", nextUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/maintenance", nextUrl.origin));
}

export async function middleware(req: NextRequest) {
  const landingRedirect = redirectAppRootToLanding(req);
  if (landingRedirect) return landingRedirect;

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
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  const secret = getMiddlewareJwtSecret();

  if (isAuthPage) {
    if (!secret) {
      return new NextResponse(
        "Server configuration error: set AUTH_SECRET or NEXTAUTH_SECRET in .env (see .env.example).",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
    const token = await getMiddlewareToken(req, secret);
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

  if (!isDashboard && !isAdminPath) {
    return NextResponse.next();
  }

  if (!secret) {
    return new NextResponse(
      "Server configuration error: set AUTH_SECRET or NEXTAUTH_SECRET in .env (see .env.example).",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const token = await getMiddlewareToken(req, secret);

  if (!token?.sub) {
    const url = new URL("/login", nextUrl.origin);
    const dest = `${pathname}${nextUrl.search}`;
    url.searchParams.set("next", dest);
    return NextResponse.redirect(url);
  }

  if (isAdminPath && !isAdminDashboardRole(token.role)) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  const role = token.role as UserRole | undefined;
  if (isAdminPath && role === "MODERATOR") {
    if (pathname === "/admin" || !isModeratorAllowedAdminPath(pathname)) {
      return NextResponse.redirect(new URL("/admin/moderation", nextUrl.origin));
    }
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
  if (isDashboard || isAdminPath) {
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
