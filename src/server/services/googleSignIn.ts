import type { GoogleOAuthProfile } from "@/lib/google-profile";
import { mapGoogleSignInFailureToErrorParam } from "@/lib/google-auth-errors";
import { logAuthEventSafe } from "@/server/services/authEventLog";
import {
  resolveGoogleOAuthUser,
  type GoogleUserResolveFailureCode,
} from "@/server/services/googleAccountService";
import type { UserRole } from "@/generated/prisma/enums";

export type GoogleSessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  image?: string | null;
};

export type GoogleSignInFailureReason = GoogleUserResolveFailureCode;

export { mapGoogleSignInFailureToErrorParam };

export async function completeGoogleOAuthSignIn(
  profile: GoogleOAuthProfile,
): Promise<
  | { ok: true; user: GoogleSessionUser }
  | { ok: false; failureReason: GoogleSignInFailureReason }
> {
  const res = await resolveGoogleOAuthUser(profile);
  if (!res.ok) {
    await logAuthEventSafe({
      action:
        res.code === "EMAIL_NOT_VERIFIED"
          ? "google.sign_in_denied_unverified_email"
          : res.code === "BLOCKED"
            ? "google.sign_in_denied_blocked"
            : res.code === "INACTIVE"
              ? "google.sign_in_denied_inactive"
              : res.code === "MAINTENANCE"
                ? "google.sign_in_denied_maintenance"
                : "google.sign_in_failed",
      provider: "google",
      metadata: {
        code: res.code,
        googleUserId: profile.id.slice(0, 255),
        ...(res.debugCode ? { debugCode: res.debugCode } : {}),
      },
    });
    return { ok: false, failureReason: res.code };
  }

  if (res.googleIdentityLinked) {
    await logAuthEventSafe({
      action: "google.identity_linked",
      provider: "google",
      userId: res.user.id,
      metadata: { googleUserId: profile.id.slice(0, 255) },
    });
  }

  await logAuthEventSafe({
    action: "google.sign_in_success",
    provider: "google",
    userId: res.user.id,
    metadata: { googleUserId: profile.id.slice(0, 255) },
  });

  return { ok: true, user: res.user };
}
