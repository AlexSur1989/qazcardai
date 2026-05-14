import { randomBytes } from "node:crypto";

import type { UserRole } from "@/generated/prisma/enums";
import { UserRole as UserRoleEnum, UserStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { TelegramOidcProfile } from "@/auth/providers/telegram-oidc";
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

function pickDisplayName(profile: TelegramOidcProfile): string {
  if (typeof profile.name === "string" && profile.name.trim()) {
    return profile.name.trim().slice(0, 120);
  }
  if (
    typeof profile.preferred_username === "string" &&
    profile.preferred_username.trim()
  ) {
    return profile.preferred_username.trim().slice(0, 120);
  }
  if (typeof profile.sub === "string") {
    return `Telegram user ${profile.sub}`;
  }
  return "Telegram";
}

export async function resolveTelegramOAuthUser(profile: TelegramOidcProfile): Promise<
  | {
      ok: true;
      user: ResolvedUser;
      /** Создана новая строка UserIdentity telegram в этом запросе (для аудита привязки). */
      telegramIdentityLinked: boolean;
    }
  | { ok: false; code: "BLOCKED" | "INACTIVE" | "ERROR" }
> {
  const sub =
    typeof profile.sub === "string" && profile.sub.trim()
      ? profile.sub.trim()
      : null;
  if (!sub) {
    return { ok: false, code: "ERROR" };
  }

  const username =
    typeof profile.preferred_username === "string"
      ? profile.preferred_username.trim().slice(0, 255) || null
      : null;
  const displayName = pickDisplayName(profile);
  const avatarUrl =
    typeof profile.picture === "string" && profile.picture.startsWith("http")
      ? profile.picture.slice(0, 2048)
      : null;

  const metaUsername = username;
  const rawEmail =
    typeof profile.email === "string" && profile.email.includes("@")
      ? profile.email.toLowerCase().trim()
      : null;
  const linkEmail =
    rawEmail && !isReservedTelegramLocalEmail(rawEmail) ? rawEmail : null;
  const emailVerified =
    profile.email_verified === true && Boolean(linkEmail);

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

      if (linkEmail) {
        const byEmail = await tx.user.findUnique({ where: { email: linkEmail } });
        if (byEmail) {
          if (byEmail.status === "BLOCKED") return { kind: "blocked" as const };
          if (byEmail.status !== "ACTIVE") return { kind: "inactive" as const };

          await tx.userIdentity.create({
            data: {
              userId: byEmail.id,
              provider: TELEGRAM_IDENTITY_PROVIDER,
              providerUserId: sub,
              username,
              displayName,
              avatarUrl,
              metadata: {
                linkedFrom: "telegram_oidc_email_match",
                emailVerifiedFromProvider: emailVerified,
              } satisfies Prisma.InputJsonObject,
            },
          });

          const nextVerified = byEmail.emailVerified || emailVerified;
          if (nextVerified !== byEmail.emailVerified) {
            await tx.user.update({
              where: { id: byEmail.id },
              data: { emailVerified: true },
            });
          }

          return {
            kind: "ok" as const,
            telegramIdentityLinked: true,
            user: {
              id: byEmail.id,
              email: byEmail.email,
              name: byEmail.name,
              role: byEmail.role as UserRole,
              image: avatarUrl,
            },
          };
        }
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

      const oauthOnlySecret = `__oauth_telegram__${randomBytes(32).toString("hex")}`;
      const passwordHash = await hashPassword(oauthOnlySecret);

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
            source: "telegram_oidc_register",
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
  } catch {
    return { ok: false, code: "ERROR" };
  }
}
