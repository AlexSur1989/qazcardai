import { randomBytes } from "node:crypto";

import type { UserRole } from "@/generated/prisma/enums";
import { UserRole as UserRoleEnum, UserStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { TelegramWidgetProfile } from "@/lib/telegram-profile";
import { telegramDisplayName } from "@/lib/telegram-profile";
import { getAppSetting } from "@/server/services/appSettings";

export const TELEGRAM_IDENTITY_PROVIDER = "telegram" as const;
const SYNTHETIC_EMAIL_DOMAIN = "telegram.local";

/** Технический email для пользователей только с Telegram (зарезервированный домен). */
export function syntheticTelegramEmail(telegramUserId: string): string {
  return `tg_${telegramUserId}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function isReservedTelegramLocalEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

type ResolvedUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  image?: string | null;
};

function pickDisplayName(profile: TelegramWidgetProfile): string {
  return telegramDisplayName(profile);
}

export async function resolveTelegramWidgetUser(profile: TelegramWidgetProfile): Promise<
  | {
      ok: true;
      user: ResolvedUser;
      /** Создана новая строка UserIdentity telegram в этом запросе (для аудита привязки). */
      telegramIdentityLinked: boolean;
    }
  | { ok: false; code: "BLOCKED" | "INACTIVE" | "ERROR"; debugCode?: string }
> {
  const sub = profile.id.trim();
  if (!sub) {
    return { ok: false, code: "ERROR" };
  }

  const username = profile.username?.slice(0, 255) || null;
  const displayName = pickDisplayName(profile);
  const avatarUrl =
    profile.photo_url?.startsWith("http")
      ? profile.photo_url.slice(0, 2048)
      : null;

  const metaUsername = username;

  let freeCredits = 0;
  try {
    const freeRaw = await getAppSetting("FREE_CREDITS_FOR_NEW_USERS");
    if (typeof freeRaw === "number" && Number.isFinite(freeRaw) && freeRaw >= 0) {
      freeCredits = Math.min(Math.floor(freeRaw), 1_000_000);
    }
  } catch {
    /* ignore */
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingLink = await tx.userIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: TELEGRAM_IDENTITY_PROVIDER,
            providerUserId: sub,
          },
        },
        include: { user: true },
      });

      if (existingLink?.user) {
        const u = existingLink.user;
        if (u.status === "BLOCKED") return { kind: "blocked" as const };
        if (u.status !== "ACTIVE") return { kind: "inactive" as const };

        await tx.userIdentity.update({
          where: { id: existingLink.id },
          data: {
            username,
            displayName,
            avatarUrl,
            metadata: {
              lastSignInAt: new Date().toISOString(),
              authDate: profile.auth_date,
            } satisfies Prisma.InputJsonObject,
          },
        });
        return {
          kind: "ok" as const,
          telegramIdentityLinked: false,
          user: {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role as UserRole,
            image: avatarUrl,
          },
        };
      }

      const syn = syntheticTelegramEmail(sub);
      const existingSyn = await tx.user.findUnique({ where: { email: syn } });
      if (existingSyn) {
        if (existingSyn.status === "BLOCKED") return { kind: "blocked" as const };
        if (existingSyn.status !== "ACTIVE") return { kind: "inactive" as const };

        const dup = await tx.userIdentity.findUnique({
          where: {
            provider_providerUserId: {
              provider: TELEGRAM_IDENTITY_PROVIDER,
              providerUserId: sub,
            },
          },
        });
        let telegramIdentityLinked = false;
        if (!dup) {
          await tx.userIdentity.create({
            data: {
              userId: existingSyn.id,
              provider: TELEGRAM_IDENTITY_PROVIDER,
              providerUserId: sub,
              username,
              displayName,
              avatarUrl,
              metadata: { backfill: true } satisfies Prisma.InputJsonObject,
            },
          });
          telegramIdentityLinked = true;
        }
        return {
          kind: "ok" as const,
          telegramIdentityLinked,
          user: {
            id: existingSyn.id,
            email: existingSyn.email,
            name: existingSyn.name,
            role: existingSyn.role as UserRole,
            image: avatarUrl,
          },
        };
      }

      const widgetOnlySecret = `__widget_telegram__${randomBytes(32).toString("hex")}`;
      const passwordHash = await hashPassword(widgetOnlySecret);

      const created = await tx.user.create({
        data: {
          email: syn,
          passwordHash,
          name: displayName,
          role: UserRoleEnum.USER,
          status: UserStatus.ACTIVE,
          balanceCredits: freeCredits,
          emailVerified: false,
        },
      });

      await tx.userIdentity.create({
        data: {
          userId: created.id,
          provider: TELEGRAM_IDENTITY_PROVIDER,
          providerUserId: sub,
          username: metaUsername,
          displayName,
          avatarUrl,
          metadata: {
            source: "telegram_widget_register",
            authDate: profile.auth_date,
          } satisfies Prisma.InputJsonObject,
        },
      });

      return {
        kind: "ok" as const,
        telegramIdentityLinked: true,
        user: {
          id: created.id,
          email: created.email,
          name: created.name,
          role: created.role as UserRole,
          image: avatarUrl,
        },
      };
    });

    if (result.kind === "blocked") return { ok: false, code: "BLOCKED" };
    if (result.kind === "inactive") return { ok: false, code: "INACTIVE" };
    return {
      ok: true,
      user: result.user,
      telegramIdentityLinked: result.telegramIdentityLinked,
    };
  } catch (err) {
    const debugCode =
      err instanceof Prisma.PrismaClientKnownRequestError
        ? `prisma_${err.code}`
        : "unknown";
    console.warn(`[telegram] user_resolve_error: ${debugCode}`);
    return { ok: false, code: "ERROR", debugCode };
  }
}
