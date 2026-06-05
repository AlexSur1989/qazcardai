import { NextResponse } from "next/server";

import { resolvePublicOriginFromRequest } from "@/lib/auth-public-url";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { ensureDefaultEmailTemplates } from "@/server/services/emailTemplates";
import {
  requestPasswordReset,
} from "@/server/services/passwordReset";
import {
  enforceForgotPasswordRateLimit,
} from "@/server/services/rateLimitService";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Некорректный JSON" },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "Некорректное тело запроса" },
      { status: 400 },
    );
  }
  const { email: rawEmail } = body as Record<string, unknown>;
  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    return NextResponse.json(
      { ok: false, error: "Укажите email" },
      { status: 400 },
    );
  }
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Некорректный email" },
      { status: 400 },
    );
  }

  const limited = await enforceForgotPasswordRateLimit(req, email);
  if (limited) return limited;

  const ip = getClientIpFromRequest(req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;
  await ensureDefaultEmailTemplates();
  const { publicMessage, devResetUrl } = await requestPasswordReset({
    email,
    ipAddress: ip,
    userAgent,
    publicBaseUrl: resolvePublicOriginFromRequest(req),
  });

  const resBody: {
    ok: true;
    message: string;
    devResetUrl?: string;
  } = {
    ok: true,
    message: publicMessage,
  };
  if (process.env.NODE_ENV !== "production" && devResetUrl) {
    resBody.devResetUrl = devResetUrl;
  }
  return NextResponse.json(resBody);
}
