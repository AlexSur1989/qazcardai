import { randomBytes } from "node:crypto";

import type { UserRole } from "@/generated/prisma/enums";
import { UserRole as UserRoleEnum, UserStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { GoogleOAuthProfile } from "@/lib/google-profile";
import { hashPassword } from "@/lib/password";
import { isReservedTelegramLocalEmail } from "@/server/services/telegramAccountService";
import { getAppSetting, getMaintenanceFlags } from "@/server/services/appSettings";

export const GOOGLE_IDENTITY_PROVIDER = "google" as const;

type ResolvedUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  image?: string | null;
};

export type GoogleUserResolveFailureCode =
  | "EMAIL_NOT_VERIFIED"
  | "BLOCKED"
  | "INACTIVE"
  | "MAINTENANCE"
  | "ERROR";

export async function resolveGoogleOAuthUser(
  profile: GoogleOAuthProfile,
): Promise<
  | {
      ok: true;
      user: ResolvedUser;
      googleIdentityLinked: boolean;
    }
  | { ok: false; code: GoogleUserResolveFailureCode; debugCode?: string }
> {
  if (!profile.emailVerified) {
    return { ok: false, code: "EMAIL_NOT_VERIFIED" };
  }

  const sub = profile.id.trim();
  const email = profile.email.toLowerCase().trim();
  if (!sub || !email) {
    return { ok: false, code: "ERROR" };
  }

  if (isReservedTelegramLocalEmail(email)) {
    return { ok: false, code: "ERROR", debugCode: "reserved_email" };
  }

  const displayName = profile.name;
  const avatarUrl = profile.picture;

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
            provider: GOOGLE_IDENTITY_PROVIDER,
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
            displayName,
            avatarUrl,
            metadata: {
              lastSignInAt: new Date().toISOString(),
              email,
            } satisfies Prisma.InputJsonObject,
          },
        });

        return {
          kind: "ok" as const,
          googleIdentityLinked: false,
          user: {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role as UserRole,
            image: avatarUrl,
          },
        };
      }

      const existingByEmail = await tx.user.findUnique({ where: { email } });
      if (existingByEmail) {
        if (existingByEmail.status === "BLOCKED") return { kind: "blocked" as const };
        if (existingByEmail.status !== "ACTIVE") return { kind: "inactive" as const };

        const dup = await tx.userIdentity.findUnique({
          where: {
            provider_providerUserId: {
              provider: GOOGLE_IDENTITY_PROVIDER,
              providerUserId: sub,
            },
          },
        });

        let googleIdentityLinked = false;
        if (!dup) {
          await tx.userIdentity.create({
            data: {
              userId: existingByEmail.id,
              provider: GOOGLE_IDENTITY_PROVIDER,
              providerUserId: sub,
              displayName,
              avatarUrl,
              metadata: {
                linkedByEmail: true,
                email,
              } satisfies Prisma.InputJsonObject,
            },
          });
          googleIdentityLinked = true;
        }

        if (!existingByEmail.emailVerified) {
          await tx.user.update({
            where: { id: existingByEmail.id },
            data: { emailVerified: true },
          });
        }

        return {
          kind: "ok" as const,
          googleIdentityLinked,
          user: {
            id: existingByEmail.id,
            email: existingByEmail.email,
            name: existingByEmail.name,
            role: existingByEmail.role as UserRole,
            image: avatarUrl,
          },
        };
      }

      const maint = await getMaintenanceFlags();
      if (maint.maintenanceMode) {
        return { kind: "maintenance" as const };
      }

      const oauthOnlySecret = `__google_oauth__${randomBytes(32).toString("hex")}`;
      const passwordHash = await hashPassword(oauthOnlySecret);

      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: displayName,
          role: UserRoleEnum.USER,
          status: UserStatus.ACTIVE,
          balanceCredits: freeCredits,
          emailVerified: true,
        },
      });

      await tx.userIdentity.create({
        data: {
          userId: created.id,
          provider: GOOGLE_IDENTITY_PROVIDER,
          providerUserId: sub,
          displayName,
          avatarUrl,
          metadata: {
            source: "google_oauth_register",
            email,
          } satisfies Prisma.InputJsonObject,
        },
      });

      return {
        kind: "ok" as const,
        googleIdentityLinked: true,
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
    if (result.kind === "maintenance") return { ok: false, code: "MAINTENANCE" };
    return {
      ok: true,
      user: result.user,
      googleIdentityLinked: result.googleIdentityLinked,
    };
  } catch (err) {
    const debugCode =
      err instanceof Prisma.PrismaClientKnownRequestError
        ? `prisma_${err.code}`
        : "unknown";
    console.warn(`[google] user_resolve_error: ${debugCode}`);
    return { ok: false, code: "ERROR", debugCode };
  }
}
