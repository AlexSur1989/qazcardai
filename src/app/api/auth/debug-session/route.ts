import { NextResponse } from "next/server";

import { auth } from "@/auth";

/**
 * Диагностика сессии без секретов.
 * Production: только ADMIN / SUPER_ADMIN, либо AUTH_DEBUG_SESSION=1 (временно).
 */
export async function GET() {
  const session = await auth();
  const isProd = process.env.NODE_ENV === "production";
  const debugOpen = process.env.AUTH_DEBUG_SESSION === "1";

  if (isProd && !debugOpen) {
    const role = session?.user?.role;
    if (!role || (role !== "ADMIN" && role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const user = session?.user;
  return NextResponse.json({
    hasSession: Boolean(user),
    userId: user?.id ?? null,
    email: user?.email ?? null,
    role: user?.role ?? null,
  });
}
