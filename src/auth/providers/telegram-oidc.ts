import type { OIDCConfig, OIDCUserConfig } from "@auth/core/providers/oauth";

import type { UserRole } from "@/generated/prisma/enums";
import { UserRole as UserRoleEnum } from "@/generated/prisma/enums";

/**
 * Telegram Login через OpenID Connect (oauth.telegram.org).
 * @see https://oauth.telegram.org/.well-known/openid-configuration
 */
export interface TelegramOidcProfile extends Record<string, unknown> {
  sub: string;
  name?: string;
  picture?: string;
  preferred_username?: string;
  phone_number?: string;
  email?: string;
  email_verified?: boolean;
}

export default function Telegram(
  options: OIDCUserConfig<TelegramOidcProfile>,
): OIDCConfig<TelegramOidcProfile> {
  return {
    id: "telegram",
    name: "Telegram",
    type: "oidc",
    issuer: "https://oauth.telegram.org",
    wellKnown: "https://oauth.telegram.org/.well-known/openid-configuration",
    authorization: {
      params: {
        scope: "openid profile",
      },
    },
    checks: ["pkce", "state", "nonce"],
    profile(profile) {
      const email =
        typeof profile.email === "string" && profile.email.includes("@")
          ? profile.email.toLowerCase().trim()
          : null;
      const synthetic = `tg_${profile.sub}@telegram.local`;
      return {
        id: profile.sub,
        name:
          (typeof profile.name === "string" && profile.name.trim()) ||
          (typeof profile.preferred_username === "string" &&
            profile.preferred_username.trim()) ||
          `user_${profile.sub}`,
        email: email ?? synthetic,
        image:
          typeof profile.picture === "string" && profile.picture.trim()
            ? profile.picture
            : undefined,
        role: UserRoleEnum.USER as UserRole,
      };
    },
    style: { brandColor: "#0088cc" },
    options,
  };
}
