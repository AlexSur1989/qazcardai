import { NextResponse } from "next/server";

import { resetPassword } from "@/server/services/passwordReset";
import { enforceResetPasswordRateLimit } from "@/server/services/rateLimitService";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = await enforceResetPasswordRateLimit(req);
  if (limited) return limited;

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
  const b = body as Record<string, unknown>;
  if (typeof b.token !== "string" || !b.token.trim()) {
    return NextResponse.json(
      { ok: false, error: "Токен обязателен" },
      { status: 400 },
    );
  }
  if (typeof b.password !== "string" || typeof b.confirmPassword !== "string") {
    return NextResponse.json(
      { ok: false, error: "Пароль и подтверждение обязательны" },
      { status: 400 },
    );
  }

  const result = await resetPassword({
    token: b.token,
    newPassword: b.password,
    confirmPassword: b.confirmPassword,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.message, code: result.code },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, message: result.message });
}
