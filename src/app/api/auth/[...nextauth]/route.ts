import type { NextRequest } from "next/server";

import { handlers } from "@/auth";
import { enforceLoginRateLimit } from "@/server/services/rateLimitService";

export const GET = handlers.GET;

export async function POST(req: NextRequest) {
  const u = new URL(req.url);
  if (u.pathname === "/api/auth/callback/credentials") {
    const blocked = await enforceLoginRateLimit(req);
    if (blocked) return blocked;
  }
  return handlers.POST(req);
}
