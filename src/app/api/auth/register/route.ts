import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getAppSetting, getMaintenanceFlags } from "@/server/services/appSettings";
import { trySendWelcomeEmailForNewUser } from "@/server/services/notificationsIntegration";
import { UserRole, UserStatus } from "@/generated/prisma/enums";
import { enforceRegistrationRateLimit } from "@/server/services/rateLimitService";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const limited = await enforceRegistrationRateLimit(req);
  if (limited) return limited;

  const maint = await getMaintenanceFlags();
  if (maint.maintenanceMode) {
    return NextResponse.json(
      {
        error:
          "Регистрация временно недоступна: ведутся технические работы. Скоро открытие.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const { email: emailIn, password, name } = body as Record<string, unknown>;

  if (typeof emailIn !== "string" || !EMAIL_RE.test(emailIn.trim())) {
    return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Пароль должен быть не короче 8 символов" },
      { status: 400 },
    );
  }

  const email = emailIn.toLowerCase().trim();
  if (email.endsWith("@telegram.local")) {
    return NextResponse.json(
      { error: "Этот адрес зарезервирован для входа через Telegram" },
      { status: 400 },
    );
  }

  const nameStr =
    typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Пользователь с таким email уже зарегистрирован" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  const freeRaw = await getAppSetting("FREE_CREDITS_FOR_NEW_USERS");
  const freeCredits =
    typeof freeRaw === "number" && Number.isFinite(freeRaw) && freeRaw >= 0
      ? Math.min(Math.floor(freeRaw), 1_000_000)
      : 0;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: nameStr,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      balanceCredits: freeCredits,
      emailVerified: false,
    },
  });

  void trySendWelcomeEmailForNewUser({ userId: user.id });

  return NextResponse.json({ ok: true }, { status: 201 });
}
