import type { TelegramWidgetProfile } from "@/lib/telegram-profile";
import { logAuthEventSafe } from "@/server/services/authEventLog";
import { resolveTelegramWidgetUser } from "@/server/services/telegramAccountService";

export type TelegramWidgetSessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: import("@/generated/prisma/enums").UserRole;
  image?: string | null;
};

export type TelegramWidgetSignInFailureReason = "BLOCKED" | "INACTIVE" | "ERROR";

export async function completeTelegramWidgetSignIn(
  profile: TelegramWidgetProfile,
): Promise<
  | { ok: true; user: TelegramWidgetSessionUser }
  | { ok: false; failureReason: TelegramWidgetSignInFailureReason }
> {
  const res = await resolveTelegramWidgetUser(profile);
  if (!res.ok) {
    await logAuthEventSafe({
      action:
        res.code === "BLOCKED"
          ? "telegram.sign_in_denied_blocked"
          : res.code === "INACTIVE"
            ? "telegram.sign_in_denied_inactive"
            : "telegram.sign_in_failed",
      provider: "telegram",
      metadata: {
        code: res.code,
        telegramUserId: profile.id,
        ...(res.debugCode ? { debugCode: res.debugCode } : {}),
      },
    });
    return { ok: false, failureReason: res.code };
  }

  if (res.telegramIdentityLinked) {
    await logAuthEventSafe({
      action: "telegram.identity_linked",
      provider: "telegram",
      userId: res.user.id,
      metadata: { telegramUserId: profile.id.slice(0, 255) },
    });
  }

  await logAuthEventSafe({
    action: "telegram.sign_in_success",
    provider: "telegram",
    userId: res.user.id,
    metadata: { telegramUserId: profile.id.slice(0, 255) },
  });

  return { ok: true, user: res.user };
}
