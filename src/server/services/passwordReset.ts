
import { createHash, randomBytes } from "crypto";

import { writeAdminAuditLog } from "@/lib/admin-audit";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { getAppName } from "@/lib/app-name";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { sendTemplateEmail } from "@/server/services/emailService";

const RESET_MESSAGE =
  "Р•СЃР»Рё Р°РєРєР°СѓРЅС‚ СЃ С‚Р°РєРёРј email СЃСѓС‰РµСЃС‚РІСѓРµС‚, РјС‹ РѕС‚РїСЂР°РІРёР»Рё СЃСЃС‹Р»РєСѓ РґР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РїР°СЂРѕР»СЏ.";

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
 * РЎРѕР·РґР°С‘С‚ С‚РѕРєРµРЅ Рё РѕС‚РїСЂР°РІР»СЏРµС‚ РїРёСЃСЊРјРѕ. РќРµ СЂР°СЃРєСЂС‹РІР°РµС‚ СЃСѓС‰РµСЃС‚РІРѕРІР°РЅРёРµ email РІ РѕС‚РІРµС‚Рµ.
 * Р’ dev РїСЂРё NODE_ENV !== production РІРѕР·РІСЂР°С‰Р°РµС‚ devResetUrl (С‚РѕР»СЊРєРѕ РїСЂРё РЅР°Р№РґРµРЅРЅРѕРј user).
 */
export async function requestPasswordReset(input: {
  email: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** Origin Р·Р°РїСЂРѕСЃР° Рє API (РЅР°РїСЂРёРјРµСЂ http://localhost:3099) вЂ” С‡С‚РѕР±С‹ СЃСЃС‹Р»РєР° РІ РїРёСЃСЊРјРµ СЃРѕРІРїР°РґР°Р»Р° СЃ РїРѕСЂС‚РѕРј dev-СЃРµСЂРІРµСЂР° */
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
 * РЎР±СЂРѕСЃ РїР°СЂРѕР»СЏ РїРѕ СЃС‹СЂРѕРјСѓ С‚РѕРєРµРЅСѓ РёР· СЃСЃС‹Р»РєРё. РўРѕРєРµРЅ РЅРµ Р»РѕРіРёСЂСѓРµРј.
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
      message: "РџР°СЂРѕР»Рё РЅРµ СЃРѕРІРїР°РґР°СЋС‚.",
    };
  }
  if (input.newPassword.length < 8) {
    return {
      ok: false,
      code: "password_short",
      message: "РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РЅРµ РєРѕСЂРѕС‡Рµ 8 СЃРёРјРІРѕР»РѕРІ.",
    };
  }

  const t = input.token.trim();
  if (!t) {
    return {
      ok: false,
      code: "invalid_token",
      message: "РЎСЃС‹Р»РєР° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РЅРµРґРµР№СЃС‚РІРёС‚РµР»СЊРЅР° РёР»Рё РёСЃС‚РµРєР»Р°.",
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
      message: "РЎСЃС‹Р»РєР° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РЅРµРґРµР№СЃС‚РІРёС‚РµР»СЊРЅР° РёР»Рё РёСЃС‚РµРєР»Р°.",
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
    message: "РџР°СЂРѕР»СЊ СѓСЃРїРµС€РЅРѕ РёР·РјРµРЅРµРЅ. РўРµРїРµСЂСЊ РІС‹ РјРѕР¶РµС‚Рµ РІРѕР№С‚Рё.",
  };
}

export { RESET_MESSAGE };
