
import { createHash, randomBytes } from "crypto";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { getAppName } from "@/lib/app-name";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { sendTemplateEmail } from "@/server/services/emailService";

const RESET_MESSAGE =
  "Если аккаунт с таким email существует, мы отправили ссылку для восстановления пароля.";

const EXPIRES_MIN = 30;

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function buildResetUrl(rawToken: string, publicBaseUrl?: string | null): string {
  const base = (publicBaseUrl?.trim() || getAppBaseUrl()).replace(/\/$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Создаёт токен и отправляет письмо. Не раскрывает существование email в ответе.
 * В dev при NODE_ENV !== production возвращает devResetUrl (только при найденном user).
 */
export async function requestPasswordReset(input: {
  email: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** Origin запроса Рє API (например http://localhost:3099) — чтобы ссылка РІ РїРёСЃСЊРјРµ совпадала СЃ портом dev-сервера */
  publicBaseUrl?: string | null;
}): Promise<{
  publicMessage: string;
  devResetUrl?: string;
}> {
  const email = input.email.trim().toLowerCase();
  const publicMessage = RESET_MESSAGE;
  if (!email) {
    return { publicMessage };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return { publicMessage };
  }

  const raw = generateResetToken();
  const tokenHash = hashResetToken(raw);
  const expiresAt = new Date(Date.now() + EXPIRES_MIN * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: input.ipAddress?.slice(0, 128) ?? null,
        userAgent: input.userAgent?.slice(0, 512) ?? null,
      },
    }),
  ]);

  const resetUrl = buildResetUrl(raw, input.publicBaseUrl);
  const appName = (() => {
    try {
      return getAppName();
    } catch {
      return "QazCard AI";
    }
  })();

  await sendTemplateEmail({
    to: user.email,
    templateKey: "PASSWORD_RESET",
    variables: {
      appName,
      userName: user.name ?? user.email,
      resetUrl,
      expiresInMinutes: EXPIRES_MIN,
    },
  });

  const devResetUrl =
    process.env.NODE_ENV !== "production" ? resetUrl : undefined;

  return { publicMessage, devResetUrl };
}

export type ResetPasswordResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code:
        | "invalid_token"
        | "password_mismatch"
        | "password_short"
        | "server";
      message: string;
    };

/**
 * Сброс пароля по сырому токену из ссылки. Токен не логируем.
 */
export async function resetPassword(input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ResetPasswordResult> {
  if (input.newPassword !== input.confirmPassword) {
    return {
      ok: false,
      code: "password_mismatch",
      message: "Пароли не совпадают.",
    };
  }
  if (input.newPassword.length < 8) {
    return {
      ok: false,
      code: "password_short",
      message: "Пароль должен быть не короче 8 символов.",
    };
  }

  const t = input.token.trim();
  if (!t) {
    return {
      ok: false,
      code: "invalid_token",
      message: "Ссылка восстановления недействительна или истекла.",
    };
  }

  const tokenHash = hashResetToken(t);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true } } },
  });

  if (!row || row.usedAt != null || row.expiresAt.getTime() <= Date.now()) {
    return {
      ok: false,
      code: "invalid_token",
      message: "Ссылка восстановления недействительна или истекла.",
    };
  }

  const passwordHash = await hashPassword(input.newPassword);
  const userId = row.userId;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await tx.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    await tx.passwordResetToken.updateMany({
      where: {
        userId,
        id: { not: row.id },
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
  });

  await writeAdminAuditLog({
    adminUserId: userId,
    action: "USER_PASSWORD_RESET_COMPLETED",
    targetType: "User",
    targetId: userId,
    metadata: { source: "self_service" },
  });

  return {
    ok: true,
    message: "Пароль успешно изменен. Теперь вы можете войти.",
  };
}

export { RESET_MESSAGE };
